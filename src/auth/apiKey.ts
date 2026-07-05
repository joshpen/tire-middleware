import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import type { Db } from "../db.js";
import { SlidingWindowRateLimiter } from "./rateLimiter.js";

export interface AuthedClient {
  id: string;
  org_id: string;
  name: string;
  scopes: string[];
  rate_limit_per_min: number;
}

declare module "fastify" {
  interface FastifyRequest {
    apiClient: AuthedClient | null;
    /** Error message captured for the api_request_logs row. */
    apiError: string | null;
    /** Set true once the request should be logged to api_request_logs. */
    apiLogged: boolean;
  }
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function bearerToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1]!.trim() : null;
}

function deny(req: FastifyRequest, reply: FastifyReply, status: number, error: string) {
  req.apiError = error;
  return reply.code(status).send({ ok: false, status, error });
}

/**
 * Registers the API-key auth machinery on the Fastify instance:
 *  - `authenticate` preHandler: bearer → sha256 → api_clients lookup
 *    (active, unexpired) + sliding-window rate limit
 *  - `requireScope(scope)` preHandler factory
 *  - onResponse hook writing every authenticated-route request to
 *    api_request_logs (status, duration_ms, error) and bumping last_used_at.
 */
export function registerApiKeyAuth(app: FastifyInstance, db: Db) {
  const limiter = new SlidingWindowRateLimiter();
  const pruneTimer = setInterval(() => limiter.prune(), 5 * 60_000);
  pruneTimer.unref();

  app.decorateRequest("apiClient", null);
  app.decorateRequest("apiError", null);
  app.decorateRequest("apiLogged", false);

  const authenticate: preHandlerHookHandler = async (req, reply) => {
    req.apiLogged = true;
    const token = bearerToken(req);
    if (!token) return deny(req, reply, 401, "missing bearer token");

    const hash = sha256Hex(token);
    const { data: client, error } = await db
      .from("api_clients")
      .select("id, org_id, name, scopes, rate_limit_per_min")
      .eq("key_hash", hash)
      .eq("is_active", true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();
    if (error) {
      req.log.error({ err: error }, "api_clients lookup failed");
      return deny(req, reply, 500, "auth lookup failed");
    }
    if (!client) return deny(req, reply, 401, "invalid api key");

    if (!limiter.allow(client.id, client.rate_limit_per_min)) {
      req.apiClient = client;
      return deny(req, reply, 429, `rate limit exceeded (${client.rate_limit_per_min}/min)`);
    }
    req.apiClient = client;
  };

  const requireScope = (scope: string): preHandlerHookHandler =>
    async function scopeCheck(req, reply) {
      const client = req.apiClient;
      if (!client) return deny(req, reply, 401, "unauthenticated");
      if (!client.scopes.includes(scope)) {
        return deny(req, reply, 403, `missing scope ${scope}`);
      }
    };

  app.addHook("onResponse", async (req, reply) => {
    if (!req.apiLogged) return;
    const resource = `${req.method} ${req.routeOptions?.url ?? req.url}`;
    const row = {
      client_id: req.apiClient?.id ?? null,
      org_id: req.apiClient?.org_id ?? null,
      resource,
      status: reply.statusCode,
      duration_ms: Math.round(reply.elapsedTime),
      error: req.apiError,
    };
    const { error } = await db.from("api_request_logs").insert(row);
    if (error) req.log.error({ err: error }, "failed to write api_request_logs row");
    if (req.apiClient) {
      const { error: touchError } = await db
        .from("api_clients")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", req.apiClient.id);
      if (touchError) req.log.error({ err: touchError }, "failed to bump last_used_at");
    }
  });

  app.setErrorHandler((err: unknown, req, reply) => {
    req.log.error({ err }, "request failed");
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = (err as { statusCode?: number }).statusCode;
    req.apiError = message;
    const status = statusCode && statusCode >= 400 ? statusCode : 500;
    reply.code(status).send({ ok: false, status, error: status === 500 ? "internal error" : message });
  });

  return { authenticate, requireScope };
}

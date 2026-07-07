import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "../db.js";
import {
  createPortalAppointmentRequest,
  createPortalFleetInquiry,
  createPortalQuoteRequest,
  createPortalWarrantyIntake,
  getPublicCatalogCategories,
  getPublicDealerBrand,
  getPublicDealerLocations,
  getPublicDealerProfile,
  getPublicDealerPromotions,
  getPublicDealerServices,
  PortalError,
  recordPortalAnalyticsEvent,
  validatePortalAccess,
  type PortalContext,
  type PortalModule,
} from "../portal/service.js";

/**
 * Public headless portal API (/api/portal/v1). Thin wrappers over the portal
 * service layer; every route runs through validatePortalAccess (tenant,
 * token, module, origin, rate limit). Errors are user-safe — no stack traces
 * or internals reach public callers.
 */
export function registerPortalRoutes(app: FastifyInstance, db: Db) {
  const tokenOf = (req: FastifyRequest): string | null => {
    const header = req.headers["x-portal-key"];
    if (typeof header === "string" && header.trim()) return header.trim();
    const q = (req.query as Record<string, string>)?.portal_key;
    return typeof q === "string" && q ? q : null;
  };

  const cors = (req: FastifyRequest, reply: FastifyReply) => {
    const origin = (req.headers.origin as string) ?? null;
    if (origin) {
      // Actual authorization happens in validatePortalAccess; CORS headers
      // just let the browser deliver the response.
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Vary", "Origin");
      reply.header("Access-Control-Allow-Headers", "Content-Type, X-Portal-Key, X-Portal-Source");
      reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
  };

  app.options("/api/portal/v1/*", async (req, reply) => {
    cors(req, reply);
    return reply.code(204).send();
  });

  const guard = async (
    req: FastifyRequest,
    reply: FastifyReply,
    module: PortalModule,
  ): Promise<PortalContext | null> => {
    cors(req, reply);
    const params = req.params as { dealerSlug: string };
    try {
      return await validatePortalAccess(db, params.dealerSlug, tokenOf(req), (req.headers.origin as string) ?? null, module, {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        source: (req.headers["x-portal-source"] as string) ?? "api",
      });
    } catch (err) {
      const status = err instanceof PortalError ? err.status : 500;
      const message = err instanceof PortalError ? err.message : "portal unavailable";
      reply.code(status).send({ ok: false, error: message });
      return null;
    }
  };

  const get = (path: string, module: PortalModule, fn: (ctx: PortalContext) => unknown, wrap: string) => {
    app.get<{ Params: { dealerSlug: string } }>(`/api/portal/v1/dealers/:dealerSlug${path}`, async (req, reply) => {
      const ctx = await guard(req, reply, module);
      if (!ctx) return;
      return { ok: true, [wrap]: fn(ctx) };
    });
  };

  get("", "events", getPublicDealerProfile, "dealer");
  get("/brand", "events", getPublicDealerBrand, "brand");
  get("/services", "services", getPublicDealerServices, "services");
  get("/locations", "events", getPublicDealerLocations, "locations");
  get("/promotions", "promotions", getPublicDealerPromotions, "promotions");
  get("/catalog-categories", "catalog", getPublicCatalogCategories, "categories");

  const post = (
    path: string,
    module: PortalModule,
    fn: (ctx: PortalContext, payload: Record<string, unknown>) => Promise<unknown>,
    wrap: string,
  ) => {
    app.post<{ Params: { dealerSlug: string }; Body: Record<string, unknown> }>(
      `/api/portal/v1/dealers/:dealerSlug${path}`,
      async (req, reply) => {
        const ctx = await guard(req, reply, module);
        if (!ctx) return;
        try {
          const result = await fn(ctx, (req.body ?? {}) as Record<string, unknown>);
          return reply.code(201).send({ ok: true, [wrap]: result });
        } catch (err) {
          const status = err instanceof PortalError ? err.status : 500;
          const message = err instanceof PortalError ? err.message : "could not process your request";
          req.log.error({ err }, "portal request failed");
          return reply.code(status).send({ ok: false, error: message });
        }
      },
    );
  };

  post("/quote-requests", "quote", (ctx, p) => createPortalQuoteRequest(db, ctx, p), "request");
  post("/appointments", "booking", (ctx, p) => createPortalAppointmentRequest(db, ctx, p), "request");
  post("/warranty-intake", "warranty", (ctx, p) => createPortalWarrantyIntake(db, ctx, p), "request");
  post("/fleet-inquiries", "fleet", (ctx, p) => createPortalFleetInquiry(db, ctx, p), "request");
  post("/events", "events", (ctx, p) => recordPortalAnalyticsEvent(db, ctx, p), "event");
}

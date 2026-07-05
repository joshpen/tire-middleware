import Fastify, { type FastifyInstance } from "fastify";
import { registerApiKeyAuth } from "./auth/apiKey.js";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { applyInventoryRows } from "./domain/inventory.js";
import { processInboundInterchange } from "./edi/service.js";
import { pollEndpoint } from "./files/poller.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildServer(config: Config, db: Db): FastifyInstance {
  const app = Fastify({
    logger: {
      level: "info",
      // Config/credentials never reach logs: no request bodies, no headers.
      redact: ["req.headers.authorization"],
    },
    bodyLimit: 5 * 1024 * 1024,
  });

  // Raw-text bodies for EDI intake.
  for (const type of ["text/plain", "application/edi-x12"]) {
    app.addContentTypeParser(type, { parseAs: "string" }, (_req, body, done) => done(null, body));
  }

  const { authenticate, requireScope } = registerApiKeyAuth(app, db);

  app.get("/healthz", async () => ({ ok: true, service: "tread-sync-gateway" }));

  app.get("/v1/products", { preHandler: [authenticate, requireScope("products:read")] }, async (req) => {
    const orgId = req.apiClient!.org_id;
    const { data, error } = await db
      .from("products")
      .select("sku, name, status, stock_qty, stock_status, bin_location")
      .eq("org_id", orgId)
      .eq("status", "active")
      .order("sku");
    if (error) throw new Error(`products query failed: ${error.message}`);
    return { ok: true, products: data ?? [] };
  });

  app.get<{ Querystring: { status?: string } }>(
    "/v1/orders",
    { preHandler: [authenticate, requireScope("orders:read")] },
    async (req) => {
      const orgId = req.apiClient!.org_id;
      let query = db
        .from("purchase_orders")
        .select(
          "id, po_number, status, total_amount, created_at, ship_to_address, buyer:organizations!purchase_orders_buyer_org_id_fkey(name), lines:purchase_order_lines(sku, name, quantity, unit_price)",
        )
        .eq("seller_org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (req.query.status) query = query.eq("status", req.query.status);
      const { data, error } = await query;
      if (error) throw new Error(`orders query failed: ${error.message}`);
      return {
        ok: true,
        orders: (data ?? []).map((o) => ({
          id: o.id,
          po_number: o.po_number,
          status: o.status,
          total_amount: o.total_amount,
          created_at: o.created_at,
          buyer: o.buyer?.name ?? null,
          ship_to: o.ship_to_address,
          lines: o.lines,
        })),
      };
    },
  );

  app.post<{ Params: { idOrPoNumber: string } }>(
    "/v1/orders/:idOrPoNumber/ack",
    { preHandler: [authenticate, requireScope("orders:write")] },
    async (req, reply) => {
      const orgId = req.apiClient!.org_id;
      const key = req.params.idOrPoNumber;
      let query = db
        .from("purchase_orders")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("seller_org_id", orgId)
        .eq("status", "submitted");
      query = UUID_RE.test(key) ? query.eq("id", key) : query.eq("po_number", key);
      const { data, error } = await query.select("id, po_number");
      if (error) throw new Error(`ack update failed: ${error.message}`);
      if (!data || data.length === 0) {
        req.apiError = "no submitted order matched";
        return reply.code(404).send({ ok: false, status: 404, error: "no submitted order matched" });
      }
      return { ok: true, acknowledged: data.length, orders: data };
    },
  );

  app.post<{ Body: { rows?: { sku?: unknown; qty?: unknown }[] } }>(
    "/v1/inventory",
    { preHandler: [authenticate, requireScope("inventory:write")] },
    async (req, reply) => {
      const orgId = req.apiClient!.org_id;
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
      if (!rows) {
        req.apiError = "body must be {rows:[{sku,qty}]}";
        return reply.code(400).send({ ok: false, status: 400, error: "body must be {rows:[{sku,qty}]}" });
      }
      const clean = rows
        .map((r) => ({ sku: String(r.sku ?? "").trim(), qty: Number(r.qty) }))
        .filter((r) => r.sku && Number.isFinite(r.qty))
        .map((r) => ({ sku: r.sku, qty: Math.trunc(r.qty) }));
      const result = await applyInventoryRows(db, orgId, clean);
      return { ok: true, updated: result.updated, unknown_skus: result.unknownSkus };
    },
  );

  app.post(
    "/v1/edi",
    { preHandler: [authenticate, requireScope("edi:write")] },
    async (req, reply) => {
      const orgId = req.apiClient!.org_id;
      const raw = typeof req.body === "string" ? req.body : null;
      if (!raw || !raw.trimStart().startsWith("ISA")) {
        req.apiError = "body must be an X12 interchange (starts with ISA)";
        return reply
          .code(400)
          .send({ ok: false, status: 400, error: "body must be an X12 interchange (starts with ISA)" });
      }
      const result = await processInboundInterchange(db, orgId, raw);
      if (result.status === "error") {
        req.apiError = result.error;
        return reply.code(422).send({
          ok: false,
          status: 422,
          error: result.error,
          message_id: result.messageId,
          ack_997_id: result.ack997Id,
        });
      }
      return {
        ok: true,
        message_id: result.messageId,
        transaction_set: result.transactionSet,
        order_ids: result.orderIds,
        ack_997_id: result.ack997Id,
      };
    },
  );

  // Manual poll trigger: service-role callers only (deploy operators, hub functions).
  app.post<{ Params: { endpointId: string } }>("/admin/poll/:endpointId", async (req, reply) => {
    const header = req.headers.authorization ?? "";
    const token = header.replace(/^Bearer\s+/i, "").trim();
    if (!token || token !== config.serviceRoleKey) {
      return reply.code(401).send({ ok: false, status: 401, error: "service role key required" });
    }
    const { data: endpoint, error } = await db
      .from("file_endpoints")
      .select("id, org_id, name, kind, file_type, config, created_by")
      .eq("id", req.params.endpointId)
      .maybeSingle();
    if (error) throw new Error(`endpoint lookup failed: ${error.message}`);
    if (!endpoint) return reply.code(404).send({ ok: false, status: 404, error: "endpoint not found" });
    const outcome = await pollEndpoint(db, endpoint);
    return { ok: outcome.status === "success", ...outcome };
  });

  return app;
}

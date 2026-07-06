import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { registerAdminApi } from "./routes/adminApi.js";
import { registerApiKeyAuth } from "./auth/apiKey.js";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { applyInventoryRows } from "./domain/inventory.js";
import { applyDynamicRows, type IngestTarget } from "./dynamic.js";
import { processInboundInterchange } from "./edi/service.js";
import { getExposedObjects, getStockStatusRules } from "./mappings.js";
import { registerAdminRoutes } from "./routes/admin.js";

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
      const rules = await getStockStatusRules(db, orgId);
      const result = await applyInventoryRows(db, orgId, clean, rules);
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
        acknowledged: result.acknowledged,
      };
    },
  );

  // ── Dynamic objects ─────────────────────────────────────────────────────────
  // The exposed surface is declared in the org's gateway config
  // (`exposed_objects`), so new hub tables become API resources without a
  // gateway deploy. Scopes are config-declared per object.

  app.get<{ Params: { key: string }; Querystring: Record<string, string> }>(
    "/v1/objects/:key",
    { preHandler: [authenticate] },
    async (req, reply) => {
      const client = req.apiClient!;
      const objects = await getExposedObjects(db, client.org_id);
      const object = objects[req.params.key];
      if (!object) {
        req.apiError = "unknown object";
        return reply.code(404).send({ ok: false, status: 404, error: `unknown object ${req.params.key}` });
      }
      if (!client.scopes.includes(object.scope)) {
        req.apiError = `missing scope ${object.scope}`;
        return reply.code(403).send({ ok: false, status: 403, error: `missing scope ${object.scope}` });
      }
      let query = (db.from as (t: string) => any)(object.table)
        .select(object.select ?? "*")
        .eq(object.org_column ?? "org_id", client.org_id)
        .limit(Math.min(Number(req.query.limit) || object.limit || 100, 500));
      for (const field of object.filterable_fields ?? []) {
        if (req.query[field] !== undefined) query = query.eq(field, req.query[field]);
      }
      const { data, error } = await query;
      if (error) throw new Error(`${object.table} query failed: ${error.message}`);
      return { ok: true, object: req.params.key, rows: data ?? [] };
    },
  );

  app.post<{ Params: { key: string }; Body: { rows?: Record<string, unknown>[] } }>(
    "/v1/objects/:key",
    { preHandler: [authenticate] },
    async (req, reply) => {
      const client = req.apiClient!;
      const objects = await getExposedObjects(db, client.org_id);
      const object = objects[req.params.key];
      if (!object) {
        req.apiError = "unknown object";
        return reply.code(404).send({ ok: false, status: 404, error: `unknown object ${req.params.key}` });
      }
      const writable = object.writable_fields ?? [];
      if (writable.length === 0 || !object.match_field) {
        req.apiError = "object is read-only";
        return reply.code(405).send({ ok: false, status: 405, error: `object ${req.params.key} is read-only` });
      }
      const writeScope = object.write_scope ?? object.scope;
      if (!client.scopes.includes(writeScope)) {
        req.apiError = `missing scope ${writeScope}`;
        return reply.code(403).send({ ok: false, status: 403, error: `missing scope ${writeScope}` });
      }
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
      if (!rows) {
        req.apiError = "body must be {rows:[...]}";
        return reply.code(400).send({ ok: false, status: 400, error: "body must be {rows:[...]}" });
      }
      // Reuse the ingest engine: match on match_field, patch only writable fields.
      const stringRows = rows.map((r) =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null || v === undefined ? "" : String(v)])),
      );
      const target: IngestTarget = {
        table: object.table,
        org_column: object.org_column ?? "org_id",
        match: { column: object.match_field, field: object.match_field },
        set: Object.fromEntries(writable.map((f) => [f, f])),
      };
      const result = await applyDynamicRows(db, client.org_id, stringRows, target);
      if (result.errors.length) {
        req.apiError = result.errors.join("; ").slice(0, 500);
        return reply.code(422).send({ ok: false, status: 422, error: result.errors.join("; "), ...result });
      }
      return { ok: true, updated: result.updated, inserted: result.inserted, unmatched: result.unmatched };
    },
  );

  registerAdminRoutes(app, config, db);
  registerAdminApi(app, config, db);

  // Admin dashboard (static SPA) at /ui.
  app.register(fastifyStatic, {
    root: join(dirname(fileURLToPath(import.meta.url)), "..", "public", "ui"),
    prefix: "/ui/",
  });
  app.get("/ui", (_req, reply) => reply.redirect("/ui/"));

  return app;
}

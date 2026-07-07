import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Config } from "../config.js";
import type { Db } from "../db.js";
import { getHubConnection, mw, syncCatalog, testConnection } from "../hub/connector.js";
import { generatePortalKey } from "../portal/service.js";
import { processOutbox, requeueDelivery } from "../hub/outbox.js";
import { makeAdminGuard } from "./admin.js";

/**
 * JSON backend for the admin dashboard (public/ui). Everything the gateway
 * can be configured with is reachable here; guarded like the rest of the
 * admin surface (service-role key or GATEWAY_ADMIN_TOKEN).
 */
export function registerAdminApi(app: FastifyInstance, config: Config, db: Db) {
  const guard = makeAdminGuard(config);
  const opts = { preHandler: [guard] };

  /** created_by columns need an auth user; use the first profile. */
  async function anyUserId(): Promise<string> {
    const { data, error } = await db.from("profiles").select("id").limit(1).single();
    if (error || !data) throw new Error("no profile found to attribute created_by");
    return data.id;
  }

  // ── Overview ────────────────────────────────────────────────────────────────

  app.get("/admin/api/overview", opts, async () => {
    const count = async (table: "api_clients" | "edi_partners" | "file_endpoints") => {
      const { count: n } = await db.from(table).select("*", { count: "exact", head: true });
      return n ?? 0;
    };
    const { data: messages } = await db
      .from("edi_messages")
      .select("direction, status")
      .order("created_at", { ascending: false })
      .limit(1000);
    const byStatus: Record<string, number> = {};
    for (const m of messages ?? []) byStatus[`${m.direction}:${m.status}`] = (byStatus[`${m.direction}:${m.status}`] ?? 0) + 1;
    const { data: unack } = await db
      .from("edi_messages")
      .select("id")
      .eq("direction", "outbound")
      .in("status", ["generated", "sent"])
      .neq("transaction_set", "997");
    const { data: runs } = await db
      .from("integration_runs")
      .select("status, started_at, records_processed, detail, org:organizations(name)")
      .order("started_at", { ascending: false })
      .limit(10);
    return {
      ok: true,
      clients: await count("api_clients"),
      partners: await count("edi_partners"),
      endpoints: await count("file_endpoints"),
      messages_by_status: byStatus,
      unacknowledged: (unack ?? []).length,
      recent_runs: runs ?? [],
    };
  });

  app.get("/admin/api/orgs", opts, async () => {
    const { data, error } = await db.from("organizations").select("id, name, type").order("name").limit(500);
    if (error) throw new Error(error.message);
    return { ok: true, orgs: data ?? [] };
  });

  // ── API clients ─────────────────────────────────────────────────────────────

  app.get("/admin/api/clients", opts, async () => {
    const { data, error } = await db
      .from("api_clients")
      .select("id, org_id, name, key_prefix, scopes, rate_limit_per_min, is_active, expires_at, last_used_at, created_at, org:organizations(name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { ok: true, clients: data ?? [] };
  });

  app.post<{ Body: { org_id?: string; name?: string; scopes?: string[]; rate_limit_per_min?: number; expires_at?: string | null } }>(
    "/admin/api/clients",
    opts,
    async (req, reply) => {
      const { org_id, name, scopes, rate_limit_per_min, expires_at } = req.body ?? {};
      if (!org_id || !name || !Array.isArray(scopes)) {
        return reply.code(400).send({ ok: false, error: "org_id, name, scopes[] required" });
      }
      const key = `trk_live_${randomBytes(24).toString("hex")}`;
      const { data, error } = await db
        .from("api_clients")
        .insert({
          org_id,
          name,
          scopes,
          key_prefix: key.slice(0, 12) + "…",
          key_hash: createHash("sha256").update(key, "utf8").digest("hex"),
          rate_limit_per_min: rate_limit_per_min ?? 120,
          expires_at: expires_at || null,
          created_by: await anyUserId(),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      // The plaintext key is returned exactly once; only the hash is stored.
      return { ok: true, id: data.id, api_key: key };
    },
  );

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/admin/api/clients/:id",
    opts,
    async (req) => {
      const allowed = ["name", "scopes", "rate_limit_per_min", "is_active", "expires_at"];
      const patch = Object.fromEntries(Object.entries(req.body ?? {}).filter(([k]) => allowed.includes(k)));
      const { error } = await db.from("api_clients").update(patch as never).eq("id", req.params.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    },
  );

  // ── EDI partners + per-partner mapping ──────────────────────────────────────

  app.get("/admin/api/partners", opts, async () => {
    const { data, error } = await db
      .from("edi_partners")
      .select("id, org_id, name, isa_qualifier, isa_id, partner_org_id, is_active, notes, created_at, org:organizations!edi_partners_org_id_fkey(name), partner_org:organizations!edi_partners_partner_org_id_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { ok: true, partners: data ?? [] };
  });

  app.post<{ Body: { org_id?: string; name?: string; isa_qualifier?: string; isa_id?: string; partner_org_id?: string | null; notes?: string } }>(
    "/admin/api/partners",
    opts,
    async (req, reply) => {
      const { org_id, name, isa_qualifier, isa_id, partner_org_id, notes } = req.body ?? {};
      if (!org_id || !name || !isa_id) {
        return reply.code(400).send({ ok: false, error: "org_id, name, isa_id required" });
      }
      const { data, error } = await db
        .from("edi_partners")
        .insert({ org_id, name, isa_qualifier: isa_qualifier || "ZZ", isa_id, partner_org_id: partner_org_id || null, notes: notes || null })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    },
  );

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/admin/api/partners/:id",
    opts,
    async (req) => {
      const allowed = ["name", "isa_qualifier", "isa_id", "partner_org_id", "is_active", "notes"];
      const patch = Object.fromEntries(Object.entries(req.body ?? {}).filter(([k]) => allowed.includes(k)));
      const { error } = await db.from("edi_partners").update(patch as never).eq("id", req.params.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    },
  );

  // ── Org gateway config (edi_mappings, exposed_objects, stock_status_rules) ──

  const PROVIDER_KEY = "file_gateway";

  async function orgConfigRow(orgId: string) {
    let { data: provider } = await db.from("integration_providers").select("id").eq("key", PROVIDER_KEY).maybeSingle();
    if (!provider) {
      const { data, error } = await db
        .from("integration_providers")
        .insert({ key: PROVIDER_KEY, name: "Integration gateway", category: "custom", capabilities: ["file_poll"], sort_order: 900 })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      provider = data;
    }
    let { data: instance } = await db
      .from("org_integrations")
      .select("id, config")
      .eq("org_id", orgId)
      .eq("provider_id", provider.id)
      .maybeSingle();
    if (!instance) {
      const { data, error } = await db
        .from("org_integrations")
        .insert({ org_id: orgId, provider_id: provider.id, status: "active", enabled_capabilities: ["file_poll"], created_by: await anyUserId() })
        .select("id, config")
        .single();
      if (error) throw new Error(error.message);
      instance = data;
    }
    return instance;
  }

  app.get<{ Params: { orgId: string } }>("/admin/api/org-config/:orgId", opts, async (req) => {
    const row = await orgConfigRow(req.params.orgId);
    return { ok: true, config: row.config ?? {} };
  });

  app.put<{ Params: { orgId: string }; Body: { config?: Record<string, unknown> } }>(
    "/admin/api/org-config/:orgId",
    opts,
    async (req, reply) => {
      const next = req.body?.config;
      if (!next || typeof next !== "object" || Array.isArray(next)) {
        return reply.code(400).send({ ok: false, error: "body must be {config: {...}}" });
      }
      const row = await orgConfigRow(req.params.orgId);
      const { error } = await db.from("org_integrations").update({ config: next as never }).eq("id", row.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    },
  );

  // ── File endpoints ──────────────────────────────────────────────────────────

  app.get("/admin/api/endpoints", opts, async () => {
    const { data, error } = await db
      .from("file_endpoints")
      .select("id, org_id, name, kind, file_type, is_active, config, last_polled_at, last_error, created_at, org:organizations(name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    // Mask credential fields; the UI edits them via explicit overwrite only.
    const masked = (data ?? []).map((e) => {
      const cfg = { ...((e.config ?? {}) as Record<string, unknown>) };
      for (const key of ["password", "private_key", "auth_header"]) if (cfg[key]) cfg[key] = "•••";
      return { ...e, config: cfg };
    });
    return { ok: true, endpoints: masked };
  });

  app.post<{ Body: { org_id?: string; name?: string; kind?: string; file_type?: string; config?: Record<string, unknown> } }>(
    "/admin/api/endpoints",
    opts,
    async (req, reply) => {
      const { org_id, name, kind, file_type, config: cfg } = req.body ?? {};
      if (!org_id || !name || !kind) {
        return reply.code(400).send({ ok: false, error: "org_id, name, kind required" });
      }
      const { data, error } = await db
        .from("file_endpoints")
        .insert({
          org_id,
          name,
          kind,
          file_type: file_type || "auto",
          config: (cfg ?? {}) as never,
          created_by: await anyUserId(),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    },
  );

  app.patch<{ Params: { id: string }; Body: { name?: string; kind?: string; file_type?: string; is_active?: boolean; config?: Record<string, unknown> } }>(
    "/admin/api/endpoints/:id",
    opts,
    async (req, reply) => {
      const { data: existing, error: findError } = await db
        .from("file_endpoints")
        .select("config")
        .eq("id", req.params.id)
        .maybeSingle();
      if (findError) throw new Error(findError.message);
      if (!existing) return reply.code(404).send({ ok: false, error: "endpoint not found" });

      const body = req.body ?? {};
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const key of ["name", "kind", "file_type", "is_active"] as const) {
        if (body[key] !== undefined) patch[key] = body[key];
      }
      if (body.config) {
        // Merge, preserving stored credentials when the UI sends the mask.
        const current = (existing.config ?? {}) as Record<string, unknown>;
        const next = { ...current, ...body.config };
        for (const key of ["password", "private_key", "auth_header"]) {
          if (next[key] === "•••") next[key] = current[key];
          if (next[key] === "" || next[key] === null) delete next[key];
        }
        patch.config = next;
      }
      const { error } = await db.from("file_endpoints").update(patch as never).eq("id", req.params.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    },
  );

  // ── EDI message ledger ──────────────────────────────────────────────────────

  app.get<{ Querystring: { org_id?: string; direction?: string; status?: string; set?: string; limit?: string } }>(
    "/admin/api/messages",
    opts,
    async (req) => {
      let query = db
        .from("edi_messages")
        .select("id, org_id, partner_id, direction, transaction_set, control_number, status, error, created_at, processed_at, related_order_id, partner:edi_partners(name)")
        .order("created_at", { ascending: false })
        .limit(Math.min(Number(req.query.limit) || 100, 500));
      if (req.query.org_id) query = query.eq("org_id", req.query.org_id);
      if (req.query.direction) query = query.eq("direction", req.query.direction);
      if (req.query.status) query = query.eq("status", req.query.status);
      if (req.query.set) query = query.eq("transaction_set", req.query.set);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return { ok: true, messages: data ?? [] };
    },
  );

  app.get<{ Params: { id: string } }>("/admin/api/messages/:id", opts, async (req, reply) => {
    const { data, error } = await db.from("edi_messages").select("*").eq("id", req.params.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return reply.code(404).send({ ok: false, error: "message not found" });
    return { ok: true, message: data };
  });

  // ── Hub connections + delivery outbox ───────────────────────────────────────

  app.get("/admin/api/hub-connections", opts, async () => {
    const { data, error } = await mw(db, "hub_connections")
      .select("id, org_id, name, hub_url, is_active, last_ok_at, last_error, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { ok: true, connections: data ?? [] };
  });

  app.post<{ Body: { org_id?: string; name?: string; hub_url?: string; anon_key?: string; api_key?: string } }>(
    "/admin/api/hub-connections",
    opts,
    async (req, reply) => {
      const { org_id, name, hub_url, anon_key, api_key } = req.body ?? {};
      if (!org_id || !hub_url || !anon_key || !api_key) {
        return reply.code(400).send({ ok: false, error: "org_id, hub_url, anon_key, api_key required" });
      }
      const { data, error } = await mw(db, "hub_connections")
        .upsert(
          { org_id, name: name || "tread-sync-hub", hub_url, anon_key, api_key, is_active: true, updated_at: new Date().toISOString() },
          { onConflict: "org_id" },
        )
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    },
  );

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/admin/api/hub-connections/:id",
    opts,
    async (req) => {
      const allowed = ["name", "hub_url", "anon_key", "api_key", "is_active"];
      const patch = Object.fromEntries(
        Object.entries(req.body ?? {}).filter(([k, v]) => allowed.includes(k) && v !== "" && v !== "•••"),
      );
      const { error } = await mw(db, "hub_connections")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", req.params.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    },
  );

  app.post<{ Params: { orgId: string } }>("/admin/hub/test/:orgId", opts, async (req, reply) => {
    const conn = await getHubConnection(db, req.params.orgId);
    if (!conn) return reply.code(404).send({ ok: false, error: "no active hub connection for org" });
    const result = await testConnection(db, conn);
    return { ok: result.ok, status: result.status, products: result.products, error: result.error ?? null };
  });

  app.post<{ Params: { orgId: string } }>("/admin/hub/sync-catalog/:orgId", opts, async (req, reply) => {
    const conn = await getHubConnection(db, req.params.orgId);
    if (!conn) return reply.code(404).send({ ok: false, error: "no active hub connection for org" });
    const result = await syncCatalog(db, conn);
    return { ok: !result.error, ...result };
  });

  app.get<{ Querystring: { status?: string; org_id?: string; limit?: string } }>(
    "/admin/api/deliveries",
    opts,
    async (req) => {
      let query = mw(db, "hub_deliveries")
        .select("id, org_id, resource, status, attempts, next_at, last_error, created_at, delivered_at, related_message_id")
        .order("created_at", { ascending: false })
        .limit(Math.min(Number(req.query.limit) || 100, 500));
      if (req.query.status) query = query.eq("status", req.query.status);
      if (req.query.org_id) query = query.eq("org_id", req.query.org_id);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return { ok: true, deliveries: data ?? [] };
    },
  );

  app.post("/admin/hub/outbox/process", opts, async () => {
    const outcomes = await processOutbox(db);
    return { ok: true, outcomes };
  });

  app.post<{ Params: { id: string } }>("/admin/hub/deliveries/:id/retry", opts, async (req, reply) => {
    const found = await requeueDelivery(db, req.params.id);
    if (!found) return reply.code(404).send({ ok: false, error: "delivery not found or not retryable" });
    const outcomes = await processOutbox(db);
    return { ok: true, outcomes };
  });

  // ── Headless portal management ──────────────────────────────────────────────

  app.get<{ Params: { orgId: string } }>("/admin/api/portal-settings/:orgId", opts, async (req) => {
    const { data } = await mw(db, "dealer_portal_settings").select("*").eq("dealer_id", req.params.orgId).maybeSingle();
    return { ok: true, settings: data ?? null };
  });

  app.put<{ Params: { orgId: string }; Body: Record<string, unknown> }>(
    "/admin/api/portal-settings/:orgId",
    opts,
    async (req, reply) => {
      const allowed = [
        "slug", "portal_enabled", "headless_enabled", "quote_enabled", "booking_enabled", "warranty_enabled",
        "fleet_enabled", "services_enabled", "promotions_enabled", "catalog_enabled", "allowed_origins",
        "iframe_allowed_origins", "custom_domain", "profile",
      ];
      const patch = Object.fromEntries(Object.entries(req.body ?? {}).filter(([k]) => allowed.includes(k)));
      if (typeof patch.slug === "string") patch.slug = patch.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      if (!patch.slug) return reply.code(400).send({ ok: false, error: "slug is required" });
      const { data, error } = await mw(db, "dealer_portal_settings")
        .upsert({ dealer_id: req.params.orgId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "dealer_id" })
        .select("id, slug")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, ...data };
    },
  );

  app.get<{ Querystring: { dealer_id?: string } }>("/admin/api/portal-keys", opts, async (req) => {
    let query = mw(db, "portal_api_keys")
      .select("id, dealer_id, token_prefix, label, allowed_origins, allowed_modules, rate_limit, status, last_used_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (req.query.dealer_id) query = query.eq("dealer_id", req.query.dealer_id);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true, keys: data ?? [] };
  });

  app.post<{ Body: { dealer_id?: string; label?: string; allowed_modules?: string[]; allowed_origins?: string[]; per_minute?: number } }>(
    "/admin/api/portal-keys",
    opts,
    async (req, reply) => {
      const { dealer_id, label, allowed_modules, allowed_origins, per_minute } = req.body ?? {};
      if (!dealer_id || !label) return reply.code(400).send({ ok: false, error: "dealer_id and label required" });
      const key = generatePortalKey();
      const { data, error } = await mw(db, "portal_api_keys")
        .insert({
          dealer_id,
          token_prefix: key.prefix,
          hashed_token: key.hash,
          label,
          allowed_modules: allowed_modules ?? ["quote", "booking", "warranty", "fleet", "services", "promotions", "catalog", "events"],
          allowed_origins: allowed_origins ?? [],
          rate_limit: { per_minute: per_minute ?? 120 },
          created_by: "admin",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      // Raw key shown once; only the hash is stored.
      return { ok: true, id: data.id, portal_key: key.raw };
    },
  );

  app.patch<{ Params: { id: string }; Body: { status?: string; label?: string; allowed_modules?: string[]; allowed_origins?: string[] } }>(
    "/admin/api/portal-keys/:id",
    opts,
    async (req, reply) => {
      const allowed = ["status", "label", "allowed_modules", "allowed_origins"];
      const patch = Object.fromEntries(Object.entries(req.body ?? {}).filter(([k]) => allowed.includes(k)));
      if (patch.status && !["active", "disabled", "revoked"].includes(String(patch.status))) {
        return reply.code(400).send({ ok: false, error: "status must be active|disabled|revoked" });
      }
      const { error } = await mw(db, "portal_api_keys")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", req.params.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    },
  );

  app.get<{ Querystring: { dealer_id?: string; type?: string; status?: string; limit?: string } }>(
    "/admin/api/portal-requests",
    opts,
    async (req) => {
      let query = mw(db, "portal_requests")
        .select("id, dealer_id, type, status, source, customer_name, customer_email, customer_phone, payload, origin, created_at")
        .order("created_at", { ascending: false })
        .limit(Math.min(Number(req.query.limit) || 100, 500));
      if (req.query.dealer_id) query = query.eq("dealer_id", req.query.dealer_id);
      if (req.query.type) query = query.eq("type", req.query.type);
      if (req.query.status) query = query.eq("status", req.query.status);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return { ok: true, requests: data ?? [] };
    },
  );

  app.patch<{ Params: { id: string }; Body: { status?: string } }>(
    "/admin/api/portal-requests/:id",
    opts,
    async (req, reply) => {
      const status = req.body?.status;
      if (!status || !["new", "reviewed", "converted", "closed", "spam"].includes(status)) {
        return reply.code(400).send({ ok: false, error: "status must be new|reviewed|converted|closed|spam" });
      }
      const { error } = await mw(db, "portal_requests")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", req.params.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    },
  );

  // ── Request logs + integration runs ─────────────────────────────────────────

  app.get<{ Querystring: { limit?: string; status?: string } }>("/admin/api/logs", opts, async (req) => {
    let query = db
      .from("api_request_logs")
      .select("id, client_id, org_id, resource, status, duration_ms, error, created_at, client:api_clients(name)")
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(req.query.limit) || 100, 500));
    if (req.query.status) query = query.eq("status", Number(req.query.status));
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true, logs: data ?? [] };
  });

  app.get<{ Querystring: { limit?: string } }>("/admin/api/runs", opts, async (req) => {
    const { data, error } = await db
      .from("integration_runs")
      .select("id, org_id, capability, status, records_processed, detail, started_at, finished_at, org:organizations(name)")
      .order("started_at", { ascending: false })
      .limit(Math.min(Number(req.query.limit) || 100, 500));
    if (error) throw new Error(error.message);
    return { ok: true, runs: data ?? [] };
  });
}

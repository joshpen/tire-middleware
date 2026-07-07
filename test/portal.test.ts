import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Db } from "../src/db.js";
import { sha256 } from "../src/portal/service.js";
import { buildServer } from "../src/server.js";

const DEALER_A = randomUUID();
const DEALER_B = randomUUID();
const KEY_A = "pk_portal_dealer_aaaa1111";
const KEY_B = "pk_portal_dealer_bbbb2222";
const KEY_DISABLED = "pk_portal_dealer_disabled";
const KEY_REVOKED = "pk_portal_dealer_revoked";

const settingsRow = (dealerId: string, slug: string, overrides: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  dealer_id: dealerId,
  slug,
  portal_enabled: true,
  headless_enabled: true,
  quote_enabled: true,
  booking_enabled: true,
  warranty_enabled: slug === "northwest-ag-tire",
  fleet_enabled: slug === "northwest-ag-tire",
  services_enabled: true,
  promotions_enabled: true,
  catalog_enabled: true,
  allowed_origins: ["https://dealer-site.example"],
  profile: {
    display_name: slug,
    brand: { accent_color: "#16a34a" },
    services: [{ key: "ag", label: "Ag tires" }],
    // Deliberately hostile content shape: these fields must never surface.
    catalog_categories: [{ key: "ag", label: "Agricultural" }],
  },
  ...overrides,
});

const keyRow = (dealerId: string, raw: string, status = "active", modules?: string[]) => ({
  id: randomUUID(),
  dealer_id: dealerId,
  hashed_token: sha256(raw),
  allowed_origins: [],
  allowed_modules: modules ?? ["quote", "booking", "warranty", "fleet", "services", "promotions", "catalog", "events"],
  rate_limit: { per_minute: 1000 },
  status,
});

/** In-memory supabase-ish fake covering the chains the portal layer uses. */
function memDb(tables: Record<string, Record<string, unknown>[]>): Db {
  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    let op: "select" | "insert" | "update" = "select";
    let insertRow: Record<string, unknown> | null = null;
    let patch: Record<string, unknown> | null = null;
    const rowsOf = () => tables[table] ?? [];
    const match = () => rowsOf().filter((r) => filters.every(([c, v]) => r[c] === v));
    const exec = () => {
      if (op === "insert") {
        const row = { id: randomUUID(), status: "new", ...insertRow };
        (tables[table] ??= []).push(row);
        return [row];
      }
      if (op === "update") {
        const m = match();
        m.forEach((r) => Object.assign(r, patch));
        return m;
      }
      return match();
    };
    const b: Record<string, unknown> = {};
    for (const m of ["select", "order", "limit", "in", "lte", "neq", "not", "or"]) b[m] = () => b;
    b.eq = (c: string, v: unknown) => (filters.push([c, v]), b);
    b.ilike = (c: string, v: unknown) => (filters.push([c, v]), b);
    b.insert = (r: Record<string, unknown>) => ((op = "insert"), (insertRow = r), b);
    b.update = (p: Record<string, unknown>) => ((op = "update"), (patch = p), b);
    b.upsert = (r: Record<string, unknown>) => ((op = "insert"), (insertRow = r), b);
    b.maybeSingle = async () => ({ data: exec()[0] ?? null, error: null });
    b.single = async () => ({ data: exec()[0] ?? null, error: null });
    b.then = (resolve: (v: unknown) => void) => Promise.resolve({ data: exec(), error: null }).then(resolve);
    return b;
  };
  return { from } as unknown as Db;
}

interface Tables {
  [k: string]: Record<string, unknown>[];
  dealer_portal_settings: Record<string, unknown>[];
  portal_api_keys: Record<string, unknown>[];
  portal_requests: Record<string, unknown>[];
  portal_events: Record<string, unknown>[];
  hub_connections: Record<string, unknown>[];
  products: Record<string, unknown>[];
}

describe("headless portal API", () => {
  let app: FastifyInstance;
  let tables: Tables;

  beforeAll(async () => {
    tables = {
      dealer_portal_settings: [
        settingsRow(DEALER_A, "northwest-ag-tire"),
        settingsRow(DEALER_B, "metro-tire-service", { warranty_enabled: false, fleet_enabled: false }),
      ],
      portal_api_keys: [
        keyRow(DEALER_A, KEY_A),
        keyRow(DEALER_B, KEY_B),
        keyRow(DEALER_A, KEY_DISABLED, "disabled"),
        keyRow(DEALER_A, KEY_REVOKED, "revoked"),
      ],
      portal_requests: [],
      portal_events: [],
      hub_connections: [],
      products: [],
    };
    app = buildServer(
      { supabaseUrl: "http://localhost", serviceRoleKey: "srk", port: 0, host: "127.0.0.1", pollCron: "", adminToken: null },
      memDb(tables),
    );
    await app.ready();
  });

  afterAll(() => app.close());

  const call = (slug: string, path: string, key: string | null, opts: { method?: string; body?: unknown; origin?: string | null } = {}) =>
    app.inject({
      method: (opts.method ?? "GET") as "GET",
      url: `/api/portal/v1/dealers/${slug}${path}`,
      headers: {
        ...(key ? { "x-portal-key": key } : {}),
        ...(opts.origin === null ? {} : { origin: opts.origin ?? "https://dealer-site.example" }),
        "content-type": "application/json",
      },
      payload: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });

  it("returns only portal-safe profile fields", async () => {
    const res = await call("northwest-ag-tire", "", KEY_A);
    expect(res.statusCode).toBe(200);
    const dealer = res.json().dealer;
    expect(dealer.slug).toBe("northwest-ag-tire");
    expect(dealer.modules.warranty).toBe(true);
    const keys = Object.keys(dealer);
    for (const forbidden of ["cost", "margin", "supplier", "customers", "inventory", "dealer_id", "id"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("dealer A's key cannot access dealer B's portal", async () => {
    const res = await call("metro-tire-service", "", KEY_A);
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("invalid portal key");
  });

  it("rejects disabled and revoked keys", async () => {
    expect((await call("northwest-ag-tire", "", KEY_DISABLED)).statusCode).toBe(401);
    expect((await call("northwest-ag-tire", "", KEY_REVOKED)).statusCode).toBe(401);
  });

  it("rejects unknown origins but allows localhost for development", async () => {
    const bad = await call("northwest-ag-tire", "/services", KEY_A, { origin: "https://evil.example" });
    expect(bad.statusCode).toBe(403);
    expect(bad.json().error).toBe("origin not allowed");
    const dev = await call("northwest-ag-tire", "/services", KEY_A, { origin: "http://localhost:3000" });
    expect(dev.statusCode).toBe(200);
  });

  it("rejects requests without an origin header", async () => {
    const res = await call("northwest-ag-tire", "/services", KEY_A, { origin: null });
    expect(res.statusCode).toBe(403);
  });

  it("blocks modules disabled for the dealer", async () => {
    const res = await call("metro-tire-service", "/warranty-intake", KEY_B, {
      method: "POST",
      body: { customer_name: "X", customer_email: "x@y.com", tire_info: "T", issue_description: "d" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/warranty is not enabled/);
  });

  it("blocks modules disabled for the key", async () => {
    tables.portal_api_keys.push(keyRow(DEALER_A, "pk_portal_dealer_quoteonly", "active", ["quote", "events"]));
    const res = await call("northwest-ag-tire", "/fleet-inquiries", "pk_portal_dealer_quoteonly", {
      method: "POST",
      body: { business_name: "B", contact_person: "C", customer_email: "c@d.com" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("quote request creates only a portal request — no product/inventory mutation", async () => {
    const before = tables.portal_requests.length;
    const res = await call("northwest-ag-tire", "/quote-requests", KEY_A, {
      method: "POST",
      body: { customer_name: "Sam Farmer", customer_email: "sam@farm.example", tire_size: "480/80R46", quantity: 2 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().request.type).toBe("quote");
    expect(tables.portal_requests.length).toBe(before + 1);
    const saved = tables.portal_requests.at(-1)!;
    expect(saved.dealer_id).toBe(DEALER_A);
    expect(saved.customer_email).toBe("sam@farm.example");
    expect(tables.products.length).toBe(0);
  });

  it("warranty intake stores a request and never sets an approval status", async () => {
    const res = await call("northwest-ag-tire", "/warranty-intake", KEY_A, {
      method: "POST",
      body: { customer_name: "P", customer_phone: "555-201-9922", tire_info: "480/80R46", issue_description: "sidewall crack" },
    });
    expect(res.statusCode).toBe(201);
    const saved = tables.portal_requests.at(-1)!;
    expect(saved.type).toBe("warranty");
    expect(saved.status).toBe("new");
    expect(JSON.stringify(saved.payload)).not.toMatch(/approved|reimburs/i);
  });

  it("fleet inquiry creates the correct request type", async () => {
    const res = await call("northwest-ag-tire", "/fleet-inquiries", KEY_A, {
      method: "POST",
      body: { business_name: "Basin Harvest Co", contact_person: "Ana", customer_email: "ana@basin.example", fleet_size: 22 },
    });
    expect(res.statusCode).toBe(201);
    expect(tables.portal_requests.at(-1)!.type).toBe("fleet");
  });

  it("validates contact formats and requires reachable contact info", async () => {
    const badEmail = await call("northwest-ag-tire", "/quote-requests", KEY_A, {
      method: "POST",
      body: { customer_name: "X", customer_email: "not-an-email" },
    });
    expect(badEmail.statusCode).toBe(400);
    const noContact = await call("northwest-ag-tire", "/quote-requests", KEY_A, {
      method: "POST",
      body: { customer_name: "X" },
    });
    expect(noContact.statusCode).toBe(400);
  });

  it("sanitizes HTML out of free-text fields", async () => {
    await call("northwest-ag-tire", "/quote-requests", KEY_A, {
      method: "POST",
      body: { customer_name: "<script>alert(1)</script>Sam", customer_email: "s@x.com", notes: "<img src=x onerror=1>hello" },
    });
    const saved = tables.portal_requests.at(-1)!;
    expect(saved.customer_name).not.toMatch(/</);
    expect((saved.payload as { notes: string }).notes).not.toMatch(/</);
  });

  it("catalog categories expose labels only — no cost/margin/supplier fields", async () => {
    const res = await call("northwest-ag-tire", "/catalog-categories", KEY_A);
    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(res.json().categories)).not.toMatch(/cost|margin|supplier/i);
  });

  it("accepts known analytics events and rejects unknown ones", async () => {
    const ok = await call("northwest-ag-tire", "/events", KEY_A, {
      method: "POST",
      body: { event_name: "quote_started", module: "quote" },
    });
    expect(ok.statusCode).toBe(201);
    const bad = await call("northwest-ag-tire", "/events", KEY_A, {
      method: "POST",
      body: { event_name: "steal_data" },
    });
    expect(bad.statusCode).toBe(400);
  });

  it("enforces the key rate limit", async () => {
    tables.portal_api_keys.push({ ...keyRow(DEALER_B, "pk_portal_dealer_tiny"), rate_limit: { per_minute: 2 } });
    const hit = () => call("metro-tire-service", "/services", "pk_portal_dealer_tiny");
    expect((await hit()).statusCode).toBe(200);
    expect((await hit()).statusCode).toBe(200);
    expect((await hit()).statusCode).toBe(429);
  });

  it("unknown dealer slug 404s without leaking anything", async () => {
    const res = await call("no-such-dealer", "", KEY_A);
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("dealer portal not found");
  });
});

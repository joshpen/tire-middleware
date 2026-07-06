import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { sha256Hex } from "../src/auth/apiKey.js";
import { buildServer } from "../src/server.js";
import type { Db } from "../src/db.js";

const API_KEY = "trk_test_abc123";
const CLIENT = {
  id: "11111111-1111-4111-8111-111111111111",
  org_id: "22222222-2222-4222-8222-222222222222",
  name: "test client",
  scopes: ["products:read"],
  rate_limit_per_min: 3,
};
const PRODUCTS = [
  { sku: "LT245-75R17-E", name: "AT tire", status: "active", stock_qty: 12, stock_status: "in_stock", bin_location: "A1" },
];

/**
 * Minimal thenable query-builder stub covering the chains the auth layer and
 * the products route use. Every chained method returns the builder; awaiting
 * it (or calling maybeSingle) resolves canned data per table.
 */
function fakeDb(log: { requests: unknown[] }): Db {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    const chain = [
      "select", "eq", "or", "not", "is", "order", "limit", "update", "ilike",
    ];
    for (const m of chain) b[m] = () => b;
    b.insert = (row: unknown) => {
      if (table === "api_request_logs") log.requests.push(row);
      return b;
    };
    b.maybeSingle = async () => {
      if (table === "api_clients") {
        // The auth layer looks up by key_hash; our stub only knows one client.
        return lookupHash === sha256Hex(API_KEY) ? { data: CLIENT, error: null } : { data: null, error: null };
      }
      return { data: null, error: null };
    };
    b.single = async () => ({ data: { id: "row-id" }, error: null });
    b.then = (resolve: (v: unknown) => void) => {
      const data = table === "products" ? PRODUCTS : null;
      return Promise.resolve({ data, error: null }).then(resolve);
    };
    return b;
  };
  let lookupHash = "";
  return {
    from: (table: string) => {
      const b = builder(table) as Record<string, unknown>;
      if (table === "api_clients") {
        b.eq = (col: string, value: string) => {
          if (col === "key_hash") lookupHash = value;
          return b;
        };
      }
      return b;
    },
  } as unknown as Db;
}

describe("gateway auth + routes", () => {
  let app: FastifyInstance;
  const log = { requests: [] as unknown[] };

  beforeAll(async () => {
    const config = {
      supabaseUrl: "http://localhost",
      serviceRoleKey: "service-role-secret",
      port: 0,
      host: "127.0.0.1",
      pollCron: "",
      adminToken: null,
    };
    app = buildServer(config, fakeDb(log));
    await app.ready();
  });

  afterAll(() => app.close());

  it("GET /healthz needs no auth", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });

  it("401 without a bearer token", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/products" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/bearer/);
  });

  it("401 with an unknown key", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/products",
      headers: { authorization: "Bearer nope" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/invalid api key/);
  });

  it("200 with a valid key and scope, and logs the request", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/products",
      headers: { authorization: `Bearer ${API_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().products).toEqual(PRODUCTS);
    const logged = log.requests.at(-1) as { status: number; resource: string; client_id: string };
    expect(logged).toMatchObject({ status: 200, resource: "GET /v1/products", client_id: CLIENT.id });
  });

  it("403 when the key lacks the scope", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/orders",
      headers: { authorization: `Bearer ${API_KEY}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("missing scope orders:read");
  });

  it("429 once the sliding window fills", async () => {
    // rate_limit_per_min is 3; earlier tests consumed 2 allowed slots.
    const first = await app.inject({
      method: "GET",
      url: "/v1/products",
      headers: { authorization: `Bearer ${API_KEY}` },
    });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({
      method: "GET",
      url: "/v1/products",
      headers: { authorization: `Bearer ${API_KEY}` },
    });
    expect(second.statusCode).toBe(429);
    expect(second.json().error).toMatch(/rate limit/);
    const logged = log.requests.at(-1) as { status: number };
    expect(logged.status).toBe(429);
  });

  it("401 on /admin/poll without the service-role key", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/admin/poll/33333333-3333-4333-8333-333333333333",
      headers: { authorization: `Bearer ${API_KEY}` },
    });
    expect(res.statusCode).toBe(401);
  });
});

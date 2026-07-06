import { afterEach, describe, expect, it, vi } from "vitest";
import { callHub, type HubConnection } from "../src/hub/connector.js";

const conn: HubConnection = {
  id: "c1",
  org_id: "org-1",
  name: "hub",
  hub_url: "https://hub.example.supabase.co/",
  anon_key: "anon-key",
  api_key: "trk_live_secret",
  is_active: true,
  last_ok_at: null,
  last_error: null,
};

afterEach(() => vi.restoreAllMocks());

describe("callHub", () => {
  it("posts the api_gateway envelope with PostgREST headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, status: 200, data: { products: [] } }), { status: 200 }),
    );
    const result = await callHub(conn, "products.list", {});
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://hub.example.supabase.co/rest/v1/rpc/api_gateway");
    expect((init!.headers as Record<string, string>).apikey).toBe("anon-key");
    expect(JSON.parse(init!.body as string)).toEqual({
      api_key: "trk_live_secret",
      resource: "products.list",
      payload: {},
    });
  });

  it("passes through the hub's own error envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, status: 403, error: "missing scope orders:write" }), { status: 200 }),
    );
    const result = await callHub(conn, "orders.ack", { po_number: "X" });
    expect(result).toMatchObject({ ok: false, status: 403, error: "missing scope orders:write" });
  });

  it("reports transport failures without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad gateway", { status: 502 }));
    const result = await callHub(conn, "products.list");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/transport error 502/);
  });

  it("throws on network failure so callers can queue", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    await expect(callHub(conn, "products.list")).rejects.toThrow("fetch failed");
  });
});

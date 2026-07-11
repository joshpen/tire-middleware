import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { processOutbox, requeueUnsupported } from "../src/hub/outbox.js";
import { memDb } from "./memDb.js";

const ORG = randomUUID();

interface Tables {
  [k: string]: Record<string, unknown>[];
  hub_deliveries: Record<string, unknown>[];
}

const connectionRow = () => ({
  id: randomUUID(),
  org_id: ORG,
  name: "hub",
  hub_url: "https://hub.example.supabase.co",
  anon_key: "anon",
  api_key: "trk_live_secret",
  is_active: true,
  last_ok_at: null,
  last_error: null,
});

afterEach(() => vi.restoreAllMocks());

describe("outbox", () => {
  it("stamps the hub's conversion result on the portal request when a portal intake delivers", async () => {
    const requestId = randomUUID();
    const recordId = randomUUID();
    const tables: Tables & { portal_requests: Record<string, unknown>[] } = {
      hub_connections: [connectionRow()],
      portal_requests: [{ id: requestId, dealer_id: ORG, type: "quote", status: "new" }],
      hub_deliveries: [
        {
          id: randomUUID(),
          org_id: ORG,
          resource: "portal.quote.create",
          payload: { portal_request_id: requestId, type: "quote" },
          status: "pending",
          attempts: 0,
          last_error: null,
        },
      ],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          status: 200,
          data: { portal_request_id: requestId, created_record_id: recordId, record_type: "lead" },
        }),
        { status: 200 },
      ),
    );

    const outcomes = await processOutbox(memDb(tables));
    expect(outcomes.delivered).toBe(1);
    expect(tables.hub_deliveries[0]!.status).toBe("delivered");
    expect(tables.portal_requests[0]).toMatchObject({ hub_record_id: recordId, hub_record_type: "lead" });
  });

  it("requeue-unsupported flips only now-supported resources back to pending", async () => {
    const tables: Tables = {
      hub_deliveries: [
        { id: randomUUID(), org_id: ORG, resource: "orders.create", payload: {}, status: "unsupported", attempts: 3 },
        { id: randomUUID(), org_id: ORG, resource: "products.upsert", payload: {}, status: "unsupported", attempts: 1 },
        { id: randomUUID(), org_id: ORG, resource: "some.future.thing", payload: {}, status: "unsupported", attempts: 1 },
        { id: randomUUID(), org_id: ORG, resource: "orders.create", payload: {}, status: "delivered", attempts: 1 },
      ],
    };
    const result = await requeueUnsupported(memDb(tables));
    expect(result.requeued).toBe(2);
    expect(result.resources.sort()).toEqual(["orders.create", "products.upsert"]);
    const byResource = Object.fromEntries(tables.hub_deliveries.map((d) => [`${d.resource}:${d.attempts}`, d.status]));
    expect(byResource["orders.create:0"]).toBe("pending");
    expect(byResource["products.upsert:0"]).toBe("pending");
    expect(byResource["some.future.thing:1"]).toBe("unsupported");
    expect(byResource["orders.create:1"]).toBe("delivered");
  });
});

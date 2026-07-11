import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { updateClaim, type Actor } from "../src/domain/resources.js";
import { memDb } from "./memDb.js";

const ORG = randomUUID();
const actor: Actor = { clientId: randomUUID(), orgId: ORG, scopes: ["warranty:write"] };

interface Tables {
  [k: string]: Record<string, unknown>[];
  warranty_claims: Record<string, unknown>[];
  hub_connections: Record<string, unknown>[];
  hub_deliveries: Record<string, unknown>[];
}

describe("updateClaim → hub forwarding", () => {
  let tables: Tables;

  beforeEach(() => {
    tables = {
      warranty_claims: [
        { id: randomUUID(), org_id: ORG, claim_number: "WC-20260710-ABC", status: "submitted", resolution: null },
      ],
      hub_connections: [
        { id: randomUUID(), org_id: ORG, name: "hub", hub_url: "https://hub.example", anon_key: "a", api_key: "k", is_active: true, last_ok_at: null, last_error: null },
      ],
      hub_deliveries: [],
    };
  });

  it("local adjudication (approved/denied) does NOT enqueue a hub delivery", async () => {
    const db = memDb(tables);
    const approved = await updateClaim(db, actor, "WC-20260710-ABC", { status: "approved" });
    expect(approved.status).toBe("approved");
    await updateClaim(db, actor, "WC-20260710-ABC", { status: "denied" });
    expect(tables.hub_deliveries).toHaveLength(0);
  });

  it("submitted is local-only too", async () => {
    const db = memDb(tables);
    await updateClaim(db, actor, "WC-20260710-ABC", { status: "submitted" });
    expect(tables.hub_deliveries).toHaveLength(0);
  });

  it("closing a claim enqueues warranty.claim.update", async () => {
    const db = memDb(tables);
    await updateClaim(db, actor, "WC-20260710-ABC", { status: "closed" });
    expect(tables.hub_deliveries).toHaveLength(1);
    expect(tables.hub_deliveries[0]).toMatchObject({
      resource: "warranty.claim.update",
      payload: { claim_number: "WC-20260710-ABC", status: "closed" },
    });
  });

  it("under_review forwards; a resolution note forwards without the local-only status", async () => {
    const db = memDb(tables);
    await updateClaim(db, actor, "WC-20260710-ABC", { status: "under_review" });
    expect(tables.hub_deliveries).toHaveLength(1);
    await updateClaim(db, actor, "WC-20260710-ABC", { status: "approved", resolution: "replaced under prorated warranty" });
    expect(tables.hub_deliveries).toHaveLength(2);
    // The hub rejects adjudication statuses; only the resolution goes over.
    expect(tables.hub_deliveries[1]!.payload).toEqual({
      claim_number: "WC-20260710-ABC",
      resolution: "replaced under prorated warranty",
    });
  });
});

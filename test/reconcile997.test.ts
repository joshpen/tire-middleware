import { describe, expect, it } from "vitest";
import { generate855, generate997, singleTransaction } from "../src/edi/sets.js";
import { reconcile997 } from "../src/edi/service.js";
import { parseInterchange } from "../src/edi/x12.js";
import type { Db } from "../src/db.js";

const ORG = "org-1";
const OUTBOUND_855 = { id: "msg-855", transaction_set: "855", control_number: "000000042" };

/** Fake db: one outbound 855 with control 000000042; records update calls. */
function fakeDb(updates: { id: string; patch: Record<string, unknown> }[]) {
  const builder = () => {
    const filters: Record<string, unknown> = {};
    let mode: "select" | "update" = "select";
    let patch: Record<string, unknown> = {};
    const b: Record<string, unknown> = {
      select: () => b,
      update: (p: Record<string, unknown>) => {
        mode = "update";
        patch = p;
        return b;
      },
      eq: (col: string, value: unknown) => {
        filters[col] = value;
        return b;
      },
      in: () => b,
      neq: () => b,
      lte: () => b,
      order: () => b,
      limit: () => b,
      then: (resolve: (v: unknown) => void) => {
        if (mode === "update") {
          updates.push({ id: String(filters.id), patch });
          return Promise.resolve({ data: null, error: null }).then(resolve);
        }
        const matches =
          filters.control_number === OUTBOUND_855.control_number &&
          (filters.transaction_set === undefined || filters.transaction_set === OUTBOUND_855.transaction_set);
        return Promise.resolve({ data: matches ? [OUTBOUND_855] : [], error: null }).then(resolve);
      },
    };
    return b;
  };
  return { from: () => builder() } as unknown as Db;
}

function partner997For(outbound855: string, status: "A" | "R"): string {
  // The partner parses our 855 and generates a 997 for it.
  const received = parseInterchange(outbound855);
  let raw = generate997(received, {
    senderQualifier: received.receiverQualifier,
    senderId: received.receiverId,
    receiverQualifier: received.senderQualifier,
    receiverId: received.senderId,
    controlNumber: "77",
  });
  if (status === "R") raw = raw.replace("AK5*A", "AK5*R").replace("AK9*A", "AK9*R");
  return raw;
}

const our855 = generate855(
  {
    poNumber: "PO-42",
    orderDate: new Date("2026-07-01T00:00:00Z"),
    sellerName: "S",
    buyerName: "B",
    lines: [{ sku: "SKU-1", quantity: 4, unitPrice: 100 }],
  },
  { senderQualifier: "ZZ", senderId: "US", receiverQualifier: "ZZ", receiverId: "THEM", controlNumber: "42" },
);

describe("997 reconciliation", () => {
  it("marks the acknowledged outbound message processed on AK5 A", async () => {
    const updates: { id: string; patch: Record<string, unknown> }[] = [];
    const { txn } = singleTransaction(partner997For(our855, "A"));
    const results = await reconcile997(fakeDb(updates), ORG, txn);
    expect(results).toEqual([
      { message_id: "msg-855", transaction_set: "855", control_number: "000000042", disposition: "accepted" },
    ]);
    expect(updates).toHaveLength(1);
    expect(updates[0]!.patch.status).toBe("processed");
    expect(updates[0]!.patch.processed_at).toBeDefined();
  });

  it("marks the outbound message error on AK5 R", async () => {
    const updates: { id: string; patch: Record<string, unknown> }[] = [];
    const { txn } = singleTransaction(partner997For(our855, "R"));
    const results = await reconcile997(fakeDb(updates), ORG, txn);
    expect(results[0]!.disposition).toBe("rejected");
    expect(updates[0]!.patch.status).toBe("error");
    expect(updates[0]!.patch.error).toMatch(/rejected by partner 997/);
  });

  it("reports unmatched acknowledgments instead of dropping them", async () => {
    const other855 = our855.replace(/000000042/g, "000000099").replace(/\*42\*/g, "*99*");
    const updates: { id: string; patch: Record<string, unknown> }[] = [];
    const { txn } = singleTransaction(partner997For(other855, "A"));
    const results = await reconcile997(fakeDb(updates), ORG, txn);
    expect(results[0]!.disposition).toBe("unmatched");
    expect(updates).toHaveLength(0);
  });
});

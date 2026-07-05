import { describe, expect, it } from "vitest";
import {
  generate810,
  generate850,
  generate855,
  generate856,
  generate997,
  parse810,
  parse850,
  parse855,
  parse856,
  parse997,
  singleTransaction,
} from "../src/edi/sets.js";
import { parseInterchange } from "../src/edi/x12.js";
import type { EnvelopeOptions } from "../src/edi/x12.js";

const envelope = (control = "42", extra: Partial<EnvelopeOptions> = {}): EnvelopeOptions => ({
  senderQualifier: "ZZ",
  senderId: "TREADSYNC",
  receiverQualifier: "01",
  receiverId: "004321519",
  controlNumber: control,
  date: new Date("2026-07-05T14:30:00Z"),
  ...extra,
});

describe("envelope", () => {
  it("reads separators from the ISA segment itself", () => {
    const raw = generate850(
      { poNumber: "PO-1", orderDate: new Date("2026-07-01T00:00:00Z"), lines: [{ quantity: 4, vendorPart: "SKU1" }] },
      envelope("7", { separators: { element: "|", component: "^", segment: "!" } }),
    );
    const parsed = parseInterchange(raw);
    expect(parsed.separators).toMatchObject({ element: "|", component: "^", segment: "!" });
    expect(parsed.senderId).toBe("TREADSYNC");
    expect(parsed.receiverId).toBe("004321519");
    expect(parsed.control).toBe("000000007");
    expect(parsed.groups[0]!.transactions[0]!.set).toBe("850");
  });

  it("rejects non-X12 content", () => {
    expect(() => parseInterchange("sku,qty\nA,1\n")).toThrow(/ISA/);
    expect(() => parseInterchange("ISA*truncated")).toThrow();
  });
});

describe("850 round trip", () => {
  it("generates and parses a purchase order", () => {
    const raw = generate850(
      {
        poNumber: "PO-2026-0042",
        orderDate: new Date("2026-07-01T00:00:00Z"),
        shipToName: "Summit Tire DC 4",
        shipToAddress: { street: "1200 Freight Way", city: "Reno", state: "NV", zip: "89502" },
        notes: "Dock 12, appointment required",
        lines: [
          { quantity: 24, unitPrice: 141.5, vendorPart: "LT245-75R17-E", description: "LT245/75R17 all terrain" },
          { quantity: 8, unitPrice: 92, upc: "012345678905" },
        ],
      },
      envelope(),
    );
    const { txn } = singleTransaction(raw);
    const po = parse850(txn);
    expect(po.poNumber).toBe("PO-2026-0042");
    expect(po.date).toBe("20260701");
    expect(po.shipTo).toEqual({ name: "Summit Tire DC 4", address: "1200 Freight Way, Reno NV 89502" });
    expect(po.notes).toBe("Dock 12, appointment required");
    expect(po.lines).toHaveLength(2);
    expect(po.lines[0]).toMatchObject({
      quantity: 24,
      unitPrice: 141.5,
      vendorPart: "LT245-75R17-E",
      description: "LT245/75R17 all terrain",
    });
    expect(po.lines[1]).toMatchObject({ quantity: 8, unitPrice: 92, upc: "012345678905", vendorPart: null });
  });
});

describe("997 round trip", () => {
  it("acknowledges every transaction in the received interchange", () => {
    const inbound850 = generate850(
      { poNumber: "PO-9", orderDate: new Date("2026-07-01T00:00:00Z"), lines: [{ quantity: 2, vendorPart: "X" }] },
      envelope("311"),
    );
    const received = parseInterchange(inbound850);
    const raw997 = generate997(received, envelope("312"));
    const { txn } = singleTransaction(raw997);
    expect(txn.set).toBe("997");
    const ack = parse997(txn);
    expect(ack.groupCode).toBe("PO");
    expect(ack.groupStatus).toBe("A");
    expect(ack.acknowledged).toEqual([{ set: "850", control: received.groups[0]!.transactions[0]!.control, status: "A" }]);
  });
});

describe("855 round trip", () => {
  it("generates and parses an order acknowledgment", () => {
    const raw = generate855(
      {
        poNumber: "PO-2026-0042",
        orderDate: new Date("2026-07-01T00:00:00Z"),
        sellerName: "Cascade Tire Wholesale",
        buyerName: "Summit Tire",
        lines: [
          { sku: "LT245-75R17-E", quantity: 24, unitPrice: 141.5 },
          { sku: "P225-60R16", quantity: 8, unitPrice: 92 },
        ],
      },
      envelope("313"),
    );
    const { txn } = singleTransaction(raw);
    expect(txn.set).toBe("855");
    const ack = parse855(txn);
    expect(ack.poNumber).toBe("PO-2026-0042");
    expect(ack.date).toBe("20260701");
    expect(ack.ackType).toBe("AD");
    expect(ack.lines).toEqual([
      { sku: "LT245-75R17-E", quantity: 24, unitPrice: 141.5, ackStatus: "IA" },
      { sku: "P225-60R16", quantity: 8, unitPrice: 92, ackStatus: "IA" },
    ]);
  });
});

describe("856 round trip", () => {
  it("generates and parses an ASN with shipment/order/item hierarchy", () => {
    const raw = generate856(
      {
        shipmentNumber: "SHP-1007",
        shippedAt: new Date("2026-07-03T16:45:00Z"),
        poNumber: "PO-2026-0042",
        carrier: "OLD DOMINION",
        bolNumber: "BOL-88213",
        proNumber: "PRO-4411002",
        lines: [
          { sku: "LT245-75R17-E", quantity: 24 },
          { sku: "P225-60R16", quantity: 8 },
        ],
      },
      envelope("314"),
    );
    const { txn } = singleTransaction(raw);
    expect(txn.set).toBe("856");
    const hlCodes = txn.segments.filter((s) => s.tag === "HL").map((s) => s.elements[2]);
    expect(hlCodes).toEqual(["S", "O", "I", "I"]);
    const asn = parse856(txn);
    expect(asn.shipmentNumber).toBe("SHP-1007");
    expect(asn.date).toBe("20260703");
    expect(asn.poNumber).toBe("PO-2026-0042");
    expect(asn.carrier).toBe("OLD DOMINION");
    expect(asn.bolNumber).toBe("BOL-88213");
    expect(asn.proNumber).toBe("PRO-4411002");
    expect(asn.lines).toEqual([
      { sku: "LT245-75R17-E", quantity: 24 },
      { sku: "P225-60R16", quantity: 8 },
    ]);
  });
});

describe("810 round trip", () => {
  it("generates and parses an invoice with TDS total in cents", () => {
    const raw = generate810(
      {
        invoiceNumber: "INV-2026-118",
        issueDate: new Date("2026-07-04T00:00:00Z"),
        poNumber: "PO-2026-0042",
        orderDate: new Date("2026-07-01T00:00:00Z"),
        sellerName: "Cascade Tire Wholesale",
        buyerName: "Summit Tire",
        total: 4132.0,
        lines: [
          { sku: "LT245-75R17-E", quantity: 24, unitPrice: 141.5 },
          { sku: "P225-60R16", quantity: 8, unitPrice: 92 },
        ],
      },
      envelope("315"),
    );
    const { txn } = singleTransaction(raw);
    expect(txn.set).toBe("810");
    const invoice = parse810(txn);
    expect(invoice.invoiceNumber).toBe("INV-2026-118");
    expect(invoice.issueDate).toBe("20260704");
    expect(invoice.poNumber).toBe("PO-2026-0042");
    expect(invoice.total).toBe(4132.0);
    expect(invoice.lines).toEqual([
      { sku: "LT245-75R17-E", quantity: 24, unitPrice: 141.5 },
      { sku: "P225-60R16", quantity: 8, unitPrice: 92 },
    ]);
  });
});

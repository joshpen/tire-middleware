/**
 * Transaction-set codecs built on the x12 core: an 850 parser for inbound
 * purchase orders, generators for 997/855/856/810, and matching extractors so
 * every generated document can be parsed back and asserted in tests.
 */
import {
  buildInterchange,
  element as el,
  findSegment,
  findSegments,
  fmtDate,
  parseInterchange,
  seg,
  X12ParseError,
  type EnvelopeOptions,
  type X12Interchange,
  type X12Transaction,
} from "./x12.js";

// ── 850 purchase order (inbound) ─────────────────────────────────────────────

export interface Edi850Line {
  lineNumber: number;
  quantity: number;
  uom: string;
  unitPrice: number | null;
  /** PO1 product IDs by qualifier: VN vendor part, BP buyer part, UP UPC. */
  vendorPart: string | null;
  buyerPart: string | null;
  upc: string | null;
  description: string | null;
}

export interface Edi850 {
  poNumber: string;
  /** BEG05, CCYYMMDD. */
  date: string | null;
  shipTo: { name: string; address: string | null } | null;
  notes: string | null;
  lines: Edi850Line[];
}

export function parse850(txn: X12Transaction): Edi850 {
  const beg = findSegment(txn, "BEG");
  if (!beg) throw new X12ParseError("850 missing BEG segment");
  const poNumber = el(beg, 3);
  if (!poNumber) throw new X12ParseError("850 BEG03 (PO number) is empty");

  let shipTo: Edi850["shipTo"] = null;
  const segments = txn.segments;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    if (s.tag === "N1" && el(s, 1) === "ST") {
      const parts: string[] = [];
      for (let j = i + 1; j < segments.length; j++) {
        const t = segments[j]!;
        if (t.tag === "N3") parts.push(t.elements.filter(Boolean).join(" "));
        else if (t.tag === "N4") parts.push(t.elements.filter(Boolean).join(" "));
        else if (t.tag !== "N2") break;
      }
      shipTo = { name: el(s, 2), address: parts.length ? parts.join(", ") : null };
      break;
    }
  }

  const lines: Edi850Line[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    if (s.tag !== "PO1") continue;
    const line: Edi850Line = {
      lineNumber: Number(el(s, 1)) || lines.length + 1,
      quantity: Number(el(s, 2)),
      uom: el(s, 3) || "EA",
      unitPrice: el(s, 4) ? Number(el(s, 4)) : null,
      vendorPart: null,
      buyerPart: null,
      upc: null,
      description: null,
    };
    // Qualifier/value pairs start at PO1-06.
    for (let n = 6; n + 1 <= s.elements.length; n += 2) {
      const qual = el(s, n);
      const value = el(s, n + 1);
      if (!qual || !value) continue;
      if (qual === "VN") line.vendorPart = value;
      else if (qual === "BP") line.buyerPart = value;
      else if (qual === "UP") line.upc = value;
    }
    const next = segments[i + 1];
    if (next?.tag === "PID" && el(next, 1) === "F") line.description = el(next, 5) || null;
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new X12ParseError(`850 PO1 line ${line.lineNumber} has invalid quantity`);
    }
    lines.push(line);
  }
  if (lines.length === 0) throw new X12ParseError("850 has no PO1 lines");

  const msg = findSegment(txn, "MSG");
  return { poNumber, date: el(beg, 5) || null, shipTo, notes: msg ? el(msg, 1) || null : null, lines };
}

export interface Order850Input {
  poNumber: string;
  orderDate: Date;
  shipToName?: string;
  shipToAddress?: { street: string; city: string; state: string; zip: string };
  notes?: string;
  lines: {
    quantity: number;
    unitPrice?: number;
    vendorPart?: string;
    buyerPart?: string;
    upc?: string;
    description?: string;
  }[];
}

/** Generates an 850 purchase order (used by trading partners and tests). */
export function generate850(order: Order850Input, opts: EnvelopeOptions): string {
  return buildInterchange(
    "850",
    (sep) => {
      const body = [seg(sep, "BEG", "00", "NE", order.poNumber, "", fmtDate(order.orderDate, "ccyymmdd"))];
      if (order.shipToName) {
        body.push(seg(sep, "N1", "ST", order.shipToName));
        if (order.shipToAddress) {
          body.push(seg(sep, "N3", order.shipToAddress.street));
          body.push(seg(sep, "N4", order.shipToAddress.city, order.shipToAddress.state, order.shipToAddress.zip));
        }
      }
      if (order.notes) body.push(seg(sep, "MSG", order.notes));
      order.lines.forEach((line, i) => {
        const ids: (string | number)[] = [];
        if (line.vendorPart) ids.push("VN", line.vendorPart);
        if (line.buyerPart) ids.push("BP", line.buyerPart);
        if (line.upc) ids.push("UP", line.upc);
        body.push(
          seg(
            sep,
            "PO1",
            i + 1,
            line.quantity,
            "EA",
            line.unitPrice !== undefined ? line.unitPrice.toFixed(2) : "",
            line.unitPrice !== undefined ? "PE" : "",
            ...ids,
          ),
        );
        if (line.description) body.push(seg(sep, "PID", "F", "", "", "", line.description));
      });
      body.push(seg(sep, "CTT", order.lines.length));
      return body;
    },
    opts,
  );
}

// ── 997 functional acknowledgment ─────────────────────────────────────────────

export interface Edi997 {
  groupCode: string;
  groupControl: string;
  acknowledged: { set: string; control: string; status: string }[];
  groupStatus: string;
}

/** Generates a 997 accepting every transaction in the received interchange. */
export function generate997(received: X12Interchange, opts: EnvelopeOptions): string {
  const group = received.groups[0];
  if (!group) throw new X12ParseError("received interchange has no functional group");
  return buildInterchange(
    "997",
    (sep) => {
      const body = [seg(sep, "AK1", group.code, Number(group.control) || group.control)];
      for (const txn of group.transactions) {
        body.push(seg(sep, "AK2", txn.set, txn.control));
        body.push(seg(sep, "AK5", "A"));
      }
      const n = group.transactions.length;
      body.push(seg(sep, "AK9", "A", n, n, n));
      return body;
    },
    opts,
  );
}

export function parse997(txn: X12Transaction): Edi997 {
  const ak1 = findSegment(txn, "AK1");
  const ak9 = findSegment(txn, "AK9");
  if (!ak1 || !ak9) throw new X12ParseError("997 missing AK1/AK9");
  const acknowledged: Edi997["acknowledged"] = [];
  const segments = txn.segments;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    if (s.tag !== "AK2") continue;
    const next = segments[i + 1];
    acknowledged.push({
      set: el(s, 1),
      control: el(s, 2),
      status: next?.tag === "AK5" ? el(next, 1) : "",
    });
  }
  return {
    groupCode: el(ak1, 1),
    groupControl: el(ak1, 2),
    acknowledged,
    groupStatus: el(ak9, 1),
  };
}

// ── 855 purchase order acknowledgment ────────────────────────────────────────

export interface Order855Input {
  poNumber: string;
  orderDate: Date;
  sellerName: string;
  buyerName: string;
  lines: { sku: string; quantity: number; unitPrice: number; name?: string | null }[];
}

export function generate855(order: Order855Input, opts: EnvelopeOptions): string {
  return buildInterchange(
    "855",
    (sep) => {
      const body = [
        seg(sep, "BAK", "00", "AD", order.poNumber, fmtDate(order.orderDate, "ccyymmdd")),
        seg(sep, "N1", "SE", order.sellerName),
        seg(sep, "N1", "BY", order.buyerName),
      ];
      order.lines.forEach((line, i) => {
        body.push(seg(sep, "PO1", i + 1, line.quantity, "EA", line.unitPrice.toFixed(2), "PE", "VN", line.sku));
        body.push(seg(sep, "ACK", "IA", line.quantity, "EA"));
      });
      body.push(seg(sep, "CTT", order.lines.length));
      return body;
    },
    opts,
  );
}

export interface Edi855 {
  poNumber: string;
  date: string | null;
  ackType: string;
  lines: { sku: string; quantity: number; unitPrice: number; ackStatus: string }[];
}

export function parse855(txn: X12Transaction): Edi855 {
  const bak = findSegment(txn, "BAK");
  if (!bak) throw new X12ParseError("855 missing BAK");
  const lines: Edi855["lines"] = [];
  const segments = txn.segments;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    if (s.tag !== "PO1") continue;
    let sku = "";
    for (let n = 6; n + 1 <= s.elements.length; n += 2) {
      if (el(s, n) === "VN") sku = el(s, n + 1);
    }
    const next = segments[i + 1];
    lines.push({
      sku,
      quantity: Number(el(s, 2)),
      unitPrice: Number(el(s, 4)),
      ackStatus: next?.tag === "ACK" ? el(next, 1) : "",
    });
  }
  return { poNumber: el(bak, 3), date: el(bak, 4) || null, ackType: el(bak, 2), lines };
}

// ── 856 advance ship notice ──────────────────────────────────────────────────

export interface Shipment856Input {
  shipmentNumber: string;
  shippedAt: Date;
  poNumber: string;
  carrier: string | null;
  bolNumber: string | null;
  proNumber: string | null;
  lines: { sku: string; quantity: number }[];
}

export function generate856(shipment: Shipment856Input, opts: EnvelopeOptions): string {
  return buildInterchange(
    "856",
    (sep) => {
      const body = [
        seg(sep, "BSN", "00", shipment.shipmentNumber, fmtDate(shipment.shippedAt, "ccyymmdd"), fmtDate(shipment.shippedAt, "hhmm"), "0001"),
      ];
      let hl = 1;
      body.push(seg(sep, "HL", hl, "", "S"));
      if (shipment.carrier) body.push(seg(sep, "TD5", "", "2", "", "", shipment.carrier));
      if (shipment.bolNumber) body.push(seg(sep, "REF", "BM", shipment.bolNumber));
      if (shipment.proNumber) body.push(seg(sep, "REF", "CN", shipment.proNumber));
      body.push(seg(sep, "DTM", "011", fmtDate(shipment.shippedAt, "ccyymmdd")));
      const shipmentHl = hl;
      hl += 1;
      body.push(seg(sep, "HL", hl, shipmentHl, "O"));
      body.push(seg(sep, "PRF", shipment.poNumber));
      const orderHl = hl;
      for (const line of shipment.lines) {
        hl += 1;
        body.push(seg(sep, "HL", hl, orderHl, "I"));
        body.push(seg(sep, "LIN", "", "VN", line.sku));
        body.push(seg(sep, "SN1", "", line.quantity, "EA"));
      }
      body.push(seg(sep, "CTT", hl));
      return body;
    },
    opts,
  );
}

export interface Edi856 {
  shipmentNumber: string;
  date: string | null;
  poNumber: string;
  carrier: string | null;
  bolNumber: string | null;
  proNumber: string | null;
  lines: { sku: string; quantity: number }[];
}

export function parse856(txn: X12Transaction): Edi856 {
  const bsn = findSegment(txn, "BSN");
  const prf = findSegment(txn, "PRF");
  if (!bsn) throw new X12ParseError("856 missing BSN");
  if (!prf) throw new X12ParseError("856 missing PRF (order level)");
  const refs = findSegments(txn, "REF");
  const td5 = findSegment(txn, "TD5");
  const lines: Edi856["lines"] = [];
  const segments = txn.segments;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    if (s.tag !== "LIN") continue;
    const sn1 = segments[i + 1];
    if (el(s, 2) === "VN" && sn1?.tag === "SN1") {
      lines.push({ sku: el(s, 3), quantity: Number(el(sn1, 2)) });
    }
  }
  return {
    shipmentNumber: el(bsn, 2),
    date: el(bsn, 3) || null,
    poNumber: el(prf, 1),
    carrier: td5 ? el(td5, 5) || null : null,
    bolNumber: refs.find((r) => el(r, 1) === "BM") ? el(refs.find((r) => el(r, 1) === "BM")!, 2) : null,
    proNumber: refs.find((r) => el(r, 1) === "CN") ? el(refs.find((r) => el(r, 1) === "CN")!, 2) : null,
    lines,
  };
}

// ── 810 invoice ──────────────────────────────────────────────────────────────

export interface Invoice810Input {
  invoiceNumber: string;
  issueDate: Date;
  poNumber: string;
  orderDate: Date;
  sellerName: string;
  buyerName: string;
  total: number;
  lines: { sku: string; quantity: number; unitPrice: number }[];
}

export function generate810(invoice: Invoice810Input, opts: EnvelopeOptions): string {
  return buildInterchange(
    "810",
    (sep) => {
      const body = [
        seg(sep, "BIG", fmtDate(invoice.issueDate, "ccyymmdd"), invoice.invoiceNumber, fmtDate(invoice.orderDate, "ccyymmdd"), invoice.poNumber),
        seg(sep, "N1", "SE", invoice.sellerName),
        seg(sep, "N1", "BY", invoice.buyerName),
      ];
      invoice.lines.forEach((line, i) => {
        body.push(seg(sep, "IT1", i + 1, line.quantity, "EA", line.unitPrice.toFixed(2), "PE", "VN", line.sku));
      });
      // TDS carries the total in implied cents.
      body.push(seg(sep, "TDS", Math.round(invoice.total * 100)));
      body.push(seg(sep, "CTT", invoice.lines.length));
      return body;
    },
    opts,
  );
}

export interface Edi810 {
  invoiceNumber: string;
  issueDate: string;
  poNumber: string;
  total: number;
  lines: { sku: string; quantity: number; unitPrice: number }[];
}

export function parse810(txn: X12Transaction): Edi810 {
  const big = findSegment(txn, "BIG");
  const tds = findSegment(txn, "TDS");
  if (!big) throw new X12ParseError("810 missing BIG");
  if (!tds) throw new X12ParseError("810 missing TDS");
  const lines: Edi810["lines"] = [];
  for (const s of findSegments(txn, "IT1")) {
    let sku = "";
    for (let n = 6; n + 1 <= s.elements.length; n += 2) {
      if (el(s, n) === "VN") sku = el(s, n + 1);
    }
    lines.push({ sku, quantity: Number(el(s, 2)), unitPrice: Number(el(s, 4)) });
  }
  return {
    invoiceNumber: el(big, 2),
    issueDate: el(big, 1),
    poNumber: el(big, 4),
    total: Number(el(tds, 1)) / 100,
    lines,
  };
}

// ── Convenience: pull the single transaction out of a raw interchange ─────────

export function singleTransaction(raw: string): { interchange: X12Interchange; txn: X12Transaction } {
  const interchange = parseInterchange(raw);
  const txn = interchange.groups[0]?.transactions[0];
  if (!txn) throw new X12ParseError("interchange contains no transaction set");
  return { interchange, txn };
}

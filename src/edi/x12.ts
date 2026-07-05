/**
 * Minimal X12 EDI core: tokenizer, envelope reader/writer. No dependencies.
 *
 * Separators are never assumed — they are read from the ISA segment itself:
 * the element separator is the 4th character, ISA16 is the component
 * separator, and the character following ISA16 is the segment terminator.
 */

export interface Separators {
  element: string;
  component: string;
  segment: string;
  /** ISA11 in 00501+; may be a plain "U" in older versions (unused then). */
  repetition: string;
}

export interface X12Segment {
  tag: string;
  /** Data elements; elements[0] is the first element after the tag. */
  elements: string[];
}

export interface X12Transaction {
  /** ST01, e.g. "850" */
  set: string;
  /** ST02 control number */
  control: string;
  /** Segments between ST and SE, exclusive. */
  segments: X12Segment[];
}

export interface X12FunctionalGroup {
  /** GS01 functional ID code, e.g. "PO" */
  code: string;
  /** GS06 group control number */
  control: string;
  sender: string;
  receiver: string;
  transactions: X12Transaction[];
}

export interface X12Interchange {
  separators: Separators;
  /** ISA01..ISA16 (1-indexed via isa[n-1]), values trimmed. */
  isa: string[];
  senderQualifier: string;
  senderId: string;
  receiverQualifier: string;
  receiverId: string;
  /** ISA13 */
  control: string;
  groups: X12FunctionalGroup[];
}

export class X12ParseError extends Error {}

const el = (seg: X12Segment, n: number): string => seg.elements[n - 1] ?? "";

export { el as element };

export function parseInterchange(raw: string): X12Interchange {
  const doc = raw.replace(/^﻿/, "").trimStart();
  if (!doc.startsWith("ISA")) throw new X12ParseError("document does not start with ISA");

  const element = doc[3];
  if (!element) throw new X12ParseError("truncated ISA segment");

  // ISA has exactly 16 element separators; ISA16 (component separator) is the
  // single character after the 16th, and the segment terminator follows it.
  let idx = 3; // doc[3] is the separator after the ISA tag — the 1st of 16.
  for (let n = 1; n < 16; n++) {
    idx = doc.indexOf(element, idx + 1);
    if (idx === -1) throw new X12ParseError("ISA segment has fewer than 16 elements");
  }
  const component = doc[idx + 1];
  const segment = doc[idx + 2];
  if (!component || !segment) throw new X12ParseError("truncated ISA segment");

  const isaRaw = doc.slice(0, idx + 2);
  const isa = isaRaw.split(element).slice(1).map((v) => v.trim());
  const repetition = isa[10] ?? "U";

  const separators: Separators = { element, component, segment, repetition };

  const body = doc.slice(idx + 3);
  const segments: X12Segment[] = [];
  for (const chunk of body.split(segment)) {
    const text = chunk.replace(/[\r\n]/g, "").trim();
    if (!text) continue;
    const parts = text.split(element);
    segments.push({ tag: parts[0]!, elements: parts.slice(1) });
  }

  const iea = segments.at(-1);
  if (!iea || iea.tag !== "IEA") throw new X12ParseError("missing IEA trailer");

  const groups: X12FunctionalGroup[] = [];
  let group: X12FunctionalGroup | null = null;
  let txn: X12Transaction | null = null;
  for (const seg of segments) {
    switch (seg.tag) {
      case "GS":
        group = {
          code: el(seg, 1),
          sender: el(seg, 2),
          receiver: el(seg, 3),
          control: el(seg, 6),
          transactions: [],
        };
        groups.push(group);
        break;
      case "GE":
        group = null;
        break;
      case "ST":
        if (!group) throw new X12ParseError("ST outside of functional group");
        txn = { set: el(seg, 1), control: el(seg, 2), segments: [] };
        group.transactions.push(txn);
        break;
      case "SE":
        txn = null;
        break;
      case "IEA":
        break;
      default:
        if (txn) txn.segments.push(seg);
    }
  }

  return {
    separators,
    isa,
    senderQualifier: isa[4] ?? "",
    senderId: isa[5] ?? "",
    receiverQualifier: isa[6] ?? "",
    receiverId: isa[7] ?? "",
    control: isa[12] ?? "",
    groups,
  };
}

/** First segment with the given tag inside a transaction, or null. */
export function findSegment(txn: X12Transaction, tag: string): X12Segment | null {
  return txn.segments.find((s) => s.tag === tag) ?? null;
}

export function findSegments(txn: X12Transaction, tag: string): X12Segment[] {
  return txn.segments.filter((s) => s.tag === tag);
}

// ── Generation ────────────────────────────────────────────────────────────────

export interface EnvelopeOptions {
  senderQualifier: string;
  senderId: string;
  receiverQualifier: string;
  receiverId: string;
  /** Interchange/group/transaction control number (numeric string). */
  controlNumber: string;
  /** "P" production (default) or "T" test. */
  usageIndicator?: string;
  date?: Date;
  separators?: Partial<Separators>;
}

const DEFAULT_SEPARATORS: Separators = { element: "*", component: ">", segment: "~", repetition: "U" };

const GS_CODE_BY_SET: Record<string, string> = {
  "850": "PO",
  "855": "PR",
  "856": "SH",
  "810": "IN",
  "997": "FA",
};

const pad = (v: string, len: number) => v.slice(0, len).padEnd(len, " ");
const num = (v: string | number, len: number) => String(v).replace(/\D/g, "").slice(-len).padStart(len, "0");

function fmtDate(d: Date, style: "yymmdd" | "ccyymmdd" | "hhmm"): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const yyyy = d.getUTCFullYear();
  const mm = p(d.getUTCMonth() + 1);
  const dd = p(d.getUTCDate());
  if (style === "yymmdd") return `${String(yyyy).slice(2)}${mm}${dd}`;
  if (style === "ccyymmdd") return `${yyyy}${mm}${dd}`;
  return `${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

export { fmtDate };

export function seg(separators: Separators, tag: string, ...elements: (string | number | null | undefined)[]): string {
  const values = elements.map((e) => (e === null || e === undefined ? "" : String(e)));
  while (values.length > 0 && values.at(-1) === "") values.pop();
  return [tag, ...values].join(separators.element) + separators.segment;
}

/**
 * Wraps one transaction set's body segments (post-ST, pre-SE) into a full
 * ISA/GS/ST … SE/GE/IEA interchange.
 */
export function buildInterchange(
  set: string,
  bodySegments: (sep: Separators) => string[],
  opts: EnvelopeOptions,
): string {
  const separators: Separators = { ...DEFAULT_SEPARATORS, ...opts.separators };
  const d = opts.date ?? new Date();
  const ctl = num(opts.controlNumber, 9);
  const gsCode = GS_CODE_BY_SET[set];
  if (!gsCode) throw new X12ParseError(`unsupported transaction set ${set}`);

  const isa =
    [
      "ISA",
      "00",
      pad("", 10),
      "00",
      pad("", 10),
      pad(opts.senderQualifier, 2),
      pad(opts.senderId, 15),
      pad(opts.receiverQualifier, 2),
      pad(opts.receiverId, 15),
      fmtDate(d, "yymmdd"),
      fmtDate(d, "hhmm"),
      separators.repetition,
      "00501",
      ctl,
      "0",
      opts.usageIndicator ?? "P",
      separators.component,
    ].join(separators.element) + separators.segment;

  const body = bodySegments(separators);
  const stControl = ctl.slice(-4).padStart(4, "0");
  const st = seg(separators, "ST", set, stControl);
  const se = seg(separators, "SE", body.length + 2, stControl);
  const gs = seg(
    separators,
    "GS",
    gsCode,
    opts.senderId.trim(),
    opts.receiverId.trim(),
    fmtDate(d, "ccyymmdd"),
    fmtDate(d, "hhmm"),
    Number(ctl),
    "X",
    "005010",
  );
  const ge = seg(separators, "GE", 1, Number(ctl));
  const iea = seg(separators, "IEA", 1, ctl);

  return [isa, gs, st, ...body, se, ge, iea].join("\n") + "\n";
}

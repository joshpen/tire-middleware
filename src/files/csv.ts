import type { InventoryRow, PriceRow } from "../domain/inventory.js";

/** Small RFC-4180-ish CSV parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") pushField();
    else if (c === "\n") pushRow();
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

function headerIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

export class CsvFormatError extends Error {}

/** Parses an inventory CSV (sku + qty columns) into stock rows. */
export function parseInventoryCsv(text: string): InventoryRow[] {
  const rows = parseCsv(text);
  const headers = rows[0];
  if (!headers) throw new CsvFormatError("empty CSV");
  const skuIdx = headerIndex(headers, ["sku", "part_number", "item"]);
  const qtyIdx = headerIndex(headers, ["qty", "quantity", "stock", "stock_qty", "qty_on_hand", "on_hand"]);
  if (skuIdx === -1 || qtyIdx === -1) {
    throw new CsvFormatError("inventory CSV must have sku and qty columns");
  }
  const out: InventoryRow[] = [];
  for (const row of rows.slice(1)) {
    const sku = row[skuIdx]?.trim();
    const qtyStr = row[qtyIdx]?.trim();
    const qty = Number(qtyStr);
    if (!sku || !qtyStr || !Number.isFinite(qty)) continue;
    out.push({ sku, qty: Math.trunc(qty) });
  }
  return out;
}

/** Parses a price CSV (sku + price columns) into list-price rows. */
export function parsePriceCsv(text: string): PriceRow[] {
  const rows = parseCsv(text);
  const headers = rows[0];
  if (!headers) throw new CsvFormatError("empty CSV");
  const skuIdx = headerIndex(headers, ["sku", "part_number", "item"]);
  const priceIdx = headerIndex(headers, ["price", "unit_price", "list_price", "list"]);
  if (skuIdx === -1 || priceIdx === -1) {
    throw new CsvFormatError("price CSV must have sku and price columns");
  }
  const out: PriceRow[] = [];
  for (const row of rows.slice(1)) {
    const sku = row[skuIdx]?.trim();
    const priceStr = row[priceIdx]?.trim().replace(/^\$/, "");
    const price = Number(priceStr);
    if (!sku || !priceStr || !Number.isFinite(price) || price < 0) continue;
    out.push({ sku, price });
  }
  return out;
}

export type FileKind = "edi" | "csv_inventory" | "csv_prices";

/**
 * Classifies file content. X12 interchanges start with "ISA"; CSVs are routed
 * by the endpoint's declared file_type, falling back to header sniffing for
 * `auto` endpoints.
 */
export function classifyContent(content: string, declaredType: string): FileKind {
  const head = content.trimStart();
  if (head.startsWith("ISA")) return "edi";
  if (declaredType === "csv_inventory" || declaredType === "csv_prices") return declaredType;
  if (declaredType === "edi") {
    throw new CsvFormatError("endpoint expects EDI but file does not start with ISA");
  }
  // auto: sniff the header row.
  const headers = parseCsv(head.split("\n", 1)[0] ?? "")[0] ?? [];
  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  if (normalized.some((h) => ["price", "unit_price", "list_price", "list"].includes(h))) return "csv_prices";
  if (normalized.some((h) => ["qty", "quantity", "stock", "stock_qty", "qty_on_hand", "on_hand"].includes(h))) {
    return "csv_inventory";
  }
  throw new CsvFormatError("could not classify file content (not EDI, no qty/price CSV headers)");
}

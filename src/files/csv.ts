import type { InventoryRow, PriceRow } from "../domain/inventory.js";

/**
 * Per-endpoint CSV mapping profile, stored in `file_endpoints.config.mapping`
 * so a hub UI can adapt supplier files without gateway code changes.
 */
export interface CsvMapping {
  /** Exact header of the SKU column (falls back to built-in aliases). */
  sku_column?: string;
  qty_column?: string;
  price_column?: string;
  /** Field delimiter, default ",". */
  delimiter?: string;
  /** External SKU → internal SKU cross-reference (case-insensitive keys). */
  sku_xref?: Record<string, string>;
  /** Multiply parsed qty (e.g. cases → units). */
  qty_multiplier?: number;
  /** Multiply parsed price (e.g. cents → dollars). */
  price_multiplier?: number;
}

function applyXref(sku: string, xref?: Record<string, string>): string {
  if (!xref) return sku;
  const hit = Object.entries(xref).find(([k]) => k.toLowerCase() === sku.toLowerCase());
  return hit ? hit[1] : sku;
}

/** Small RFC-4180-ish CSV parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string, delimiter = ","): string[][] {
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
    else if (c === delimiter) pushField();
    else if (c === "\n") pushRow();
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

function headerIndex(headers: string[], candidates: string[], override?: string): number {
  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  if (override) {
    return normalized.indexOf(override.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  }
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

export class CsvFormatError extends Error {}

/** Parses an inventory CSV (sku + qty columns) into stock rows. */
export function parseInventoryCsv(text: string, mapping: CsvMapping = {}): InventoryRow[] {
  const rows = parseCsv(text, mapping.delimiter ?? ",");
  const headers = rows[0];
  if (!headers) throw new CsvFormatError("empty CSV");
  const skuIdx = headerIndex(headers, ["sku", "part_number", "item"], mapping.sku_column);
  const qtyIdx = headerIndex(
    headers,
    ["qty", "quantity", "stock", "stock_qty", "qty_on_hand", "on_hand"],
    mapping.qty_column,
  );
  if (skuIdx === -1 || qtyIdx === -1) {
    throw new CsvFormatError(
      mapping.sku_column || mapping.qty_column
        ? `mapped columns not found (sku_column=${mapping.sku_column ?? "auto"}, qty_column=${mapping.qty_column ?? "auto"})`
        : "inventory CSV must have sku and qty columns",
    );
  }
  const multiplier = mapping.qty_multiplier ?? 1;
  const out: InventoryRow[] = [];
  for (const row of rows.slice(1)) {
    const sku = row[skuIdx]?.trim();
    const qtyStr = row[qtyIdx]?.trim();
    const qty = Number(qtyStr);
    if (!sku || !qtyStr || !Number.isFinite(qty)) continue;
    out.push({ sku: applyXref(sku, mapping.sku_xref), qty: Math.trunc(qty * multiplier) });
  }
  return out;
}

/** Parses a price CSV (sku + price columns) into list-price rows. */
export function parsePriceCsv(text: string, mapping: CsvMapping = {}): PriceRow[] {
  const rows = parseCsv(text, mapping.delimiter ?? ",");
  const headers = rows[0];
  if (!headers) throw new CsvFormatError("empty CSV");
  const skuIdx = headerIndex(headers, ["sku", "part_number", "item"], mapping.sku_column);
  const priceIdx = headerIndex(headers, ["price", "unit_price", "list_price", "list"], mapping.price_column);
  if (skuIdx === -1 || priceIdx === -1) {
    throw new CsvFormatError(
      mapping.sku_column || mapping.price_column
        ? `mapped columns not found (sku_column=${mapping.sku_column ?? "auto"}, price_column=${mapping.price_column ?? "auto"})`
        : "price CSV must have sku and price columns",
    );
  }
  const multiplier = mapping.price_multiplier ?? 1;
  const out: PriceRow[] = [];
  for (const row of rows.slice(1)) {
    const sku = row[skuIdx]?.trim();
    const priceStr = row[priceIdx]?.trim().replace(/^\$/, "");
    const price = Number(priceStr);
    if (!sku || !priceStr || !Number.isFinite(price) || price < 0) continue;
    out.push({ sku: applyXref(sku, mapping.sku_xref), price: price * multiplier });
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

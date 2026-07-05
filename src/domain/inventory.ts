import type { Db } from "../db.js";

export function stockStatusFor(qty: number): "backorder" | "low_stock" | "in_stock" {
  if (qty <= 0) return "backorder";
  if (qty <= 8) return "low_stock";
  return "in_stock";
}

export interface InventoryRow {
  sku: string;
  qty: number;
}

export interface ApplyResult {
  updated: number;
  unknownSkus: string[];
}

/**
 * Applies stock rows to products in the org, matching SKUs
 * case-insensitively and deriving stock_status from the thresholds.
 */
export async function applyInventoryRows(db: Db, orgId: string, rows: InventoryRow[]): Promise<ApplyResult> {
  if (rows.length === 0) return { updated: 0, unknownSkus: [] };
  const { data: products, error } = await db.from("products").select("id, sku").eq("org_id", orgId);
  if (error) throw new Error(`product lookup failed: ${error.message}`);
  const bySku = new Map((products ?? []).map((p) => [p.sku.toLowerCase(), p.id]));

  let updated = 0;
  const unknownSkus: string[] = [];
  for (const row of rows) {
    const productId = bySku.get(row.sku.toLowerCase());
    if (!productId) {
      unknownSkus.push(row.sku);
      continue;
    }
    const { error: updateError } = await db
      .from("products")
      .update({
        stock_qty: row.qty,
        stock_status: stockStatusFor(row.qty),
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);
    if (updateError) throw new Error(`stock update failed for ${row.sku}: ${updateError.message}`);
    updated++;
  }
  return { updated, unknownSkus };
}

export interface PriceRow {
  sku: string;
  price: number;
}

/**
 * Applies list-price rows: updates the product's active `list` price row in
 * product_prices, or inserts one if none exists.
 */
export async function applyPriceRows(db: Db, orgId: string, rows: PriceRow[]): Promise<ApplyResult> {
  if (rows.length === 0) return { updated: 0, unknownSkus: [] };
  const { data: products, error } = await db.from("products").select("id, sku").eq("org_id", orgId);
  if (error) throw new Error(`product lookup failed: ${error.message}`);
  const bySku = new Map((products ?? []).map((p) => [p.sku.toLowerCase(), p.id]));

  let updated = 0;
  const unknownSkus: string[] = [];
  for (const row of rows) {
    const productId = bySku.get(row.sku.toLowerCase());
    if (!productId) {
      unknownSkus.push(row.sku);
      continue;
    }
    const { data: existing, error: findError } = await db
      .from("product_prices")
      .select("id")
      .eq("product_id", productId)
      .eq("price_type", "list")
      .eq("is_active", true)
      .is("variant_id", null)
      .limit(1);
    if (findError) throw new Error(`price lookup failed for ${row.sku}: ${findError.message}`);
    if (existing?.[0]) {
      const { error: updateError } = await db
        .from("product_prices")
        .update({ unit_price: row.price, updated_at: new Date().toISOString() })
        .eq("id", existing[0].id);
      if (updateError) throw new Error(`price update failed for ${row.sku}: ${updateError.message}`);
    } else {
      const { error: insertError } = await db.from("product_prices").insert({
        product_id: productId,
        org_id: orgId,
        price_type: "list",
        unit_price: row.price,
      });
      if (insertError) throw new Error(`price insert failed for ${row.sku}: ${insertError.message}`);
    }
    updated++;
  }
  return { updated, unknownSkus };
}

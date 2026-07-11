import { randomBytes } from "node:crypto";
import type { Db } from "../db.js";
import { callHub, getHubConnection, mw, touchConnection } from "../hub/connector.js";
import { enqueueDelivery } from "../hub/outbox.js";
import { getStockStatusRules } from "../mappings.js";
import { applyInventoryRows, stockStatusFor, type InventoryRow } from "./inventory.js";

/**
 * The management resource layer: every operation a partner (or an agent over
 * MCP) can perform, org-scoped and scope-checked. REST routes and MCP tools
 * are thin wrappers over these functions, so both surfaces behave
 * identically — including dual mode: hub-connected orgs proxy reads/writes to
 * the hub's API where it has the resource, stage locally and enqueue an
 * outbox delivery where it doesn't.
 */

export interface Actor {
  clientId: string;
  orgId: string;
  scopes: string[];
}

export class ResourceError extends Error {
  /** statusCode is what Fastify's error handler reads. */
  public statusCode: number;
  constructor(public status: number, message: string) {
    super(message);
    this.statusCode = status;
  }
}

export function requireScope(actor: Actor, scope: string): void {
  if (!actor.scopes.includes(scope)) throw new ResourceError(403, `missing scope ${scope}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function hubConn(db: Db, orgId: string) {
  return getHubConnection(db, orgId);
}

// ── Products ─────────────────────────────────────────────────────────────────

export async function listProducts(db: Db, actor: Actor) {
  requireScope(actor, "products:read");
  const conn = await hubConn(db, actor.orgId);
  if (conn) {
    const result = await callHub(conn, "products.list");
    await touchConnection(db, conn, result.ok ? null : result.error ?? null);
    if (!result.ok) throw new ResourceError(502, `hub products.list failed: ${result.error}`);
    return (result.data as { products: unknown[] }).products;
  }
  const { data, error } = await db
    .from("products")
    .select("sku, name, status, stock_qty, stock_status, bin_location")
    .eq("org_id", actor.orgId)
    .eq("status", "active")
    .order("sku");
  if (error) throw new ResourceError(500, `products query failed: ${error.message}`);
  return data ?? [];
}

export async function getProduct(db: Db, actor: Actor, sku: string) {
  requireScope(actor, "products:read");
  const { data, error } = await db
    .from("products")
    .select("sku, name, description, status, stock_qty, stock_status, bin_location, updated_at")
    .eq("org_id", actor.orgId)
    .ilike("sku", sku)
    .limit(1);
  if (error) throw new ResourceError(500, `product query failed: ${error.message}`);
  if (!data?.[0]) throw new ResourceError(404, `no product with sku ${sku}`);
  return data[0];
}

export interface ProductInput {
  sku: string;
  name?: string;
  description?: string;
  status?: string;
  stock_qty?: number;
  bin_location?: string;
}

export async function upsertProduct(db: Db, actor: Actor, input: ProductInput) {
  requireScope(actor, "products:write");
  if (!input.sku?.trim()) throw new ResourceError(400, "sku is required");
  const sku = input.sku.trim();
  const rules = await getStockStatusRules(db, actor.orgId);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;
  if (input.bin_location !== undefined) patch.bin_location = input.bin_location;
  if (input.stock_qty !== undefined) {
    patch.stock_qty = input.stock_qty;
    patch.stock_status = stockStatusFor(input.stock_qty, rules);
  }

  const { data: existing, error: findError } = await db
    .from("products")
    .select("id")
    .eq("org_id", actor.orgId)
    .ilike("sku", sku)
    .limit(1);
  if (findError) throw new ResourceError(500, findError.message);

  let action: "created" | "updated";
  if (existing?.[0]) {
    const { error } = await db.from("products").update(patch as never).eq("id", existing[0].id);
    if (error) throw new ResourceError(500, `product update failed: ${error.message}`);
    action = "updated";
  } else {
    if (!input.name) throw new ResourceError(400, "name is required to create a product");
    const { error } = await mw(db, "products").insert({
      ...patch,
      org_id: actor.orgId,
      sku,
      name: input.name,
      status: input.status ?? "active",
    });
    if (error) throw new ResourceError(500, `product create failed: ${error.message}`);
    action = "created";
  }
  // Forward to the hub (system of record) via the outbox.
  const conn = await hubConn(db, actor.orgId);
  if (conn) await enqueueDelivery(db, actor.orgId, "products.upsert", { ...input, sku });
  return { sku, action };
}

// ── Orders ───────────────────────────────────────────────────────────────────

export async function listOrders(db: Db, actor: Actor, status?: string) {
  requireScope(actor, "orders:read");
  const conn = await hubConn(db, actor.orgId);
  if (conn) {
    const result = await callHub(conn, "orders.list", status ? { status } : {});
    await touchConnection(db, conn, result.ok ? null : result.error ?? null);
    if (!result.ok) throw new ResourceError(502, `hub orders.list failed: ${result.error}`);
    return (result.data as { orders: unknown[] }).orders;
  }
  let query = db
    .from("purchase_orders")
    .select(
      "id, po_number, status, total_amount, created_at, ship_to_address, buyer:organizations!purchase_orders_buyer_org_id_fkey(name), lines:purchase_order_lines(sku, name, quantity, unit_price)",
    )
    .eq("seller_org_id", actor.orgId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new ResourceError(500, `orders query failed: ${error.message}`);
  return (data ?? []).map((o) => ({
    id: o.id,
    po_number: o.po_number,
    status: o.status,
    total_amount: o.total_amount,
    created_at: o.created_at,
    buyer: o.buyer?.name ?? null,
    ship_to: o.ship_to_address,
    lines: o.lines,
  }));
}

export async function getOrder(db: Db, actor: Actor, idOrPo: string) {
  requireScope(actor, "orders:read");
  let query = db
    .from("purchase_orders")
    .select(
      "id, po_number, status, subtotal, total_amount, currency, created_at, updated_at, confirmed_at, ship_to_address, notes, buyer:organizations!purchase_orders_buyer_org_id_fkey(name), lines:purchase_order_lines(sku, name, quantity, unit_price, total_price)",
    )
    .eq("seller_org_id", actor.orgId)
    .limit(1);
  query = UUID_RE.test(idOrPo) ? query.eq("id", idOrPo) : query.eq("po_number", idOrPo);
  const { data, error } = await query;
  if (error) throw new ResourceError(500, `order query failed: ${error.message}`);
  if (!data?.[0]) throw new ResourceError(404, `no order matches ${idOrPo}`);
  return data[0];
}

export interface OrderInput {
  po_number?: string;
  buyer_org_id?: string;
  ship_to?: string;
  notes?: string;
  lines: { sku: string; quantity: number; unit_price?: number }[];
}

export async function createOrder(db: Db, actor: Actor, input: OrderInput) {
  requireScope(actor, "orders:write");
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new ResourceError(400, "lines[] is required");
  }
  // Buyer defaults to the org's first linked EDI partner (the common case:
  // one trading partner submitting through this key).
  let buyerOrgId = input.buyer_org_id ?? null;
  if (!buyerOrgId) {
    const { data: partner } = await db
      .from("edi_partners")
      .select("partner_org_id")
      .eq("org_id", actor.orgId)
      .eq("is_active", true)
      .not("partner_org_id", "is", null)
      .limit(1);
    buyerOrgId = partner?.[0]?.partner_org_id ?? null;
  }
  if (!buyerOrgId) throw new ResourceError(400, "buyer_org_id is required (no linked trading partner to default to)");

  const resolved = [];
  for (const line of input.lines) {
    if (!line.sku || !Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new ResourceError(400, "each line needs sku and a positive quantity");
    }
    const { data: products, error } = await db
      .from("products")
      .select("id, sku, name")
      .eq("org_id", actor.orgId)
      .ilike("sku", line.sku)
      .limit(1);
    if (error) throw new ResourceError(500, error.message);
    if (!products?.[0]) throw new ResourceError(422, `no product matches sku ${line.sku}`);
    resolved.push({
      product_id: products[0].id,
      sku: products[0].sku,
      name: products[0].name,
      quantity: Math.trunc(line.quantity),
      unit_price: line.unit_price ?? 0,
    });
  }

  const poNumber = input.po_number?.trim() || `API-${Date.now()}-${randomBytes(2).toString("hex").toUpperCase()}`;
  const subtotal = resolved.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
  const { data: order, error: orderError } = await db
    .from("purchase_orders")
    .insert({
      po_number: poNumber,
      buyer_org_id: buyerOrgId,
      seller_org_id: actor.orgId,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      ship_to_address: input.ship_to ?? null,
      notes: input.notes ?? null,
      subtotal,
      total_amount: subtotal,
    })
    .select("id")
    .single();
  if (orderError) throw new ResourceError(500, `order create failed: ${orderError.message}`);

  const { error: linesError } = await db.from("purchase_order_lines").insert(
    resolved.map((l, i) => ({ order_id: order.id, ...l, sort_order: i })),
  );
  if (linesError) {
    await db.from("purchase_orders").delete().eq("id", order.id);
    throw new ResourceError(500, `order lines failed: ${linesError.message}`);
  }
  // Staged locally, forwarded to the hub via the outbox.
  const conn = await hubConn(db, actor.orgId);
  if (conn) {
    await enqueueDelivery(db, actor.orgId, "orders.create", {
      po_number: poNumber,
      buyer_org_id: buyerOrgId,
      ship_to: input.ship_to ?? null,
      notes: input.notes ?? null,
      lines: resolved.map(({ sku, quantity, unit_price }) => ({ sku, quantity, unit_price })),
    });
  }
  return { id: order.id, po_number: poNumber, status: "submitted", total_amount: subtotal };
}

export async function ackOrder(db: Db, actor: Actor, idOrPo: string) {
  requireScope(actor, "orders:write");
  const conn = await hubConn(db, actor.orgId);
  if (conn) {
    const payload = UUID_RE.test(idOrPo) ? { order_id: idOrPo } : { po_number: idOrPo };
    const result = await callHub(conn, "orders.ack", payload);
    await touchConnection(db, conn, result.ok ? null : result.error ?? null);
    if (!result.ok) {
      throw new ResourceError(result.status === 404 ? 404 : 502, result.error ?? "hub ack failed");
    }
    return result.data as object;
  }
  let query = db
    .from("purchase_orders")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("seller_org_id", actor.orgId)
    .eq("status", "submitted");
  query = UUID_RE.test(idOrPo) ? query.eq("id", idOrPo) : query.eq("po_number", idOrPo);
  const { data, error } = await query.select("id, po_number");
  if (error) throw new ResourceError(500, `ack failed: ${error.message}`);
  if (!data?.length) throw new ResourceError(404, "no submitted order matched");
  return { acknowledged: data.length, orders: data };
}

const ORDER_STATUSES = ["confirmed", "processing", "shipped", "delivered", "cancelled"];

export async function updateOrderStatus(db: Db, actor: Actor, idOrPo: string, status: string) {
  requireScope(actor, "orders:write");
  if (!ORDER_STATUSES.includes(status)) {
    throw new ResourceError(400, `status must be one of ${ORDER_STATUSES.join(", ")}`);
  }
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "shipped") patch.shipped_at = new Date().toISOString();
  if (status === "delivered") patch.delivered_at = new Date().toISOString();
  let query = db.from("purchase_orders").update(patch as never).eq("seller_org_id", actor.orgId);
  query = UUID_RE.test(idOrPo) ? query.eq("id", idOrPo) : query.eq("po_number", idOrPo);
  const { data, error } = await query.select("id, po_number, status");
  if (error) throw new ResourceError(500, `status update failed: ${error.message}`);
  if (!data?.length) throw new ResourceError(404, `no order matches ${idOrPo}`);
  const conn = await hubConn(db, actor.orgId);
  if (conn) await enqueueDelivery(db, actor.orgId, "orders.update_status", { po_number: data[0]!.po_number, status });
  return data[0];
}

// ── Inventory ────────────────────────────────────────────────────────────────

export async function pushInventory(db: Db, actor: Actor, rows: InventoryRow[]) {
  requireScope(actor, "inventory:write");
  const clean = rows
    .map((r) => ({ sku: String(r.sku ?? "").trim(), qty: Number(r.qty) }))
    .filter((r) => r.sku && Number.isFinite(r.qty))
    .map((r) => ({ sku: r.sku, qty: Math.trunc(r.qty) }));
  const conn = await hubConn(db, actor.orgId);
  if (conn) {
    try {
      const result = await callHub(conn, "inventory.push", { rows: clean });
      await touchConnection(db, conn, result.ok ? null : result.error ?? null);
      if (!result.ok) throw new ResourceError(502, result.error ?? `hub returned status ${result.status}`);
      return { ...(result.data as object), queued: false };
    } catch (err) {
      if (err instanceof ResourceError) throw err;
      const deliveryId = await enqueueDelivery(db, actor.orgId, "inventory.push", { rows: clean });
      return { queued: true, delivery_id: deliveryId };
    }
  }
  const rules = await getStockStatusRules(db, actor.orgId);
  const result = await applyInventoryRows(db, actor.orgId, clean, rules);
  return { updated: result.updated, unknown_skus: result.unknownSkus, queued: false };
}

// ── Warranty claims ──────────────────────────────────────────────────────────

export interface ClaimInput {
  sku?: string;
  dot_number?: string;
  quantity?: number;
  description: string;
  customer_ref?: string;
}

export async function listClaims(db: Db, actor: Actor, status?: string) {
  requireScope(actor, "warranty:read");
  let query = mw(db, "warranty_claims")
    .select("id, claim_number, sku, dot_number, quantity, description, customer_ref, status, resolution, created_at, updated_at")
    .eq("org_id", actor.orgId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new ResourceError(500, `claims query failed: ${error.message}`);
  return data ?? [];
}

export async function getClaim(db: Db, actor: Actor, idOrNumber: string) {
  requireScope(actor, "warranty:read");
  let query = mw(db, "warranty_claims").select("*").eq("org_id", actor.orgId).limit(1);
  query = UUID_RE.test(idOrNumber) ? query.eq("id", idOrNumber) : query.eq("claim_number", idOrNumber);
  const { data, error } = await query;
  if (error) throw new ResourceError(500, error.message);
  if (!data?.[0]) throw new ResourceError(404, `no claim matches ${idOrNumber}`);
  return data[0];
}

export async function createClaim(db: Db, actor: Actor, input: ClaimInput) {
  requireScope(actor, "warranty:write");
  if (!input.description?.trim()) throw new ResourceError(400, "description is required");
  let productId: string | null = null;
  if (input.sku) {
    const { data: products } = await db
      .from("products")
      .select("id")
      .eq("org_id", actor.orgId)
      .ilike("sku", input.sku)
      .limit(1);
    productId = products?.[0]?.id ?? null;
  }
  const claimNumber = `WC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const { data, error } = await mw(db, "warranty_claims")
    .insert({
      org_id: actor.orgId,
      claim_number: claimNumber,
      product_id: productId,
      sku: input.sku ?? null,
      dot_number: input.dot_number ?? null,
      quantity: input.quantity && input.quantity > 0 ? Math.trunc(input.quantity) : 1,
      description: input.description.trim(),
      customer_ref: input.customer_ref ?? null,
      created_by_client_id: actor.clientId,
    })
    .select("id, claim_number, status")
    .single();
  if (error) throw new ResourceError(500, `claim create failed: ${error.message}`);
  const conn = await hubConn(db, actor.orgId);
  if (conn) {
    await enqueueDelivery(db, actor.orgId, "warranty.claim.create", { claim_number: claimNumber, ...input });
  }
  return data;
}

const CLAIM_STATUSES = ["submitted", "under_review", "approved", "denied", "closed"];

// The hub's warranty.claim.update accepts only these statuses; adjudication
// (approved/denied) is hub-internal by design and must stay local — the hub
// returns 400 for anything else, which would dead-letter the delivery.
const HUB_CLAIM_STATUSES = ["under_review", "closed"];

export async function updateClaim(
  db: Db,
  actor: Actor,
  idOrNumber: string,
  patch: { status?: string; resolution?: string },
) {
  requireScope(actor, "warranty:write");
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) {
    if (!CLAIM_STATUSES.includes(patch.status)) {
      throw new ResourceError(400, `status must be one of ${CLAIM_STATUSES.join(", ")}`);
    }
    update.status = patch.status;
  }
  if (patch.resolution !== undefined) update.resolution = patch.resolution;
  let query = mw(db, "warranty_claims").update(update).eq("org_id", actor.orgId);
  query = UUID_RE.test(idOrNumber) ? query.eq("id", idOrNumber) : query.eq("claim_number", idOrNumber);
  const { data, error } = await query.select("id, claim_number, status, resolution");
  if (error) throw new ResourceError(500, error.message);
  if (!data?.length) throw new ResourceError(404, `no claim matches ${idOrNumber}`);
  // Forward only what the hub accepts; local adjudication stays local.
  const hubPatch: Record<string, unknown> = {};
  if (patch.status !== undefined && HUB_CLAIM_STATUSES.includes(patch.status)) hubPatch.status = patch.status;
  if (patch.resolution !== undefined) hubPatch.resolution = patch.resolution;
  if (Object.keys(hubPatch).length > 0) {
    const conn = await hubConn(db, actor.orgId);
    if (conn) {
      await enqueueDelivery(db, actor.orgId, "warranty.claim.update", {
        claim_number: data[0]!.claim_number,
        ...hubPatch,
      });
    }
  }
  return data[0];
}

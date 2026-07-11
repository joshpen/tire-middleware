import type { Db } from "../db.js";

/**
 * The middleware's only line to the hub: the hub's public api_gateway
 * function (PostgREST RPC), authenticated with a hub-issued API key that the
 * hub can scope, rate-limit, revoke, and audit. No shared database, no
 * service-role access — the hub controls exactly what this layer can do.
 *
 * Hub resources available today (verified against the hub 2026-07-10):
 *   products.list, products.upsert
 *   orders.list, orders.ack, orders.create, orders.update_status
 *   shipments.get, invoices.get, changes.since
 *   inventory.push, edi.receive
 *   warranty.claim.create, warranty.claim.update (status under_review/closed
 *     only — adjudication is hub-internal)
 *   portal.request.create + aliases portal.{quote,appointment,warranty,fleet}.create
 *   content.profile, content.branding, content.locations, content.promotions,
 *     content.categories
 * Anything else is "unsupported" until the hub grows the endpoint (the hub
 * repo is not modified from here).
 */

export interface HubConnection {
  id: string;
  org_id: string;
  name: string;
  hub_url: string;
  anon_key: string;
  api_key: string;
  is_active: boolean;
  last_ok_at: string | null;
  last_error: string | null;
}

export interface HubResult {
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
}

export const HUB_RESOURCES = [
  "products.list",
  "products.upsert",
  "orders.list",
  "orders.ack",
  "orders.create",
  "orders.update_status",
  "shipments.get",
  "invoices.get",
  "changes.since",
  "inventory.push",
  "edi.receive",
  "warranty.claim.create",
  "warranty.claim.update",
  "portal.request.create",
  "portal.quote.create",
  "portal.appointment.create",
  "portal.warranty.create",
  "portal.fleet.create",
  "content.profile",
  "content.branding",
  "content.locations",
  "content.promotions",
  "content.categories",
] as const;

/** Untyped access to middleware-owned tables (not in the vendored hub types). */
export const mw = (db: Db, table: string) => (db.from as (t: string) => any)(table);

export async function getHubConnection(db: Db, orgId: string): Promise<HubConnection | null> {
  const { data, error } = await mw(db, "hub_connections")
    .select("id, org_id, name, hub_url, anon_key, api_key, is_active, last_ok_at, last_error")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`hub connection lookup failed: ${error.message}`);
  return (data as HubConnection) ?? null;
}

/**
 * One call to the hub. Never throws for hub-level failures — returns the
 * hub's own {ok, status, error} envelope. Throws only on network failure so
 * callers can distinguish "hub said no" from "couldn't reach the hub".
 */
export async function callHub(conn: HubConnection, resource: string, payload: unknown = {}): Promise<HubResult> {
  const url = `${conn.hub_url.replace(/\/$/, "")}/rest/v1/rpc/api_gateway`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: conn.anon_key,
      Authorization: `Bearer ${conn.anon_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ api_key: conn.api_key, resource, payload }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, status: res.status, error: `hub transport error ${res.status}: ${body.slice(0, 300)}` };
  }
  const envelope = (await res.json()) as { ok: boolean; status: number; data?: unknown; error?: string };
  return envelope;
}

/** Records connection health on the connection row (best effort). */
export async function touchConnection(db: Db, conn: HubConnection, error: string | null): Promise<void> {
  await mw(db, "hub_connections")
    .update(
      error
        ? { last_error: error.slice(0, 500), updated_at: new Date().toISOString() }
        : { last_ok_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() },
    )
    .eq("id", conn.id);
}

/** Verifies a connection end to end with the cheapest scoped call. */
export async function testConnection(db: Db, conn: HubConnection): Promise<HubResult & { products?: number }> {
  try {
    const result = await callHub(conn, "products.list");
    await touchConnection(db, conn, result.ok ? null : result.error ?? `status ${result.status}`);
    const products = result.ok ? ((result.data as { products?: unknown[] })?.products?.length ?? 0) : undefined;
    return { ...result, products };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await touchConnection(db, conn, message);
    return { ok: false, status: 0, error: `network: ${message}` };
  }
}

/**
 * Pulls the hub's product catalog into the local products table — the
 * middleware's SKU-resolution cache for EDI/CSV mapping. Upserts by (org, sku).
 */
export async function syncCatalog(db: Db, conn: HubConnection): Promise<{ synced: number; error?: string }> {
  const result = await callHub(conn, "products.list");
  if (!result.ok) {
    await touchConnection(db, conn, result.error ?? `status ${result.status}`);
    return { synced: 0, error: result.error ?? `hub returned status ${result.status}` };
  }
  const products = ((result.data as { products?: Record<string, unknown>[] })?.products ?? []);
  let synced = 0;
  for (const p of products) {
    if (!p.sku) continue;
    const { data: existing } = await db
      .from("products")
      .select("id")
      .eq("org_id", conn.org_id)
      .ilike("sku", String(p.sku))
      .limit(1);
    const row = {
      name: String(p.name ?? p.sku),
      status: String(p.status ?? "active"),
      stock_qty: typeof p.stock_qty === "number" ? p.stock_qty : null,
      stock_status: String(p.stock_status ?? "in_stock"),
      bin_location: (p.bin_location as string) ?? null,
      updated_at: new Date().toISOString(),
    };
    if (existing?.[0]) {
      const { error } = await db.from("products").update(row).eq("id", existing[0].id);
      if (!error) synced++;
    } else {
      const { error } = await mw(db, "products").insert({ ...row, org_id: conn.org_id, sku: String(p.sku) });
      if (!error) synced++;
    }
  }
  await touchConnection(db, conn, null);
  return { synced };
}

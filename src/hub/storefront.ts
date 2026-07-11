import type { Db } from "../db.js";
import { mw } from "./connector.js";

/**
 * Thin client for the hub's consumer storefront API — the publishable-key
 * surface documented by GET {hub_url}/api/storefront/v1/openapi.yaml:
 * site / inventory / slots (GET) and bookings / orders / quotes /
 * coupon-check (POST), per dealer slug, auth via X-Storefront-Key.
 *
 * This is the intended surface for consumer-facing dealer-site embeds
 * (Lovable/V0); the api_gateway RPC (connector.ts) remains the secret-key
 * machine surface. The publishable key is NOT the gateway bearer key — it
 * lives on hub_connections.storefront_key so agents never handle it.
 */

export class StorefrontError extends Error {
  public statusCode: number;
  constructor(public status: number, message: string) {
    super(message);
    this.statusCode = status;
  }
}

export interface StorefrontConnection {
  hub_url: string;
  storefront_key: string;
}

export async function getStorefrontConnection(db: Db, orgId: string): Promise<StorefrontConnection> {
  const { data, error } = await mw(db, "hub_connections")
    .select("hub_url, storefront_key")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new StorefrontError(500, `hub connection lookup failed: ${error.message}`);
  if (!data) throw new StorefrontError(404, "no active hub connection for this org");
  if (!data.storefront_key) {
    throw new StorefrontError(400, "no storefront key on the hub connection — set hub_connections.storefront_key (publishable key from the hub)");
  }
  return data as StorefrontConnection;
}

/** Default dealer slug: the org's portal settings row. */
export async function dealerSlugFor(db: Db, orgId: string): Promise<string> {
  const { data } = await mw(db, "dealer_portal_settings").select("slug").eq("dealer_id", orgId).maybeSingle();
  if (!data?.slug) throw new StorefrontError(400, "no dealer portal slug for this org — pass dealer_slug explicitly");
  return data.slug as string;
}

/**
 * One storefront call. Endpoint paths follow the hub's OpenAPI spec
 * ({hub_url}/api/storefront/v1/openapi.yaml); this is the single place to
 * adjust if the spec's path shape changes.
 */
export async function callStorefront(
  conn: StorefrontConnection,
  dealerSlug: string,
  method: "GET" | "POST",
  endpoint: string,
  options: { query?: Record<string, string>; body?: unknown } = {},
): Promise<unknown> {
  const base = `${conn.hub_url.replace(/\/$/, "")}/api/storefront/v1/dealers/${encodeURIComponent(dealerSlug)}`;
  const url = new URL(`${base}/${endpoint}`);
  for (const [k, v] of Object.entries(options.query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      "X-Storefront-Key": conn.storefront_key,
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!res.ok) {
    const message = typeof payload === "object" && payload && "error" in payload
      ? String((payload as { error: unknown }).error)
      : text.slice(0, 300);
    throw new StorefrontError(res.status, `storefront ${endpoint} failed (${res.status}): ${message}`);
  }
  return payload;
}

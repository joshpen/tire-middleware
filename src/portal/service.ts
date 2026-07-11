import { createHash, randomBytes } from "node:crypto";
import { SlidingWindowRateLimiter } from "../auth/rateLimiter.js";
import type { Db } from "../db.js";
import { callHub, getHubConnection, mw } from "../hub/connector.js";
import { enqueueDelivery } from "../hub/outbox.js";

/**
 * Portal-safe service layer: everything the public headless portal can do,
 * independent of HTTP so routes, widgets, SDK server-side use, and MCP tools
 * share one implementation. Every function takes the validated PortalContext
 * produced by validatePortalAccess — tenant isolation and module gating
 * happen exactly once, there.
 *
 * The gateway renders nothing and approves nothing: reads return the dealer's
 * portal-safe content only; writes create portal_requests rows (staged, then
 * forwarded to the hub via the outbox). Warranty intake starts a claim flow;
 * it never approves, denies, or computes reimbursement.
 */

export type PortalModule = "quote" | "booking" | "warranty" | "fleet" | "services" | "promotions" | "catalog" | "events";

export class PortalError extends Error {
  public statusCode: number;
  constructor(public status: number, message: string) {
    super(message);
    this.statusCode = status;
  }
}

export interface PortalSettings {
  id: string;
  dealer_id: string;
  slug: string;
  portal_enabled: boolean;
  headless_enabled: boolean;
  quote_enabled: boolean;
  booking_enabled: boolean;
  warranty_enabled: boolean;
  fleet_enabled: boolean;
  services_enabled: boolean;
  promotions_enabled: boolean;
  catalog_enabled: boolean;
  allowed_origins: string[];
  profile: Record<string, unknown>;
}

export interface PortalKey {
  id: string;
  dealer_id: string;
  allowed_origins: string[];
  allowed_modules: string[];
  rate_limit: { per_minute?: number };
  status: string;
}

export interface PortalContext {
  settings: PortalSettings;
  key: PortalKey;
  origin: string | null;
  source: "hosted_portal" | "embed" | "lovable" | "api";
  ipHash: string | null;
  userAgentHash: string | null;
}

const MODULE_FLAG: Record<PortalModule, keyof PortalSettings> = {
  quote: "quote_enabled",
  booking: "booking_enabled",
  warranty: "warranty_enabled",
  fleet: "fleet_enabled",
  services: "services_enabled",
  promotions: "promotions_enabled",
  catalog: "catalog_enabled",
  events: "portal_enabled",
};

export const sha256 = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");

const limiter = new SlidingWindowRateLimiter();

/** Origin allowlist check; local development origins are always allowed. */
export function originAllowed(origin: string | null, allowed: string[]): boolean {
  if (!origin) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
  const normalized = `${url.protocol}//${url.host}`.toLowerCase();
  return allowed.some((a) => a.trim().toLowerCase().replace(/\/$/, "") === normalized);
}

/**
 * The single gate for every portal call: dealer slug → active settings,
 * token → active key belonging to that dealer, module enabled for both the
 * dealer and the key, origin allowlisted, rate limit within budget.
 */
export async function validatePortalAccess(
  db: Db,
  dealerSlug: string,
  rawToken: string | null,
  origin: string | null,
  module: PortalModule,
  meta: { ip?: string; userAgent?: string; source?: string } = {},
): Promise<PortalContext> {
  const { data: settings, error } = await mw(db, "dealer_portal_settings")
    .select("*")
    .eq("slug", dealerSlug)
    .maybeSingle();
  if (error) throw new PortalError(500, "portal unavailable");
  if (!settings || !settings.portal_enabled || !settings.headless_enabled) {
    throw new PortalError(404, "dealer portal not found");
  }

  if (!rawToken) throw new PortalError(401, "portal key required");
  const { data: key } = await mw(db, "portal_api_keys")
    .select("id, dealer_id, allowed_origins, allowed_modules, rate_limit, status")
    .eq("hashed_token", sha256(rawToken))
    .maybeSingle();
  // A valid key for another dealer must behave exactly like an invalid key —
  // no cross-tenant probing.
  if (!key || key.status !== "active" || key.dealer_id !== settings.dealer_id) {
    throw new PortalError(401, "invalid portal key");
  }

  const flag = MODULE_FLAG[module];
  if (!settings[flag]) throw new PortalError(403, `module ${module} is not enabled for this dealer`);
  if (module !== "events" && !key.allowed_modules.includes(module)) {
    throw new PortalError(403, `module ${module} is not enabled for this key`);
  }

  const dealerOrigins = Array.isArray(settings.allowed_origins) ? settings.allowed_origins : [];
  const keyOrigins = Array.isArray(key.allowed_origins) && key.allowed_origins.length ? key.allowed_origins : null;
  if (!originAllowed(origin, keyOrigins ?? dealerOrigins)) {
    throw new PortalError(403, "origin not allowed");
  }

  const perMinute = key.rate_limit?.per_minute ?? 120;
  const IP_BUDGET_PER_MIN = 600; // coarse per-IP cap across all keys
  if (!limiter.allow(`portal:${key.id}`, perMinute) || !limiter.allow(`portal-ip:${meta.ip ?? "?"}`, IP_BUDGET_PER_MIN)) {
    throw new PortalError(429, "rate limit exceeded");
  }

  mw(db, "portal_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id).then(() => {});

  const source = (["hosted_portal", "embed", "lovable", "api"].includes(meta.source ?? "") ? meta.source : "api") as PortalContext["source"];
  return {
    settings: settings as PortalSettings,
    key: key as PortalKey,
    origin,
    source,
    ipHash: meta.ip ? sha256(meta.ip).slice(0, 32) : null,
    userAgentHash: meta.userAgent ? sha256(meta.userAgent).slice(0, 32) : null,
  };
}

// ── Portal-safe reads ────────────────────────────────────────────────────────
// Hub-connected dealers read live dealer-safe content from the hub's
// content.* resources (short in-memory TTL); the dealer's locally curated
// portal profile is the fallback when the hub is unreachable or not
// connected. Nothing here can reach inventory, cost, margin, suppliers,
// customers, or POS data.

const profileOf = (ctx: PortalContext) => (ctx.settings.profile ?? {}) as Record<string, unknown>;

const CONTENT_TTL_MS = 60_000;
const contentCache = new Map<string, { at: number; data: unknown }>();

/**
 * Live-first content read. Failures (no connection, hub down, hub error) are
 * negative-cached for the same TTL so an unreachable hub costs at most one
 * attempt per dealer/resource per minute.
 */
async function hubContent(db: Db, ctx: PortalContext, resource: string): Promise<unknown> {
  const cacheKey = `${ctx.settings.dealer_id}:${resource}`;
  const hit = contentCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CONTENT_TTL_MS) return hit.data;
  let data: unknown = null;
  try {
    const conn = await getHubConnection(db, ctx.settings.dealer_id);
    if (conn) {
      const result = await callHub(conn, resource, { dealer_slug: ctx.settings.slug });
      if (result.ok) data = result.data ?? null;
    }
  } catch {
    // network failure → fall back to the local profile
  }
  contentCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

/** Accepts both bare payloads and {key: …} envelopes from the hub. */
function unwrap(data: unknown, key: string): unknown {
  if (data && typeof data === "object" && !Array.isArray(data) && key in (data as Record<string, unknown>)) {
    return (data as Record<string, unknown>)[key];
  }
  return data;
}

const asObject = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const asArray = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null);

/** For tests / operators: drop all cached hub content. */
export function clearPortalContentCache(): void {
  contentCache.clear();
}

export async function getPublicDealerProfile(db: Db, ctx: PortalContext) {
  const live = asObject(unwrap(await hubContent(db, ctx, "content.profile"), "profile"));
  const p = live ?? profileOf(ctx);
  return {
    slug: ctx.settings.slug,
    display_name: p.display_name ?? ctx.settings.slug,
    logo_url: p.logo_url ?? null,
    contact: p.contact ?? {},
    service_areas: p.service_areas ?? [],
    modules: {
      quote: ctx.settings.quote_enabled,
      booking: ctx.settings.booking_enabled,
      warranty: ctx.settings.warranty_enabled,
      fleet: ctx.settings.fleet_enabled,
      services: ctx.settings.services_enabled,
      promotions: ctx.settings.promotions_enabled,
      catalog: ctx.settings.catalog_enabled,
    },
    metadata: p.metadata ?? {},
  };
}

export async function getPublicDealerBrand(db: Db, ctx: PortalContext) {
  const live = asObject(unwrap(await hubContent(db, ctx, "content.branding"), "branding"));
  const brand = live ?? ((profileOf(ctx).brand ?? {}) as Record<string, unknown>);
  return {
    logo_url: brand.logo_url ?? profileOf(ctx).logo_url ?? null,
    primary_color: brand.primary_color ?? "#1f2937",
    secondary_color: brand.secondary_color ?? "#4b5563",
    accent_color: brand.accent_color ?? "#2563eb",
    typography: brand.typography ?? "system",
    theme: brand.theme ?? "light",
    display: brand.display ?? {},
  };
}

export async function getPublicDealerServices(db: Db, ctx: PortalContext) {
  // The hub has no content.services resource; services ride on the profile.
  const live = asObject(unwrap(await hubContent(db, ctx, "content.profile"), "profile"));
  return asArray(live?.services) ?? (profileOf(ctx).services as unknown[]) ?? [];
}

export async function getPublicDealerLocations(db: Db, ctx: PortalContext) {
  const live = asArray(unwrap(await hubContent(db, ctx, "content.locations"), "locations"));
  return live ?? (profileOf(ctx).locations as unknown[]) ?? [];
}

export async function getPublicDealerPromotions(db: Db, ctx: PortalContext) {
  const live = asArray(unwrap(await hubContent(db, ctx, "content.promotions"), "promotions"));
  const promos = (live ?? (profileOf(ctx).promotions as unknown[]) ?? []) as Record<string, unknown>[];
  return promos.filter((p) => p.active !== false);
}

export async function getPublicCatalogCategories(db: Db, ctx: PortalContext) {
  const live = asArray(unwrap(await hubContent(db, ctx, "content.categories"), "categories"));
  return live ?? (profileOf(ctx).catalog_categories as unknown[]) ?? [];
}

// ── Portal request intake ────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\-.\s\d]{7,20}$/;

const clean = (v: unknown, max = 500): string | null => {
  if (typeof v !== "string") return null;
  const s = v.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

interface CustomerFields {
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
}

function customerOf(payload: Record<string, unknown>, require: boolean): CustomerFields {
  const name = clean(payload.customer_name ?? payload.name, 120);
  const email = clean(payload.customer_email ?? payload.email, 200);
  const phone = clean(payload.customer_phone ?? payload.phone, 30);
  if (email && !EMAIL_RE.test(email)) throw new PortalError(400, "invalid email address");
  if (phone && !PHONE_RE.test(phone)) throw new PortalError(400, "invalid phone number");
  if (require && !email && !phone) throw new PortalError(400, "an email or phone number is required");
  return { customer_name: name, customer_email: email, customer_phone: phone };
}

/** Whitelisted payload copy — no mass assignment into storage. */
function pickPayload(payload: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = payload[f];
    if (v === undefined || v === null) continue;
    out[f] = typeof v === "string" ? clean(v, 2000) : v;
  }
  return out;
}

async function createRequest(
  db: Db,
  ctx: PortalContext,
  type: "quote" | "appointment" | "warranty" | "fleet",
  customer: CustomerFields,
  payload: Record<string, unknown>,
): Promise<{ id: string; type: string; status: string }> {
  const { data, error } = await mw(db, "portal_requests")
    .insert({
      dealer_id: ctx.settings.dealer_id,
      type,
      source: ctx.source,
      ...customer,
      payload,
      created_by_public_key_id: ctx.key.id,
      origin: ctx.origin,
      ip_hash: ctx.ipHash,
      user_agent_hash: ctx.userAgentHash,
    })
    .select("id, type, status")
    .single();
  if (error) throw new PortalError(500, "could not save your request — please try again");
  // Forward to the hub (system of record) via the outbox. The payload is the
  // hub's portal.request.create contract exactly: portal_request_id is the
  // local row's uuid, persisted with the delivery, so retries reuse it and
  // the hub's (org_id, portal_request_id) idempotency holds.
  const conn = await getHubConnection(db, ctx.settings.dealer_id);
  if (conn) {
    await enqueueDelivery(db, ctx.settings.dealer_id, `portal.${type}.create`, {
      portal_request_id: data.id,
      type,
      dealer_slug: ctx.settings.slug,
      ...customer,
      ...payload,
    }).catch(() => {});
  }
  return data;
}

export async function createPortalQuoteRequest(db: Db, ctx: PortalContext, payload: Record<string, unknown>) {
  const customer = customerOf(payload, true);
  const fields = pickPayload(payload, [
    "tire_size", "vehicle", "service_type", "quantity", "notes", "location_preference", "consent",
  ]);
  return createRequest(db, ctx, "quote", customer, fields);
}

export async function createPortalAppointmentRequest(db: Db, ctx: PortalContext, payload: Record<string, unknown>) {
  const customer = customerOf(payload, true);
  const fields = pickPayload(payload, [
    "service_type", "preferred_date", "preferred_time_window", "location", "vehicle", "notes", "mobile_service",
  ]);
  // A request, never a guaranteed appointment: confirmation stays with the dealer.
  return createRequest(db, ctx, "appointment", customer, { ...fields, auto_confirmed: false });
}

export async function createPortalWarrantyIntake(db: Db, ctx: PortalContext, payload: Record<string, unknown>) {
  const customer = customerOf(payload, true);
  const fields = pickPayload(payload, [
    "tire_info", "purchase_info", "tread_depth_32nds", "dot_number", "issue_description",
    "attachments", "preferred_followup",
  ]);
  if (!fields.issue_description) throw new PortalError(400, "issue_description is required");
  // Intake only — approval, denial, and reimbursement never happen here.
  return createRequest(db, ctx, "warranty", customer, fields);
}

export async function createPortalFleetInquiry(db: Db, ctx: PortalContext, payload: Record<string, unknown>) {
  const customer = customerOf(payload, true);
  const fields = pickPayload(payload, [
    "business_name", "contact_person", "fleet_size", "vehicle_types", "service_needs", "locations", "notes", "urgency",
  ]);
  if (!fields.business_name) throw new PortalError(400, "business_name is required");
  return createRequest(db, ctx, "fleet", customer, fields);
}

const EVENT_NAMES = new Set([
  "quote_started", "quote_submitted", "booking_started", "booking_submitted",
  "warranty_started", "warranty_submitted", "fleet_inquiry_submitted",
  "promotion_viewed", "cta_clicked", "widget_loaded",
]);

export async function recordPortalAnalyticsEvent(db: Db, ctx: PortalContext, payload: Record<string, unknown>) {
  const eventName = clean(payload.event_name, 60);
  if (!eventName || !EVENT_NAMES.has(eventName)) throw new PortalError(400, "unknown event_name");
  const { error } = await mw(db, "portal_events").insert({
    dealer_id: ctx.settings.dealer_id,
    public_key_id: ctx.key.id,
    event_name: eventName,
    session_id: clean(payload.session_id, 80),
    source: ctx.source,
    origin: ctx.origin,
    payload: pickPayload(payload, ["module", "label", "value", "path"]),
  });
  if (error) throw new PortalError(500, "could not record event");
  return { recorded: true };
}

// ── Key management (admin side) ──────────────────────────────────────────────

export function generatePortalKey(): { raw: string; prefix: string; hash: string } {
  const raw = `pk_portal_dealer_${randomBytes(18).toString("hex")}`;
  return { raw, prefix: raw.slice(0, 24) + "…", hash: sha256(raw) };
}

export function buildEmbedCode(baseUrl: string, dealerSlug: string, rawKey: string, widget: string): string {
  return [
    `<div`,
    `  data-tread-ready-widget="${widget}"`,
    `  data-dealer-slug="${dealerSlug}"`,
    `  data-portal-key="${rawKey}">`,
    `</div>`,
    `<script src="${baseUrl}/embed/${widget}.js"></script>`,
  ].join("\n");
}

export function buildLovablePrompt(baseUrl: string, dealerSlug: string, rawKey: string, modules: string[]): string {
  return `Build a customer-facing tire dealer portal using Tread Ready's headless portal API and embed widgets.

Dealer slug: ${dealerSlug}
Portal API base URL: ${baseUrl}/api/portal/v1
Enabled modules: ${modules.join(", ")}
Public portal key: ${rawKey}

Use Tread Ready widgets (script src ${baseUrl}/embed/<widget>.js, widgets: quote, booking, warranty, fleet) or call the portal API directly for: dealer profile/brand (GET /dealers/${dealerSlug}, /brand), services, locations, promotions, catalog categories, and submitting quote requests, appointment requests, warranty intake, and fleet inquiries.

Do not build your own pricing, inventory, warranty approval, payment, tax, or customer account logic. Tread Ready is the system of record. Use the API/widgets only for portal-safe reads and request submissions. Send the portal key as the X-Portal-Key header.

Design the page around the dealer's services, brand colors, locations, and customer-facing service categories. Keep the experience mobile-first and simple.`;
}

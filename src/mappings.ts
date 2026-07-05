import type { Db } from "./db.js";
import { DEFAULT_STOCK_STATUS_RULES, type StockStatusRules } from "./domain/inventory.js";

/**
 * Per-partner EDI mapping profile. Stored as data so a hub UI can manage it:
 * `org_integrations.config.edi_mappings[<edi_partner_id>]` on the org's
 * `file_gateway` provider instance (the gateway's own org-level config row —
 * the gateway owns no schema, and edi_partners has no config column).
 */
export interface EdiPartnerMapping {
  /** Which PO1 product-ID qualifiers to try, in order. Default ["VN", "UP", "BP"]. */
  qualifier_priority?: ("VN" | "UP" | "BP")[];
  /** External identifier → internal SKU cross-reference (case-insensitive keys). */
  sku_xref?: Record<string, string>;
}

export const DEFAULT_QUALIFIER_PRIORITY: ("VN" | "UP" | "BP")[] = ["VN", "UP", "BP"];

const GATEWAY_PROVIDER_KEY = "file_gateway";

/** Reads the org's gateway config row; returns {} when none exists yet. */
export async function getGatewayOrgConfig(db: Db, orgId: string): Promise<Record<string, unknown>> {
  const { data: provider } = await db
    .from("integration_providers")
    .select("id")
    .eq("key", GATEWAY_PROVIDER_KEY)
    .maybeSingle();
  if (!provider) return {};
  const { data: instance } = await db
    .from("org_integrations")
    .select("config")
    .eq("org_id", orgId)
    .eq("provider_id", provider.id)
    .maybeSingle();
  const config = instance?.config;
  return config && typeof config === "object" && !Array.isArray(config) ? (config as Record<string, unknown>) : {};
}

export async function getEdiPartnerMapping(db: Db, orgId: string, partnerId: string): Promise<EdiPartnerMapping> {
  const config = await getGatewayOrgConfig(db, orgId);
  const all = config.edi_mappings;
  if (all && typeof all === "object" && !Array.isArray(all)) {
    const mapping = (all as Record<string, unknown>)[partnerId];
    if (mapping && typeof mapping === "object") return mapping as EdiPartnerMapping;
  }
  return {};
}

export function xrefSku(value: string, xref?: Record<string, string>): string {
  if (!xref) return value;
  const hit = Object.entries(xref).find(([k]) => k.toLowerCase() === value.toLowerCase());
  return hit ? hit[1] : value;
}

/** Org-level stock status thresholds (`stock_status_rules`), or defaults. */
export async function getStockStatusRules(db: Db, orgId: string): Promise<StockStatusRules> {
  const config = await getGatewayOrgConfig(db, orgId);
  const rules = config.stock_status_rules as StockStatusRules | undefined;
  if (rules && Array.isArray(rules.thresholds) && typeof rules.fallback === "string") return rules;
  return DEFAULT_STOCK_STATUS_RULES;
}

/**
 * A dynamic REST object exposed through /v1/objects/:key, declared entirely
 * in config so the API surface grows with the hub's schema:
 *
 *   exposed_objects: {
 *     "inventory": {
 *       table: "dealer_inventory",
 *       scope: "inventory:read",
 *       org_column: "org_id",
 *       select: "sku, name, qty_on_hand, field_values",
 *       writable_fields: ["qty_on_hand"],   // enables POST upsert-by-match
 *       match_field: "sku",
 *       write_scope: "inventory:write"
 *     }
 *   }
 */
export interface ExposedObject {
  table: string;
  scope: string;
  org_column?: string;
  select?: string;
  filterable_fields?: string[];
  writable_fields?: string[];
  match_field?: string;
  write_scope?: string;
  limit?: number;
}

export async function getExposedObjects(db: Db, orgId: string): Promise<Record<string, ExposedObject>> {
  const config = await getGatewayOrgConfig(db, orgId);
  const objects = config.exposed_objects;
  if (!objects || typeof objects !== "object" || Array.isArray(objects)) return {};
  const out: Record<string, ExposedObject> = {};
  for (const [key, value] of Object.entries(objects as Record<string, unknown>)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const candidate = value as ExposedObject;
      if (typeof candidate.table === "string" && typeof candidate.scope === "string") out[key] = candidate;
    }
  }
  return out;
}

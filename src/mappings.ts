import type { Db } from "./db.js";

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

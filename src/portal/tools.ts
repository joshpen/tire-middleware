import { z } from "zod";
import type { Db } from "../db.js";
import { mw } from "../hub/connector.js";
import {
  buildEmbedCode,
  buildLovablePrompt,
  generatePortalKey,
  originAllowed,
} from "./service.js";

/**
 * MCP-safe portal tool layer. Schemas + wrappers only — intentionally NOT
 * wired into the live /mcp endpoint yet, because that endpoint authenticates
 * partner API keys, while these are dealer-admin operations. When an
 * admin-scoped MCP surface is added, register PORTAL_TOOLS there.
 *
 * Safety invariants: no secret credentials, no customer records, no ticket
 * data, no raw DB access, no privileged mutations beyond key issuance for
 * the caller's own dealer. Raw portal keys are returned exactly once at
 * creation and never stored.
 */

export interface PortalToolContext {
  db: Db;
  /** Dealer tenant the admin caller is authorized for. */
  dealerId: string;
  baseUrl: string;
}

async function settingsFor(ctx: PortalToolContext) {
  const { data } = await mw(ctx.db, "dealer_portal_settings").select("*").eq("dealer_id", ctx.dealerId).maybeSingle();
  if (!data) throw new Error("no portal settings for this dealer");
  return data;
}

const enabledModules = (s: Record<string, unknown>) =>
  ["quote", "booking", "warranty", "fleet", "services", "promotions", "catalog"].filter((m) => s[`${m}_enabled`]);

export const PORTAL_TOOLS = {
  get_dealer_portal_profile: {
    description: "The dealer's portal-safe public profile and enabled modules.",
    schema: {},
    handler: async (ctx: PortalToolContext) => {
      const s = await settingsFor(ctx);
      return { slug: s.slug, portal_enabled: s.portal_enabled, headless_enabled: s.headless_enabled, profile: s.profile, modules: enabledModules(s) };
    },
  },
  get_dealer_brand_tokens: {
    description: "The dealer's public brand tokens (colors, logo, typography).",
    schema: {},
    handler: async (ctx: PortalToolContext) => {
      const s = await settingsFor(ctx);
      return (s.profile as Record<string, unknown>)?.brand ?? {};
    },
  },
  get_dealer_services: {
    description: "Customer-facing services configured for the dealer portal.",
    schema: {},
    handler: async (ctx: PortalToolContext) => {
      const s = await settingsFor(ctx);
      return (s.profile as Record<string, unknown>)?.services ?? [];
    },
  },
  get_dealer_locations: {
    description: "Public dealer locations and hours.",
    schema: {},
    handler: async (ctx: PortalToolContext) => {
      const s = await settingsFor(ctx);
      return (s.profile as Record<string, unknown>)?.locations ?? [];
    },
  },
  get_dealer_portal_widgets: {
    description: "Available embeddable widgets and their script URLs.",
    schema: {},
    handler: async (ctx: PortalToolContext) => {
      return ["quote", "booking", "warranty", "fleet"].map((w) => ({
        widget: w,
        script: `${ctx.baseUrl}/embed/${w}.js`,
      }));
    },
  },
  get_embed_code: {
    description: "HTML embed code for a widget. Requires an existing raw portal key (raw keys are never retrievable).",
    schema: { widget: z.enum(["quote", "booking", "warranty", "fleet"]), portal_key: z.string() },
    handler: async (ctx: PortalToolContext, args: { widget: string; portal_key: string }) => {
      const s = await settingsFor(ctx);
      return { embed_code: buildEmbedCode(ctx.baseUrl, s.slug as string, args.portal_key, args.widget) };
    },
  },
  validate_external_portal_config: {
    description: "Check whether an origin + module combination would be accepted by the portal API for this dealer.",
    schema: { origin: z.string(), module: z.string() },
    handler: async (ctx: PortalToolContext, args: { origin: string; module: string }) => {
      const s = await settingsFor(ctx);
      const origins = Array.isArray(s.allowed_origins) ? (s.allowed_origins as string[]) : [];
      return {
        origin_allowed: originAllowed(args.origin, origins),
        module_enabled: enabledModules(s).includes(args.module),
        portal_enabled: Boolean(s.portal_enabled && s.headless_enabled),
      };
    },
  },
  create_portal_api_key: {
    description: "Issue a new restricted public portal key for this dealer. The raw key is returned once and never stored.",
    schema: {
      label: z.string(),
      allowed_modules: z.array(z.string()).optional(),
      allowed_origins: z.array(z.string()).optional(),
    },
    handler: async (
      ctx: PortalToolContext,
      args: { label: string; allowed_modules?: string[]; allowed_origins?: string[] },
    ) => {
      const key = generatePortalKey();
      const { data, error } = await mw(ctx.db, "portal_api_keys")
        .insert({
          dealer_id: ctx.dealerId,
          token_prefix: key.prefix,
          hashed_token: key.hash,
          label: args.label,
          allowed_modules: args.allowed_modules ?? ["quote", "booking", "warranty", "fleet", "services", "promotions", "catalog", "events"],
          allowed_origins: args.allowed_origins ?? [],
          created_by: "mcp",
        })
        .select("id")
        .single();
      if (error) throw new Error(`key creation failed: ${error.message}`);
      return { id: data.id, portal_key: key.raw, shown_once: true };
    },
  },
  get_lovable_prompt: {
    description: "A copyable Lovable prompt for building a dealer portal against this gateway.",
    schema: { portal_key: z.string() },
    handler: async (ctx: PortalToolContext, args: { portal_key: string }) => {
      const s = await settingsFor(ctx);
      return { prompt: buildLovablePrompt(ctx.baseUrl, s.slug as string, args.portal_key, enabledModules(s)) };
    },
  },
} as const;

import type { Db } from "../db.js";

const PROVIDER_KEY = "file_gateway";

const contextCache = new Map<string, string>();

/**
 * integration_runs rows require an org_integrations parent. The gateway owns
 * no schema, but provider/instance rows are data: ensure a `file_gateway`
 * provider and a per-org integration instance exist, and reuse them for
 * every poll run. `createdBy` comes from the file endpoint's created_by.
 */
export async function ensureRunContext(db: Db, orgId: string, createdBy: string): Promise<string> {
  const cached = contextCache.get(orgId);
  if (cached) return cached;

  let { data: provider, error: providerError } = await db
    .from("integration_providers")
    .select("id")
    .eq("key", PROVIDER_KEY)
    .maybeSingle();
  if (providerError) throw new Error(`provider lookup failed: ${providerError.message}`);
  if (!provider) {
    const { data: created, error } = await db
      .from("integration_providers")
      .insert({
        key: PROVIDER_KEY,
        name: "File gateway (SFTP/HTTPS)",
        category: "custom",
        description: "tread-sync-gateway file endpoint polling",
        capabilities: ["file_poll"],
        sort_order: 900,
      })
      .select("id")
      .single();
    if (error) throw new Error(`failed to create ${PROVIDER_KEY} provider: ${error.message}`);
    provider = created;
  }

  let { data: instance, error: instanceError } = await db
    .from("org_integrations")
    .select("id")
    .eq("org_id", orgId)
    .eq("provider_id", provider.id)
    .maybeSingle();
  if (instanceError) throw new Error(`org integration lookup failed: ${instanceError.message}`);
  if (!instance) {
    const { data: created, error } = await db
      .from("org_integrations")
      .insert({
        org_id: orgId,
        provider_id: provider.id,
        status: "active",
        enabled_capabilities: ["file_poll"],
        created_by: createdBy,
      })
      .select("id")
      .single();
    if (error) throw new Error(`failed to create org integration: ${error.message}`);
    instance = created;
  }

  contextCache.set(orgId, instance.id);
  return instance.id;
}

export async function startRun(db: Db, orgIntegrationId: string, orgId: string): Promise<string> {
  const { data, error } = await db
    .from("integration_runs")
    .insert({ org_integration_id: orgIntegrationId, org_id: orgId, capability: "file_poll", status: "running" })
    .select("id")
    .single();
  if (error) throw new Error(`failed to start integration run: ${error.message}`);
  return data.id;
}

export async function finishRun(
  db: Db,
  runId: string,
  status: "success" | "failed" | "skipped",
  recordsProcessed: number,
  detail: string | null,
): Promise<void> {
  const { error } = await db
    .from("integration_runs")
    .update({
      status,
      records_processed: recordsProcessed,
      detail,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) throw new Error(`failed to finish integration run: ${error.message}`);
}

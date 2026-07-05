import type { Db } from "../db.js";
import { applyInventoryRows, applyPriceRows } from "../domain/inventory.js";
import { processInboundInterchange } from "../edi/service.js";
import { applyDynamicRows } from "../dynamic.js";
import { getStockStatusRules } from "../mappings.js";
import { classifyContent, parseGenericCsv, parseInventoryCsv, parsePriceCsv, type CsvMapping } from "./csv.js";
import { ensureRunContext, finishRun, startRun } from "./runs.js";
import {
  fetchHttpsFile,
  fetchSftpFiles,
  type HttpsEndpointConfig,
  type RemoteFile,
  type SftpEndpointConfig,
} from "./transports.js";

const PROCESSED_KEEP = 500;

interface EndpointRow {
  id: string;
  org_id: string;
  name: string;
  kind: string;
  file_type: string;
  config: unknown;
  created_by: string;
}

export interface PollOutcome {
  endpointId: string;
  status: "success" | "failed" | "skipped";
  filesSeen: number;
  recordsProcessed: number;
  errors: string[];
}

function endpointMapping(endpoint: EndpointRow): CsvMapping {
  const config = (endpoint.config ?? {}) as Record<string, unknown>;
  const mapping = config.mapping;
  return mapping && typeof mapping === "object" && !Array.isArray(mapping) ? (mapping as CsvMapping) : {};
}

async function ingestFile(db: Db, endpoint: EndpointRow, file: RemoteFile): Promise<number> {
  const mapping = endpointMapping(endpoint);

  // A dynamic target routes any non-EDI file through the generic engine.
  if (mapping.target && !file.content.trimStart().startsWith("ISA")) {
    const rows = parseGenericCsv(file.content, mapping, mapping.target.match.column);
    const result = await applyDynamicRows(db, endpoint.org_id, rows, mapping.target);
    if (result.errors.length) throw new Error(result.errors.join("; "));
    return result.updated + result.inserted;
  }

  const kind = classifyContent(file.content, endpoint.file_type);
  if (kind === "edi") {
    const result = await processInboundInterchange(db, endpoint.org_id, file.content);
    if (result.status === "error") throw new Error(`edi intake failed: ${result.error}`);
    return result.orderIds.length || 1;
  }
  if (kind === "csv_inventory") {
    const rows = parseInventoryCsv(file.content, mapping);
    const rules = await getStockStatusRules(db, endpoint.org_id);
    const result = await applyInventoryRows(db, endpoint.org_id, rows, rules);
    return result.updated;
  }
  const rows = parsePriceCsv(file.content, mapping);
  const result = await applyPriceRows(db, endpoint.org_id, rows);
  return result.updated;
}

/**
 * Polls one endpoint: fetch new files, classify + ingest each, remember
 * processed identities in config.processed, and record the outcome in
 * integration_runs and the endpoint's last_polled_at/last_error.
 */
export async function pollEndpoint(db: Db, endpoint: EndpointRow): Promise<PollOutcome> {
  const outcome: PollOutcome = {
    endpointId: endpoint.id,
    status: "success",
    filesSeen: 0,
    recordsProcessed: 0,
    errors: [],
  };

  let runId: string | null = null;
  try {
    const orgIntegrationId = await ensureRunContext(db, endpoint.org_id, endpoint.created_by);
    runId = await startRun(db, orgIntegrationId, endpoint.org_id);
  } catch (err) {
    // Run bookkeeping must not block ingestion; the endpoint row still records the outcome.
    outcome.errors.push(`run bookkeeping unavailable: ${err instanceof Error ? err.message : String(err)}`);
  }

  const config = (endpoint.config ?? {}) as Record<string, unknown>;
  const processed = new Set<string>(Array.isArray(config.processed) ? (config.processed as string[]) : []);
  const processedNow: string[] = [];

  try {
    let files: RemoteFile[];
    if (endpoint.kind === "sftp") {
      files = await fetchSftpFiles(config as unknown as SftpEndpointConfig, processed);
    } else if (endpoint.kind === "https") {
      files = await fetchHttpsFile(config as unknown as HttpsEndpointConfig, processed);
    } else {
      throw new Error(`unsupported endpoint kind ${endpoint.kind}`);
    }
    outcome.filesSeen = files.length;

    for (const file of files) {
      try {
        outcome.recordsProcessed += await ingestFile(db, endpoint, file);
        processedNow.push(file.key);
      } catch (err) {
        outcome.errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    outcome.errors.push(err instanceof Error ? err.message : String(err));
    outcome.status = "failed";
  }

  if (outcome.status !== "failed" && outcome.errors.length > 0) outcome.status = "failed";

  // Persist processed-file memory and poll status on the endpoint row.
  const newProcessed = [...processed, ...processedNow].slice(-PROCESSED_KEEP);
  const { error: endpointError } = await db
    .from("file_endpoints")
    .update({
      config: { ...config, processed: newProcessed },
      last_polled_at: new Date().toISOString(),
      last_error: outcome.errors.length ? outcome.errors.join("; ").slice(0, 1000) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", endpoint.id);
  if (endpointError) outcome.errors.push(`endpoint update failed: ${endpointError.message}`);

  if (runId) {
    const detail =
      `${endpoint.name}: ${outcome.filesSeen} file(s), ${outcome.recordsProcessed} record(s)` +
      (outcome.errors.length ? `; errors: ${outcome.errors.join("; ")}` : "");
    await finishRun(db, runId, outcome.status, outcome.recordsProcessed, detail.slice(0, 2000)).catch(() => {});
  }

  return outcome;
}

/** Polls every active file endpoint; failures are isolated per endpoint. */
export async function pollAllEndpoints(db: Db): Promise<PollOutcome[]> {
  const { data: endpoints, error } = await db
    .from("file_endpoints")
    .select("id, org_id, name, kind, file_type, config, created_by")
    .eq("is_active", true);
  if (error) throw new Error(`file_endpoints query failed: ${error.message}`);

  const outcomes: PollOutcome[] = [];
  for (const endpoint of endpoints ?? []) {
    outcomes.push(await pollEndpoint(db, endpoint));
  }
  return outcomes;
}

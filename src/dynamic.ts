import type { Db } from "./db.js";

/**
 * Config-driven ingest destinations. The gateway's built-in paths (products
 * stock, list prices, 850 orders) stay as defaults, but a mapping profile can
 * declare *where* rows land, so new hub tables and dynamic fields are
 * reachable without gateway code changes:
 *
 *   mapping.target = {
 *     table: "dealer_inventory",
 *     match: { column: "sku", field: "sku" },
 *     set: { "qty_on_hand": "qty", "field_values.tread_depth": "tread_mm" },
 *     coerce: { qty_on_hand: "number" },
 *     insert_missing: false,
 *     defaults: { supplier_name: "ACME" }
 *   }
 *
 * `set` maps destination field ← CSV column (normalized header). Dotted
 * fields ("field_values.tread_depth") merge into a jsonb column, which is how
 * the hub's dynamic custom fields are populated. Tables/columns are validated
 * by PostgREST at run time against the live schema, not the vendored types —
 * the gateway keeps working as the hub grows.
 */
export interface IngestTarget {
  table: string;
  /** Org-scoping column, default "org_id". */
  org_column?: string;
  /** CSV column + destination field used to find the row to update. */
  match: { column: string; field: string };
  /** destination field (or "jsonb_col.key") ← CSV column. */
  set: Record<string, string>;
  /** Optional explicit coercion per destination field; default is heuristic. */
  coerce?: Record<string, "number" | "string" | "boolean" | "json">;
  /** Insert rows that match nothing (with defaults + org column). */
  insert_missing?: boolean;
  /** Static values applied on insert. */
  defaults?: Record<string, unknown>;
}

export interface DynamicPlanRow {
  matchValue: string;
  rowId: string | null;
  action: "update" | "insert" | "skip";
  patch: Record<string, unknown>;
  error: string | null;
}

export interface DynamicResult {
  updated: number;
  inserted: number;
  unmatched: string[];
  errors: string[];
}

export function coerceValue(raw: string, kind?: "number" | "string" | "boolean" | "json"): unknown {
  const value = raw.trim();
  if (kind === "string") return value;
  if (kind === "number") {
    const n = Number(value.replace(/^\$/, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (kind === "boolean") return /^(true|1|yes|y)$/i.test(value);
  if (kind === "json") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  // Heuristic: numbers stay numbers, booleans stay booleans, rest is text.
  if (value !== "" && !Number.isNaN(Number(value))) return Number(value);
  if (/^(true|false)$/i.test(value)) return /^true$/i.test(value);
  return value;
}

const normalize = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");

/**
 * Builds the patch for one CSV row: plain fields directly, dotted fields
 * grouped per jsonb root so they can be merged with the existing document.
 */
export function buildPatch(
  row: Record<string, string>,
  target: IngestTarget,
  existingJson: (root: string) => Record<string, unknown> | null,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const jsonRoots = new Map<string, Record<string, unknown>>();
  for (const [field, column] of Object.entries(target.set)) {
    const raw = row[normalize(column)];
    if (raw === undefined || raw === "") continue;
    const dot = field.indexOf(".");
    if (dot === -1) {
      patch[field] = coerceValue(raw, target.coerce?.[field]);
    } else {
      const root = field.slice(0, dot);
      const key = field.slice(dot + 1);
      if (!jsonRoots.has(root)) jsonRoots.set(root, { ...(existingJson(root) ?? {}) });
      jsonRoots.get(root)![key] = coerceValue(raw, target.coerce?.[field]);
    }
  }
  for (const [root, doc] of jsonRoots) patch[root] = doc;
  return patch;
}

interface ExistingRow {
  id: string;
  matchValue: string;
  json: Record<string, Record<string, unknown> | null>;
}

async function fetchExisting(db: Db, orgId: string, target: IngestTarget): Promise<ExistingRow[]> {
  const orgColumn = target.org_column ?? "org_id";
  const jsonRoots = [
    ...new Set(
      Object.keys(target.set)
        .filter((f) => f.includes("."))
        .map((f) => f.split(".")[0]!),
    ),
  ];
  const select = ["id", target.match.field, ...jsonRoots].join(", ");
  // Untyped table access on purpose: the live schema, not the vendored types,
  // is the source of truth for dynamic targets.
  const { data, error } = await (db.from as (t: string) => any)(target.table)
    .select(select)
    .eq(orgColumn, orgId);
  if (error) throw new Error(`fetch from ${target.table} failed: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    matchValue: String(r[target.match.field] ?? ""),
    json: Object.fromEntries(jsonRoots.map((root) => [root, (r[root] as Record<string, unknown>) ?? null])),
  }));
}

/** Dry-run: what would happen, without writing. Shared by preview + apply. */
export async function planDynamicRows(
  db: Db,
  orgId: string,
  rows: Record<string, string>[],
  target: IngestTarget,
): Promise<DynamicPlanRow[]> {
  if (!target.table || !target.match?.column || !target.match?.field || !target.set) {
    throw new Error("target requires table, match.column, match.field, set");
  }
  const existing = await fetchExisting(db, orgId, target);
  const byMatch = new Map(existing.map((r) => [r.matchValue.toLowerCase(), r]));
  const matchColumn = normalize(target.match.column);

  return rows.map((row) => {
    const matchValue = (row[matchColumn] ?? "").trim();
    if (!matchValue) {
      return { matchValue, rowId: null, action: "skip" as const, patch: {}, error: "empty match value" };
    }
    const hit = byMatch.get(matchValue.toLowerCase());
    const patch = buildPatch(row, target, (root) => hit?.json[root] ?? null);
    if (hit) return { matchValue, rowId: hit.id, action: "update" as const, patch, error: null };
    if (target.insert_missing) {
      return {
        matchValue,
        rowId: null,
        action: "insert" as const,
        patch: {
          ...(target.defaults ?? {}),
          ...patch,
          [target.match.field]: matchValue,
          [target.org_column ?? "org_id"]: orgId,
        },
        error: null,
      };
    }
    return { matchValue, rowId: null, action: "skip" as const, patch, error: "no matching row" };
  });
}

export async function applyDynamicRows(
  db: Db,
  orgId: string,
  rows: Record<string, string>[],
  target: IngestTarget,
): Promise<DynamicResult> {
  const plan = await planDynamicRows(db, orgId, rows, target);
  const result: DynamicResult = { updated: 0, inserted: 0, unmatched: [], errors: [] };
  const table = (db.from as (t: string) => any)(target.table);
  for (const step of plan) {
    if (step.action === "skip") {
      if (step.error === "no matching row") result.unmatched.push(step.matchValue);
      continue;
    }
    if (Object.keys(step.patch).length === 0) continue;
    if (step.action === "update") {
      const { error } = await table.update(step.patch).eq("id", step.rowId);
      if (error) result.errors.push(`${step.matchValue}: ${error.message}`);
      else result.updated++;
    } else {
      const { error } = await table.insert(step.patch);
      if (error) result.errors.push(`${step.matchValue}: ${error.message}`);
      else result.inserted++;
    }
  }
  return result;
}

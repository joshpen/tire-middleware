import { randomUUID } from "node:crypto";
import type { Db } from "../src/db.js";

/**
 * In-memory supabase-ish fake for unit tests, covering the query chains the
 * hub/portal layers use. eq/ilike/in/lte filter; order/limit/select are
 * chain no-ops; insert assigns an id.
 */
export function memDb(tables: Record<string, Record<string, unknown>[]>): Db {
  const from = (table: string) => {
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    let op: "select" | "insert" | "update" = "select";
    let insertRow: Record<string, unknown> | null = null;
    let patch: Record<string, unknown> | null = null;
    const rowsOf = () => (tables[table] ??= []);
    const match = () => rowsOf().filter((r) => filters.every((f) => f(r)));
    const exec = () => {
      if (op === "insert") {
        const row = { id: randomUUID(), ...insertRow };
        rowsOf().push(row);
        return [row];
      }
      if (op === "update") {
        const m = match();
        m.forEach((r) => Object.assign(r, patch));
        return m;
      }
      return match();
    };
    const b: Record<string, unknown> = {};
    for (const m of ["select", "order", "limit", "neq", "not", "or"]) b[m] = () => b;
    b.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), b);
    b.ilike = (c: string, v: unknown) =>
      (filters.push((r) => String(r[c]).toLowerCase() === String(v).toLowerCase()), b);
    b.in = (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b);
    b.lte = (c: string, v: unknown) =>
      (filters.push((r) => r[c] === undefined || r[c] === null || String(r[c]) <= String(v)), b);
    b.insert = (r: Record<string, unknown>) => ((op = "insert"), (insertRow = r), b);
    b.update = (p: Record<string, unknown>) => ((op = "update"), (patch = p), b);
    b.upsert = (r: Record<string, unknown>) => ((op = "insert"), (insertRow = r), b);
    b.maybeSingle = async () => ({ data: exec()[0] ?? null, error: null });
    b.single = async () => ({ data: exec()[0] ?? null, error: null });
    b.then = (resolve: (v: unknown) => void) => Promise.resolve({ data: exec(), error: null }).then(resolve);
    return b;
  };
  return { from } as unknown as Db;
}

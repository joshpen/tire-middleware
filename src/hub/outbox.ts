import type { Db } from "../db.js";
import { backoffMinutes, DEFAULT_RETRY_POLICY } from "../files/retry.js";
import { callHub, getHubConnection, HUB_RESOURCES, mw, touchConnection, type HubConnection } from "./connector.js";

/**
 * Delivery outbox: domain payloads bound for the hub, with bounded retry.
 * A delivery whose resource the hub rejects as unknown parks as
 * 'unsupported' — it is kept (payload intact) so it can be replayed once the
 * hub grows that endpoint.
 */

export interface Delivery {
  id: string;
  org_id: string;
  resource: string;
  payload: unknown;
  status: string;
  attempts: number;
  last_error: string | null;
}

export async function enqueueDelivery(
  db: Db,
  orgId: string,
  resource: string,
  payload: unknown,
  relatedMessageId?: string | null,
): Promise<string> {
  const conn = await getHubConnection(db, orgId);
  const { data, error } = await mw(db, "hub_deliveries")
    .insert({
      org_id: orgId,
      connection_id: conn?.id ?? null,
      resource,
      payload,
      related_message_id: relatedMessageId ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`failed to enqueue hub delivery: ${error.message}`);
  return data.id as string;
}

const UNSUPPORTED_RE = /unknown resource/i;
const PORTAL_CREATE_RE = /^portal\.(request|quote|appointment|warranty|fleet)\.create$/;

/**
 * Traceability: when a portal intake lands on the hub, stamp the hub's
 * conversion result (lead / work order / claim intake id) on the local
 * portal_requests row so operators can follow a request to the hub record.
 */
async function recordPortalConversion(db: Db, delivery: Delivery, data: unknown): Promise<void> {
  const requestId = (delivery.payload as { portal_request_id?: string } | null)?.portal_request_id;
  const result = (data ?? {}) as { created_record_id?: string; record_type?: string };
  if (!requestId || !result.created_record_id) return;
  await mw(db, "portal_requests")
    .update({
      hub_record_id: result.created_record_id,
      hub_record_type: result.record_type ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);
}

async function attemptOne(db: Db, delivery: Delivery, conn: HubConnection): Promise<string> {
  const attempts = delivery.attempts + 1;
  const finish = async (patch: Record<string, unknown>) => {
    await mw(db, "hub_deliveries").update({ attempts, ...patch }).eq("id", delivery.id);
  };
  try {
    const result = await callHub(conn, delivery.resource, delivery.payload);
    if (result.ok) {
      await finish({ status: "delivered", delivered_at: new Date().toISOString(), response: result, last_error: null });
      await touchConnection(db, conn, null);
      if (PORTAL_CREATE_RE.test(delivery.resource)) {
        await recordPortalConversion(db, delivery, result.data).catch(() => {});
      }
      return "delivered";
    }
    if (result.error && UNSUPPORTED_RE.test(result.error)) {
      await finish({ status: "unsupported", response: result, last_error: result.error });
      return "unsupported";
    }
    // Hub-level rejection (4xx semantics): no point hammering; fail after policy.
    const dead = attempts >= DEFAULT_RETRY_POLICY.maxRetries;
    await finish({
      status: dead ? "failed" : "pending",
      next_at: new Date(Date.now() + backoffMinutes(attempts, DEFAULT_RETRY_POLICY) * 60_000).toISOString(),
      response: result,
      last_error: result.error ?? `hub returned status ${result.status}`,
    });
    return dead ? "failed" : "retry";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await touchConnection(db, conn, message);
    const dead = attempts >= DEFAULT_RETRY_POLICY.maxRetries;
    await finish({
      status: dead ? "failed" : "pending",
      next_at: new Date(Date.now() + backoffMinutes(attempts, DEFAULT_RETRY_POLICY) * 60_000).toISOString(),
      last_error: `network: ${message}`,
    });
    return dead ? "failed" : "retry";
  }
}

/** Processes due pending deliveries; called from the poll cycle and admin. */
export async function processOutbox(db: Db, limit = 50): Promise<Record<string, number>> {
  const { data: due, error } = await mw(db, "hub_deliveries")
    .select("id, org_id, resource, payload, status, attempts, last_error")
    .eq("status", "pending")
    .lte("next_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`outbox query failed: ${error.message}`);

  const outcomes: Record<string, number> = {};
  const connections = new Map<string, HubConnection | null>();
  for (const delivery of (due ?? []) as Delivery[]) {
    if (!connections.has(delivery.org_id)) {
      connections.set(delivery.org_id, await getHubConnection(db, delivery.org_id));
    }
    const conn = connections.get(delivery.org_id);
    if (!conn) {
      // No active connection: leave pending, check again next cycle.
      outcomes.no_connection = (outcomes.no_connection ?? 0) + 1;
      continue;
    }
    const outcome = await attemptOne(db, delivery, conn);
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
  }
  return outcomes;
}

/** Operator retry: put a failed/unsupported delivery back in the queue. */
export async function requeueDelivery(db: Db, deliveryId: string): Promise<boolean> {
  const { data, error } = await mw(db, "hub_deliveries")
    .update({ status: "pending", next_at: new Date().toISOString(), attempts: 0, last_error: null })
    .in("status", ["failed", "unsupported", "pending"])
    .eq("id", deliveryId)
    .select("id");
  if (error) throw new Error(`requeue failed: ${error.message}`);
  return (data ?? []).length > 0;
}

/**
 * Bulk replay: deliveries that parked as 'unsupported' while the hub lacked
 * the endpoint go back to 'pending' once the resource is in the hub's
 * supported set (e.g. orders.create, products.upsert, warranty.claim.create).
 */
export async function requeueUnsupported(db: Db): Promise<{ requeued: number; resources: string[] }> {
  const { data, error } = await mw(db, "hub_deliveries")
    .update({ status: "pending", next_at: new Date().toISOString(), attempts: 0, last_error: null })
    .eq("status", "unsupported")
    .in("resource", [...HUB_RESOURCES])
    .select("resource");
  if (error) throw new Error(`bulk requeue failed: ${error.message}`);
  const rows = (data ?? []) as { resource: string }[];
  return { requeued: rows.length, resources: [...new Set(rows.map((r) => r.resource))] };
}

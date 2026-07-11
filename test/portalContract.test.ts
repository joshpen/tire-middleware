import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createPortalAppointmentRequest,
  createPortalFleetInquiry,
  createPortalQuoteRequest,
  createPortalWarrantyIntake,
  type PortalContext,
} from "../src/portal/service.js";
import { memDb } from "./memDb.js";

/**
 * Contract tests: the JSON forwarded to the hub for each portal intake type
 * must match the hub's portal.request.create contract exactly —
 * portal_request_id (uuid, idempotency key), type, and the customer fields
 * the hub maps (customer_name/email/phone, business_name, contact_person).
 */

const DEALER = randomUUID();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ctx = {
  settings: { dealer_id: DEALER, slug: "northwest-ag-tire" },
  key: { id: randomUUID() },
  origin: "https://dealer-site.example",
  source: "api",
  ipHash: null,
  userAgentHash: null,
} as unknown as PortalContext;

interface Tables {
  [k: string]: Record<string, unknown>[];
  portal_requests: Record<string, unknown>[];
  hub_deliveries: Record<string, unknown>[];
  hub_connections: Record<string, unknown>[];
}

describe("portal intake → hub delivery contract", () => {
  let tables: Tables;

  beforeEach(() => {
    tables = {
      portal_requests: [],
      hub_deliveries: [],
      hub_connections: [
        { id: randomUUID(), org_id: DEALER, name: "hub", hub_url: "https://hub.example", anon_key: "a", api_key: "k", is_active: true, last_ok_at: null, last_error: null },
      ],
    };
  });

  const delivery = () => {
    expect(tables.hub_deliveries).toHaveLength(1);
    return tables.hub_deliveries[0]! as { resource: string; payload: Record<string, unknown> };
  };

  it("quote request forwards the exact hub payload with a stable portal_request_id", async () => {
    const db = memDb(tables);
    const saved = await createPortalQuoteRequest(db, ctx, {
      customer_name: "Sam Farmer",
      customer_email: "sam@farm.example",
      tire_size: "480/80R46",
      quantity: 2,
    });
    const d = delivery();
    expect(d.resource).toBe("portal.quote.create");
    expect(d.payload).toEqual({
      portal_request_id: saved.id,
      type: "quote",
      dealer_slug: "northwest-ag-tire",
      customer_name: "Sam Farmer",
      customer_email: "sam@farm.example",
      customer_phone: null,
      tire_size: "480/80R46",
      quantity: 2,
    });
    // Idempotency: the uuid is the persisted local row id, generated at
    // staging time — the delivery payload is stored, so retries reuse it.
    expect(String(d.payload.portal_request_id)).toMatch(UUID_RE);
    expect(d.payload.portal_request_id).toBe(tables.portal_requests[0]!.id);
  });

  it("appointment request forwards type=appointment with auto_confirmed=false", async () => {
    const db = memDb(tables);
    const saved = await createPortalAppointmentRequest(db, ctx, {
      customer_name: "Pat",
      customer_phone: "555-201-9922",
      service_type: "rotation",
      preferred_date: "2026-07-15",
    });
    const d = delivery();
    expect(d.resource).toBe("portal.appointment.create");
    expect(d.payload).toEqual({
      portal_request_id: saved.id,
      type: "appointment",
      dealer_slug: "northwest-ag-tire",
      customer_name: "Pat",
      customer_email: null,
      customer_phone: "555-201-9922",
      service_type: "rotation",
      preferred_date: "2026-07-15",
      auto_confirmed: false,
    });
  });

  it("warranty intake forwards type=warranty with the issue description", async () => {
    const db = memDb(tables);
    const saved = await createPortalWarrantyIntake(db, ctx, {
      customer_name: "P",
      customer_email: "p@x.example",
      tire_info: "480/80R46",
      issue_description: "sidewall crack",
    });
    const d = delivery();
    expect(d.resource).toBe("portal.warranty.create");
    expect(d.payload).toEqual({
      portal_request_id: saved.id,
      type: "warranty",
      dealer_slug: "northwest-ag-tire",
      customer_name: "P",
      customer_email: "p@x.example",
      customer_phone: null,
      tire_info: "480/80R46",
      issue_description: "sidewall crack",
    });
  });

  it("fleet inquiry forwards type=fleet with business_name and contact_person", async () => {
    const db = memDb(tables);
    const saved = await createPortalFleetInquiry(db, ctx, {
      customer_email: "ana@basin.example",
      business_name: "Basin Harvest Co",
      contact_person: "Ana",
      fleet_size: 22,
    });
    const d = delivery();
    expect(d.resource).toBe("portal.fleet.create");
    expect(d.payload).toEqual({
      portal_request_id: saved.id,
      type: "fleet",
      dealer_slug: "northwest-ag-tire",
      customer_name: null,
      customer_email: "ana@basin.example",
      customer_phone: null,
      business_name: "Basin Harvest Co",
      contact_person: "Ana",
      fleet_size: 22,
    });
  });

  it("no hub connection → staged locally with no delivery", async () => {
    tables.hub_connections = [];
    const db = memDb(tables);
    await createPortalQuoteRequest(db, ctx, { customer_name: "X", customer_email: "x@y.example" });
    expect(tables.portal_requests).toHaveLength(1);
    expect(tables.hub_deliveries).toHaveLength(0);
  });
});

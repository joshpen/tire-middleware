/**
 * Tread Ready portal client — package-ready, dependency-free. Works in the
 * browser (with a public portal key) and server-side. Only portal-safe reads
 * and request submissions; Tread Ready remains the system of record.
 *
 *   const client = createTreadReadyPortalClient({
 *     dealerSlug: "northwest-ag-tire",
 *     portalKey: "pk_portal_dealer_…",
 *     baseUrl: "https://gateway.example.com",
 *   });
 *   const profile = await client.getDealerProfile();
 */

export interface PortalClientConfig {
  dealerSlug: string;
  portalKey: string;
  baseUrl: string;
  /** Attribution: hosted_portal | embed | lovable | api (default). */
  source?: string;
  fetchImpl?: typeof fetch;
}

export interface TreadReadyPortalClient {
  getDealerProfile(): Promise<unknown>;
  getBrand(): Promise<unknown>;
  getServices(): Promise<unknown[]>;
  getLocations(): Promise<unknown[]>;
  getPromotions(): Promise<unknown[]>;
  getCatalogCategories(): Promise<unknown[]>;
  createQuoteRequest(payload: Record<string, unknown>): Promise<unknown>;
  createAppointmentRequest(payload: Record<string, unknown>): Promise<unknown>;
  createWarrantyIntake(payload: Record<string, unknown>): Promise<unknown>;
  createFleetInquiry(payload: Record<string, unknown>): Promise<unknown>;
  trackEvent(payload: Record<string, unknown>): Promise<unknown>;
}

export function createTreadReadyPortalClient(config: PortalClientConfig): TreadReadyPortalClient {
  const f = config.fetchImpl ?? fetch;
  const base = `${config.baseUrl.replace(/\/$/, "")}/api/portal/v1/dealers/${encodeURIComponent(config.dealerSlug)}`;

  async function call(path: string, method = "GET", body?: unknown): Promise<Record<string, unknown>> {
    const res = await f(`${base}${path}`, {
      method,
      headers: {
        "X-Portal-Key": config.portalKey,
        "Content-Type": "application/json",
        "X-Portal-Source": config.source ?? "api",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || data.ok === false) throw new Error(String(data.error ?? `request failed (${res.status})`));
    return data;
  }

  return {
    getDealerProfile: () => call("").then((d) => d.dealer),
    getBrand: () => call("/brand").then((d) => d.brand),
    getServices: () => call("/services").then((d) => d.services as unknown[]),
    getLocations: () => call("/locations").then((d) => d.locations as unknown[]),
    getPromotions: () => call("/promotions").then((d) => d.promotions as unknown[]),
    getCatalogCategories: () => call("/catalog-categories").then((d) => d.categories as unknown[]),
    createQuoteRequest: (p) => call("/quote-requests", "POST", p).then((d) => d.request),
    createAppointmentRequest: (p) => call("/appointments", "POST", p).then((d) => d.request),
    createWarrantyIntake: (p) => call("/warranty-intake", "POST", p).then((d) => d.request),
    createFleetInquiry: (p) => call("/fleet-inquiries", "POST", p).then((d) => d.request),
    trackEvent: (p) => call("/events", "POST", p).then((d) => d.event),
  };
}

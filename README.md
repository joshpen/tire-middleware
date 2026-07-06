# tread-sync-gateway

Standalone iPaaS layer for **tread-sync-hub** (B2B tire-industry platform).
This service owns all inbound/outbound integration traffic — partner REST API,
EDI X12, CSV file routing, SFTP polling — and connects to the hub app only
through the hub's public API. **No shared database.**

## Architecture

```
partners ──[REST / EDI X12 / SFTP / HTTPS]──▶ tread-sync-gateway ──[hub public API]──▶ tread-sync-hub
                                              (own Supabase DB,     key-authenticated,   (own DB, own repo,
                                               own schema)          scoped, revocable     never touched here)
```

- **The middleware owns its own Supabase project and schema** (migrations in
  `supabase/migrations/`): API clients, EDI partners, message ledger, file
  endpoints, integration runs, hub connections, delivery outbox, and a local
  product-catalog cache (synced from the hub) for SKU resolution.
- **The hub is reached only through its `api_gateway` RPC** with a hub-issued
  API key the hub can scope, rate-limit, revoke, and audit. Resources
  available today: `products.list`, `orders.list`, `orders.ack`,
  `inventory.push`, `edi.receive`. The hub repo is never modified from here.
- **Dual mode:** orgs with an active `hub_connections` row proxy domain
  reads/writes to the hub API; orgs without one run against local tables
  (standalone/staging mode).
- **Delivery outbox** (`hub_deliveries`): payloads bound for the hub retry
  with exponential backoff; resources the hub's API doesn't accept yet park
  as `unsupported` and can be replayed once the hub grows the endpoint.
- Validated inbound EDI is staged locally (orders + ledger) and the raw
  interchange is forwarded to the hub via `edi.receive`.

Fully self-contained: `src/types/supabase.ts` is a vendored types snapshot,
and `npm run seed` creates all the data verification needs — no other repo is
required to build, test, or run the gateway.

## Stack

Node 22 + TypeScript · Fastify · @supabase/supabase-js (service-role key) ·
ssh2-sftp-client · node-cron · Vitest · Docker (deploy on Fly.io or Railway —
static IP required for partner SFTP allowlists).

```sh
cp .env.example .env   # fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

## REST v1

Auth: `Authorization: Bearer <key>` → sha256 → `api_clients` (active,
unexpired). Per-route scope check, sliding-window rate limit per
`rate_limit_per_min`, and every request logged to `api_request_logs`.
All data is org-scoped by the key's `org_id`.

| Route | Scope | Behavior |
| --- | --- | --- |
| `GET /healthz` | — | liveness |
| `GET /v1/products` | `products:read` | active products with stock |
| `GET /v1/orders?status=` | `orders:read` | last 50 sales orders, with lines |
| `POST /v1/orders/:idOrPoNumber/ack` | `orders:write` | submitted → confirmed |
| `POST /v1/inventory` | `inventory:write` | `{rows:[{sku,qty}]}` → `stock_qty`; status ≤0 backorder, ≤8 low_stock |
| `POST /v1/edi` | `edi:write` | raw X12 body → stored in `edi_messages`, then processed |
| `GET/POST /v1/objects/:key` | config-declared | dynamic objects exposed via `exposed_objects` |
| `POST /admin/poll/:endpointId` | service-role key | manual file-endpoint poll |
| `POST /admin/preview/parse` | service-role key | dry-run classify/parse/resolve, no writes |
| `POST /admin/preview/fetch/:endpointId` | service-role key | fetch sample files, nothing marked processed |
| `GET /admin/retry/:endpointId` | service-role key | retry queue + dead-letter state |
| `POST /admin/requeue/:endpointId` | service-role key | `{key}` — clear failure state for a file |
| `POST /admin/edi/retry/:messageId` | service-role key | reprocess a stored inbound message in place |
| `GET /admin/edi/unacknowledged` | service-role key | outbound EDI still awaiting a partner 997 |

## EDI X12

Pure-TS library (`src/edi/`), no dependencies; separators are read from the
ISA segment itself. Inbound 850 → partner resolved via `edi_partners` ISA
identity → `purchase_orders` + lines created (PO1 qualifiers VN → `products.sku`,
UP → `products.barcode`) → 997 acknowledgment generated. Generators: 855 (from
an order), 856 (from a shipment: BSN, HL shipment/order/item, TD5, REF BM/CN,
LIN/SN1), 810 (from an order_invoice: BIG, N1, IT1, TDS, CTT). Every message
in/out lands in `edi_messages` with control numbers sequenced per org.

## File pipeline

`node-cron` (default `*/15 * * * *`, override with `POLL_CRON`) polls active
`file_endpoints`: SFTP (list `remote_path`, download new files, processed names
remembered in the config jsonb) or HTTPS (`fetch`, deduped by content hash).
Content starting with `ISA` goes to EDI intake; otherwise CSV routed by
`file_type` (`csv_inventory` → stock rows, `csv_prices` → list prices; `auto`
sniffs headers). Outcomes land in `integration_runs` and the endpoint's
`last_polled_at`/`last_error`. Credentials live only in the config jsonb and
env — they are never logged.

**Retry queue**: a file that fails ingestion is retried on later polls with
exponential backoff, then dead-lettered after `max_retries` (per-endpoint
`config.retry = {max_retries, base_backoff_minutes, max_backoff_minutes}`;
defaults 5 / 15m / 24h). State lives in `config.retry_state` /
`config.dead_letter`; inspect with `GET /admin/retry/:endpointId`, clear with
`POST /admin/requeue/:endpointId {key}`. Failed inbound EDI messages can be
reprocessed in place (same ledger row) after a mapping or partner fix via
`POST /admin/edi/retry/:messageId`.

**997 reconciliation**: inbound 997s are matched to outbound messages by
per-org control number — accepted flips the outbound row to `processed`
(stamping `processed_at`), rejected flips it to `error`. Outbound 855/856/810
still awaiting acknowledgment are listed by
`GET /admin/edi/unacknowledged?org_id=&older_than_minutes=`. The gateway
never answers a 997 with another 997.

## Admin dashboard

A built-in operator console at **`/ui`** covers every function and setting:
Overview (health cards, recent runs), API Clients (create with one-time key
reveal, scopes, rate limits, activate/deactivate), EDI Partners (ISA identity,
buyer-org link, per-partner mapping editor), EDI Messages (filterable in/out
ledger, raw X12 viewer, in-place reprocess, awaiting-997 report), File
Endpoints (SFTP/HTTPS connection, mapping + retry policy JSON, poll now,
retry/dead-letter queue with requeue), Preview/Dry-run (trial mappings with
zero writes, sample fetch), Org Settings (stock status rules, exposed dynamic
objects, EDI mappings), and Logs & Runs.

Sign in with `GATEWAY_ADMIN_TOKEN` (set it in env so the service-role key
never has to be typed into a browser; without it the service-role key is the
fallback). Endpoint credentials are masked in the UI and preserved on save.

## Mapping profiles (data-driven, for a management UI)

Supplier-specific data mapping is configuration, not code, so a hub UI can
manage it without gateway deploys:

- **CSV** — `file_endpoints.config.mapping`: `sku_column` / `qty_column` /
  `price_column` header overrides, `delimiter`, `sku_xref` (external →
  internal SKU), `qty_multiplier`, `price_multiplier`.
- **EDI** — per-partner profiles under
  `org_integrations.config.edi_mappings[<edi_partner_id>]` on the org's
  `file_gateway` provider instance: `qualifier_priority` (default
  `["VN","UP","BP"]`) and `sku_xref`. VN/BP resolve against `products.sku`,
  UP against `products.barcode`; cross-referenced values resolve as SKUs.

## Dynamic destinations & objects

The hub's schema and data objects evolve; the gateway follows through
configuration, not deploys:

- **Dynamic ingest targets** — `mapping.target` on a file endpoint routes rows
  into *any* table: `{table, match: {column, field}, set: {field: column},
  coerce?, insert_missing?, defaults?}`. Dotted fields
  (`field_values.tread_depth_mm`) merge into jsonb columns, which is how the
  platform's dynamic custom fields are populated. Tables/columns are validated
  against the live schema at run time (PostgREST), not the vendored types.
- **Dynamic API objects** — `exposed_objects` in the org's gateway config
  declares new REST resources under `GET/POST /v1/objects/:key` (table,
  select, filterable fields, writable fields + match field, per-object read
  and write scopes). New hub tables become API surface by editing config.
- **Rules as data** — stock status thresholds are org-configurable
  (`stock_status_rules: {thresholds: [{max, status}], fallback}`), used by
  both `/v1/inventory` and the CSV pipeline.

Org-level gateway config lives in `org_integrations.config` on the org's
`file_gateway` provider instance: `edi_mappings`, `exposed_objects`,
`stock_status_rules`.

The preview endpoints support the UI workflow: `POST /admin/preview/parse`
accepts `{content, file_type?, org_id?, mapping?, edi_mapping?}` and returns
classification, mapped rows / resolved 850 lines, unknown SKUs, and partner
resolution — without writing anything — so a trial mapping can be validated
before saving. `POST /admin/preview/fetch/:endpointId` pulls sample files
(with classification + content sample) without marking them processed.

## Verification

```sh
npm test                                   # unit + round-trip EDI tests
docker compose -f docker-compose.test.yml up -d
TEST_SFTP=1 npm test                       # SFTP against local atmoz/sftp
npm run seed                               # prints a smoke-test API key
API_KEY=trk_live_… npm run smoke           # curl every route incl. 401/403/429
```

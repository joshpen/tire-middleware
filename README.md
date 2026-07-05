# tread-sync-gateway

Integration runtime companion to **tread-sync-hub** (B2B tire-industry platform on
Supabase). This service owns inbound/outbound integration traffic: the partner
REST API, EDI X12, CSV file routing, and SFTP polling.

## Schema contract

The service shares the platform's Supabase Postgres but **owns no schema** —
never add migrations here; the tread-sync-hub repo owns all DDL. These tables
are the contract (config store + message bus):

`api_clients` · `api_request_logs` · `edi_partners` · `edi_messages` ·
`file_endpoints` · `integration_runs` — plus domain tables `products`,
`purchase_orders`, `purchase_order_lines`, `dealer_inventory`, `product_prices`,
`shipments`, `order_invoices`.

This service is fully self-contained: `src/types/supabase.ts` is a vendored
copy of the platform's generated types (refresh with
`supabase gen types --linked > src/types/supabase.ts` when the contract
changes), and `npm run seed` creates all the data verification needs — no
other repo is required to build, test, or run the gateway.

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
| `POST /admin/poll/:endpointId` | service-role key | manual file-endpoint poll |
| `POST /admin/preview/parse` | service-role key | dry-run classify/parse/resolve, no writes |
| `POST /admin/preview/fetch/:endpointId` | service-role key | fetch sample files, nothing marked processed |

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

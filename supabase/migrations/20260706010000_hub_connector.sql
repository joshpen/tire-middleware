-- First middleware-owned migration. As of 2026-07-06 this project
-- (zfkzdczghdcquqmdzxid) is the middleware's OWN database — it is no longer
-- shared with tread-sync-hub. The middleware talks to the hub only through
-- the hub's public API (PostgREST rpc api_gateway); these tables hold the
-- connection settings and the delivery outbox for that link.

create table if not exists public.hub_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null default 'tread-sync-hub',
  hub_url text not null,               -- https://<hub-project>.supabase.co
  anon_key text not null,              -- hub anon key (PostgREST apikey header)
  api_key text not null,               -- hub-issued api_clients key (scoped, revocable)
  is_active boolean not null default true,
  last_ok_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id)
);

-- Outbox: domain deliveries to the hub with bounded retry. Resources the
-- hub's API doesn't support yet park as 'unsupported' until the hub grows
-- the endpoint (the hub repo is not ours to change).
create table if not exists public.hub_deliveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.hub_connections(id) on delete set null,
  resource text not null,              -- inventory.push, orders.ack, edi.receive, ...
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','delivered','failed','unsupported')),
  attempts integer not null default 0,
  next_at timestamptz not null default now(),
  last_error text,
  response jsonb,
  related_message_id uuid references public.edi_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists hub_deliveries_pending_idx on public.hub_deliveries (status, next_at);
create index if not exists hub_deliveries_org_idx on public.hub_deliveries (org_id, created_at desc);

-- Middleware DB is service-role-only; lock the new tables down anyway.
alter table public.hub_connections enable row level security;
alter table public.hub_deliveries enable row level security;

-- The local products table now serves as the middleware's catalog cache,
-- synced from the hub via products.list; cached rows have no product type.
alter table public.products alter column product_type_id drop not null;

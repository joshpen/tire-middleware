-- Warranty claims: a middleware-owned staging resource. Partners create and
-- track claims through the gateway's REST/MCP API; claims are forwarded to
-- the hub via the delivery outbox (warranty.claim.create — parked as
-- unsupported until the hub's API grows the endpoint).

create table if not exists public.warranty_claims (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  claim_number text not null,
  product_id uuid references public.products(id) on delete set null,
  sku text,
  dot_number text,                     -- DOT code of the claimed tire
  quantity integer not null default 1 check (quantity > 0),
  description text not null,
  customer_ref text,                   -- claimant's own reference
  status text not null default 'submitted'
    check (status in ('submitted','under_review','approved','denied','closed')),
  resolution text,
  created_by_client_id uuid references public.api_clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, claim_number)
);

create index if not exists warranty_claims_org_idx on public.warranty_claims (org_id, created_at desc);
create index if not exists warranty_claims_status_idx on public.warranty_claims (org_id, status);

alter table public.warranty_claims enable row level security;

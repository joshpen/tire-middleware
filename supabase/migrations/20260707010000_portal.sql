-- Headless dealer portal layer. The gateway is the public edge: browser-safe
-- restricted tokens, origin policy, module gating, request intake. Dealers
-- (tenants) are organizations rows; portal-safe content (brand, services,
-- locations, promotions, catalog categories) lives in dealer_portal_settings
-- until the hub's API grows content endpoints to sync from. Portal requests
-- are staged here and forwarded to the hub via the delivery outbox.

create table if not exists public.dealer_portal_settings (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  portal_enabled boolean not null default true,
  headless_enabled boolean not null default true,
  quote_enabled boolean not null default true,
  booking_enabled boolean not null default true,
  warranty_enabled boolean not null default false,
  fleet_enabled boolean not null default false,
  services_enabled boolean not null default true,
  promotions_enabled boolean not null default true,
  catalog_enabled boolean not null default true,
  allowed_origins jsonb not null default '[]'::jsonb,
  iframe_allowed_origins jsonb not null default '[]'::jsonb,
  custom_domain text,
  -- Portal-safe public content only: display_name, logo_url, colors,
  -- typography, contact, service_areas, services[], locations[],
  -- promotions[], catalog_categories[]. Never cost/margin/supplier data.
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dealer_id),
  unique (slug)
);

create table if not exists public.portal_api_keys (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.organizations(id) on delete cascade,
  token_prefix text not null,           -- pk_portal_dealer_xxxx… (display)
  hashed_token text not null unique,    -- sha256; raw shown once, never stored
  label text not null,
  allowed_origins jsonb not null default '[]'::jsonb,  -- extra restriction on top of dealer origins; [] = inherit
  allowed_modules jsonb not null default '["quote","booking","warranty","fleet","services","promotions","catalog","events"]'::jsonb,
  rate_limit jsonb not null default '{"per_minute": 120}'::jsonb,
  status text not null default 'active' check (status in ('active','disabled','revoked')),
  created_by text,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_api_keys_dealer_idx on public.portal_api_keys (dealer_id);

create table if not exists public.portal_requests (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in ('quote','appointment','warranty','fleet')),
  status text not null default 'new' check (status in ('new','reviewed','converted','closed','spam')),
  source text not null default 'api' check (source in ('hosted_portal','embed','lovable','api')),
  customer_name text,
  customer_email text,
  customer_phone text,
  payload jsonb not null default '{}'::jsonb,
  created_ticket_id uuid,
  created_customer_id uuid,
  created_by_public_key_id uuid references public.portal_api_keys(id) on delete set null,
  origin text,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_requests_dealer_idx on public.portal_requests (dealer_id, created_at desc);
create index if not exists portal_requests_type_idx on public.portal_requests (dealer_id, type, status);

create table if not exists public.portal_events (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.organizations(id) on delete cascade,
  public_key_id uuid references public.portal_api_keys(id) on delete set null,
  event_name text not null,
  session_id text,
  source text,
  origin text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists portal_events_dealer_idx on public.portal_events (dealer_id, created_at desc);

alter table public.dealer_portal_settings enable row level security;
alter table public.portal_api_keys enable row level security;
alter table public.portal_requests enable row level security;
alter table public.portal_events enable row level security;

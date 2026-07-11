-- Gateway-owned migration (this is the middleware's own database; the hub's
-- schema is untouched).
--
-- 1. Portal request → hub record traceability: when a portal intake delivery
--    lands on the hub (portal.request.create and aliases), the hub answers
--    with {created_record_id, record_type} (lead / work order / claim
--    intake). Stamp that on the local row so operators can follow a portal
--    request to the hub record.
alter table public.portal_requests
  add column if not exists hub_record_id uuid,
  add column if not exists hub_record_type text;

-- 2. Consumer storefront key: the hub's publishable-key storefront API
--    (GET {hub_url}/api/storefront/v1/…, X-Storefront-Key header) is a
--    different credential from the secret api_gateway key. Stored on the
--    connection so MCP storefront tools never hand keys to agents.
alter table public.hub_connections
  add column if not exists storefront_key text;

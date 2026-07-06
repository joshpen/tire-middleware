-- Prune everything that is not the middleware's. Two sources of debris:
--  1. the full tread-sync-hub schema applied 2026-07-05, back when this
--     project was meant to be the shared platform DB (now the hub has its
--     own database and is reached only via its API)
--  2. remnants of whatever app ran on this project before the middleware
--     (tenants, user_profiles, wood_chip_requests, ...)
-- Kept: the middleware's integration tables, hub connector tables, and the
-- small domain set used for local mode / staging / the catalog cache
-- (organizations, profiles, products, product_types, product_prices,
-- purchase_orders(+lines), shipments(+lines), order_invoices,
-- dealer_inventory). `cascade` also removes cross-boundary FKs and RLS
-- policies that referenced the dropped tables — the middleware is
-- service-role-only and does not rely on them.

drop table if exists public.announcement_reads cascade;
drop table if exists public.announcements cascade;
drop table if exists public.ar_applications cascade;
drop table if exists public.ar_entries cascade;
drop table if exists public.catalog_access cascade;
drop table if exists public.catalog_favorites cascade;
drop table if exists public.catalog_products cascade;
drop table if exists public.certifications cascade;
drop table if exists public.claim_adjudications cascade;
drop table if exists public.competitor_prices cascade;
drop table if exists public.credit_memos cascade;
drop table if exists public.custom_field_definitions cascade;
drop table if exists public.customer_pricing_rules cascade;
drop table if exists public.deal_registrations cascade;
drop table if exists public.delivery_responses cascade;
drop table if exists public.delivery_routes cascade;
drop table if exists public.delivery_stops cascade;
drop table if exists public.disposal_haulers cascade;
drop table if exists public.disposal_manifests cascade;
drop table if exists public.erp_connections cascade;
drop table if exists public.exemption_certificates cascade;
drop table if exists public.field_defs cascade;
drop table if exists public.fitment_tires cascade;
drop table if exists public.inventory_transactions cascade;
drop table if exists public.invoices cascade;
drop table if exists public.leads cascade;
drop table if exists public.loyalty_transactions cascade;
drop table if exists public.machine_fitments cascade;
drop table if exists public.machine_types cascade;
drop table if exists public.map_violations cascade;
drop table if exists public.mdf_budgets cascade;
drop table if exists public.mdf_requests cascade;
drop table if exists public.notification_group_members cascade;
drop table if exists public.notification_groups cascade;
drop table if exists public.notification_rule_recipients cascade;
drop table if exists public.notification_rules cascade;
drop table if exists public.notifications cascade;
drop table if exists public.object_type_defs cascade;
drop table if exists public.object_type_seqs cascade;
drop table if exists public.onboarding_progress cascade;
drop table if exists public.onboarding_steps cascade;
drop table if exists public.org_locations cascade;
drop table if exists public.org_roles cascade;
drop table if exists public.organization_relationships cascade;
drop table if exists public.partner_applications cascade;
drop table if exists public.partner_tiers cascade;
drop table if exists public.permission_defs cascade;
drop table if exists public.platform_admin_audit cascade;
drop table if exists public.platform_admins cascade;
drop table if exists public.pos_customers cascade;
drop table if exists public.pos_payments cascade;
drop table if exists public.pos_sale_lines cascade;
drop table if exists public.pos_sales cascade;
drop table if exists public.pos_services cascade;
drop table if exists public.pos_vehicles cascade;
drop table if exists public.price_list_assignments cascade;
drop table if exists public.price_list_audit_logs cascade;
drop table if exists public.price_list_import_jobs cascade;
drop table if exists public.price_list_items cascade;
drop table if exists public.price_lists cascade;
drop table if exists public.pricing_tiers cascade;
drop table if exists public.prm_activities cascade;
drop table if exists public.product_catalogs cascade;
drop table if exists public.product_categories cascade;
drop table if exists public.product_field_defs cascade;
drop table if exists public.product_media cascade;
drop table if exists public.product_variant_axes cascade;
drop table if exists public.product_variants cascade;
drop table if exists public.promotion_saves cascade;
drop table if exists public.promotions cascade;
drop table if exists public.purchase_order_events cascade;
drop table if exists public.record_activities cascade;
drop table if exists public.record_number_counters cascade;
drop table if exists public.records cascade;
drop table if exists public.resource_downloads cascade;
drop table if exists public.resources cascade;
drop table if exists public.return_authorizations cascade;
drop table if exists public.return_lines cascade;
drop table if exists public.scrap_tire_ledger cascade;
drop table if exists public.sourcing_requests cascade;
drop table if exists public.spiff_claim_activities cascade;
drop table if exists public.spiff_claims cascade;
drop table if exists public.spiff_programs cascade;
drop table if exists public.status_defs cascade;
drop table if exists public.support_messages cascade;
drop table if exists public.support_tickets cascade;
drop table if exists public.tech_locations cascade;
drop table if exists public.technical_specifications cascade;
drop table if exists public.tenants cascade;
drop table if exists public.tire_disposal_rules cascade;
drop table if exists public.training_courses cascade;
drop table if exists public.training_enrollments cascade;
drop table if exists public.user_org_roles cascade;
drop table if exists public.user_organization_roles cascade;
drop table if exists public.user_profiles cascade;
drop table if exists public.warehouses cascade;
drop table if exists public.warranty_policies cascade;
drop table if exists public.wood_chip_requests cascade;
drop table if exists public.work_order_events cascade;
drop table if exists public.work_orders cascade;

-- Hub-app triggers on kept tables that reference dropped tables
-- (prm_activities, notification_rules, purchase_order_events).
drop trigger if exists tg_log_activity on public.purchase_orders;
drop trigger if exists tg_notif_purchase_order on public.purchase_orders;
drop trigger if exists tg_po_events_insert on public.purchase_orders;
drop trigger if exists tg_po_events_status on public.purchase_orders;
drop function if exists public.tg_prm_log_activity() cascade;
drop function if exists public.tg_fire_notification_rules() cascade;
drop function if exists public.tg_po_log_event() cascade;

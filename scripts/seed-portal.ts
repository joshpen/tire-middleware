/**
 * Portal demo seeding: two dealers with different module sets, portal
 * settings, and one public key each. Prints the raw keys once.
 *
 *   npx tsx scripts/seed-portal.ts
 */
import { loadConfig } from "../src/config.js";
import { createDb } from "../src/db.js";
import { mw } from "../src/hub/connector.js";
import { generatePortalKey } from "../src/portal/service.js";

const config = loadConfig();
const db = createDb(config);

const DEALERS = [
  {
    name: "Northwest Ag Tire",
    slug: "northwest-ag-tire",
    modules: { quote: true, booking: true, warranty: true, fleet: true, services: true, promotions: true, catalog: true },
    profile: {
      display_name: "Northwest Ag Tire",
      logo_url: null,
      brand: { primary_color: "#14532d", secondary_color: "#374151", accent_color: "#16a34a", typography: "system", theme: "light" },
      contact: { phone: "(509) 555-0142", email: "service@nwagtire.example" },
      service_areas: ["Spokane", "Palouse", "Columbia Basin"],
      services: [
        { key: "ag", label: "Ag tires & field service" },
        { key: "construction", label: "Construction & OTR tires" },
        { key: "fleet", label: "Fleet service programs" },
        { key: "warranty", label: "Warranty support" },
      ],
      locations: [{ name: "Spokane HQ", address: "4210 E Trent Ave, Spokane WA", hours: "M-F 7-6, Sat 8-2", phone: "(509) 555-0142" }],
      promotions: [{ title: "Spring field-service special", detail: "Free on-site inspection with any ag tire order", active: true }],
      catalog_categories: [
        { key: "ag", label: "Agricultural" },
        { key: "construction", label: "Construction / OTR" },
        { key: "truck", label: "Commercial truck" },
      ],
    },
  },
  {
    name: "Metro Tire & Service",
    slug: "metro-tire-service",
    modules: { quote: true, booking: true, warranty: false, fleet: false, services: true, promotions: true, catalog: true },
    profile: {
      display_name: "Metro Tire & Service",
      brand: { primary_color: "#1e3a8a", accent_color: "#2563eb", typography: "system", theme: "light" },
      contact: { phone: "(206) 555-0117" },
      services: [
        { key: "passenger", label: "Passenger & light truck tires" },
        { key: "service", label: "In-bay service & alignment" },
      ],
      locations: [{ name: "Downtown", address: "812 Pine St, Seattle WA", hours: "M-Sat 8-6" }],
      promotions: [{ title: "Buy 3 get 1 free", detail: "Select all-season lines", active: true }],
      catalog_categories: [{ key: "passenger", label: "Passenger" }, { key: "lt", label: "Light truck" }],
    },
  },
];

for (const dealer of DEALERS) {
  let { data: org } = await db.from("organizations").select("id").eq("name", dealer.name).maybeSingle();
  if (!org) {
    const { data, error } = await db.from("organizations").insert({ name: dealer.name, type: "dealer" }).select("id").single();
    if (error) throw new Error(error.message);
    org = data;
  }
  const { error: settingsError } = await mw(db, "dealer_portal_settings").upsert(
    {
      dealer_id: org.id,
      slug: dealer.slug,
      portal_enabled: true,
      headless_enabled: true,
      quote_enabled: dealer.modules.quote,
      booking_enabled: dealer.modules.booking,
      warranty_enabled: dealer.modules.warranty,
      fleet_enabled: dealer.modules.fleet,
      services_enabled: dealer.modules.services,
      promotions_enabled: dealer.modules.promotions,
      catalog_enabled: dealer.modules.catalog,
      allowed_origins: ["http://localhost:3000"],
      profile: dealer.profile,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "dealer_id" },
  );
  if (settingsError) throw new Error(settingsError.message);

  const key = generatePortalKey();
  const { error: keyError } = await mw(db, "portal_api_keys").insert({
    dealer_id: org.id,
    token_prefix: key.prefix,
    hashed_token: key.hash,
    label: "seed demo key",
    created_by: "seed",
  });
  if (keyError) throw new Error(keyError.message);

  console.log(`${dealer.name} (${dealer.slug})`);
  console.log(`  dealer_id: ${org.id}`);
  console.log(`  PORTAL_KEY=${key.raw}`);
}

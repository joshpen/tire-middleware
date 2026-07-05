/**
 * Self-contained smoke-test seeding: creates everything the gateway needs to
 * be verified against an otherwise empty platform database — an auth user,
 * seller + buyer orgs, a product type + products, an EDI trading partner, and
 * two api_clients (full-scope and read-only). Idempotent except for the API
 * clients, which are always freshly created so the plaintext keys can be
 * printed (only sha256 hashes are stored).
 *
 *   npm run seed        # requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import { createHash, randomBytes } from "node:crypto";
import { loadConfig } from "../src/config.js";
import { createDb, type Db } from "../src/db.js";

const SEED_EMAIL = "gateway-smoke@treadsync.test";
const SELLER_NAME = "Gateway Smoke Seller";
const BUYER_NAME = "Gateway Smoke Buyer";
const PARTNER_ISA = { qualifier: "ZZ", id: "SMOKETESTSENDER" };
const SKUS = ["SMOKE-SKU-1", "SMOKE-SKU-2"];

const config = loadConfig();
const db = createDb(config);

async function ensureUser(): Promise<string> {
  const created = await db.auth.admin.createUser({
    email: SEED_EMAIL,
    password: randomBytes(16).toString("hex"),
    email_confirm: true,
  });
  if (created.data.user) return created.data.user.id;
  // Already exists — find it.
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  const user = data.users.find((u) => u.email === SEED_EMAIL);
  if (!user) throw new Error(`could not create or find seed user: ${created.error?.message}`);
  return user.id;
}

async function ensureOrg(name: string, type: "distributor" | "dealer"): Promise<string> {
  const { data: existing } = await db.from("organizations").select("id").eq("name", name).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await db.from("organizations").insert({ name, type }).select("id").single();
  if (error) throw new Error(`failed to create org ${name}: ${error.message}`);
  return data.id;
}

async function ensureProducts(dbc: Db, orgId: string): Promise<void> {
  let { data: ptype } = await dbc
    .from("product_types")
    .select("id")
    .eq("org_id", orgId)
    .eq("slug", "gateway-smoke")
    .maybeSingle();
  if (!ptype) {
    const { data, error } = await dbc
      .from("product_types")
      .insert({ org_id: orgId, name: "Gateway smoke tires", slug: "gateway-smoke" })
      .select("id")
      .single();
    if (error) throw new Error(`failed to create product type: ${error.message}`);
    ptype = data;
  }
  for (const [i, sku] of SKUS.entries()) {
    const { data: existing } = await dbc.from("products").select("id").eq("org_id", orgId).eq("sku", sku).maybeSingle();
    if (existing) continue;
    const { error } = await dbc.from("products").insert({
      org_id: orgId,
      product_type_id: ptype.id,
      sku,
      name: `Smoke test tire ${i + 1}`,
      status: "active",
      stock_qty: 20,
      stock_status: "in_stock",
    });
    if (error) throw new Error(`failed to create product ${sku}: ${error.message}`);
  }
}

async function ensurePartner(sellerOrgId: string, buyerOrgId: string): Promise<void> {
  const { data: existing } = await db
    .from("edi_partners")
    .select("id")
    .eq("org_id", sellerOrgId)
    .eq("isa_qualifier", PARTNER_ISA.qualifier)
    .eq("isa_id", PARTNER_ISA.id)
    .maybeSingle();
  if (existing) return;
  const { error } = await db.from("edi_partners").insert({
    org_id: sellerOrgId,
    name: "Gateway smoke trading partner",
    isa_qualifier: PARTNER_ISA.qualifier,
    isa_id: PARTNER_ISA.id,
    partner_org_id: buyerOrgId,
  });
  if (error) throw new Error(`failed to create edi partner: ${error.message}`);
}

async function createClient(orgId: string, createdBy: string, name: string, scopes: string[]): Promise<string> {
  const key = `trk_live_${randomBytes(24).toString("hex")}`;
  const { error } = await db.from("api_clients").insert({
    org_id: orgId,
    name,
    key_prefix: key.slice(0, 12) + "…",
    key_hash: createHash("sha256").update(key, "utf8").digest("hex"),
    scopes,
    rate_limit_per_min: Number(process.env.SEED_RATE_LIMIT ?? 60),
    created_by: createdBy,
  });
  if (error) throw new Error(`failed to create api_client ${name}: ${error.message}`);
  return key;
}

const userId = await ensureUser();
const sellerOrgId = await ensureOrg(SELLER_NAME, "distributor");
const buyerOrgId = await ensureOrg(BUYER_NAME, "dealer");
await ensureProducts(db, sellerOrgId);
await ensurePartner(sellerOrgId, buyerOrgId);

const fullKey = await createClient(sellerOrgId, userId, "gateway smoke (full)", [
  "products:read",
  "orders:read",
  "orders:write",
  "inventory:write",
  "edi:write",
]);
const limitedKey = await createClient(sellerOrgId, userId, "gateway smoke (read-only)", ["products:read"]);

console.log(`seller org: ${sellerOrgId}`);
console.log(`buyer org:  ${buyerOrgId}`);
console.log(`EDI partner ISA: ${PARTNER_ISA.qualifier}/${PARTNER_ISA.id}`);
console.log(`products: ${SKUS.join(", ")}`);
console.log(`API_KEY=${fullKey}`);
console.log(`LIMITED_API_KEY=${limitedKey}`);

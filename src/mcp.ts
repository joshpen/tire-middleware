import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sha256Hex } from "./auth/apiKey.js";
import type { Db } from "./db.js";
import * as resources from "./domain/resources.js";
import type { Actor } from "./domain/resources.js";

/**
 * MCP endpoint (Streamable HTTP, stateless) so an agent can connect and
 * manage the gateway's resources. Auth is the same bearer API key as the
 * REST API — one key, same org scoping, same scopes, enforced per tool by
 * the shared resource layer. Point an MCP client at:
 *
 *   { "url": "https://<gateway>/mcp",
 *     "headers": { "Authorization": "Bearer trk_live_…" } }
 */

async function authenticate(db: Db, authorization: string | undefined): Promise<Actor | null> {
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data: client } = await db
    .from("api_clients")
    .select("id, org_id, scopes")
    .eq("key_hash", sha256Hex(token))
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();
  if (!client) return null;
  return { clientId: client.id, orgId: client.org_id, scopes: client.scopes };
}

function buildMcpServer(db: Db, actor: Actor): McpServer {
  const server = new McpServer({ name: "tread-sync-gateway", version: "1.0.0" });

  const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
  const run = (fn: () => Promise<unknown>) =>
    fn().then(json, (err) => ({
      content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    }));

  server.tool(
    "list_products",
    "List the org's active products with stock levels and status.",
    {},
    () => run(() => resources.listProducts(db, actor)),
  );

  server.tool(
    "get_product",
    "Get one product by SKU (case-insensitive).",
    { sku: z.string() },
    ({ sku }) => run(() => resources.getProduct(db, actor, sku)),
  );

  server.tool(
    "upsert_product",
    "Create a product (sku + name required) or update an existing one by SKU. stock_qty derives stock_status from the org's threshold rules.",
    {
      sku: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      stock_qty: z.number().optional(),
      bin_location: z.string().optional(),
    },
    (input) => run(() => resources.upsertProduct(db, actor, input)),
  );

  server.tool(
    "list_orders",
    "List the org's most recent orders (with lines), optionally filtered by status (e.g. submitted, confirmed, shipped).",
    { status: z.string().optional() },
    ({ status }) => run(() => resources.listOrders(db, actor, status)),
  );

  server.tool(
    "get_order",
    "Get one order by id or PO number, including lines and totals.",
    { id_or_po_number: z.string() },
    ({ id_or_po_number }) => run(() => resources.getOrder(db, actor, id_or_po_number)),
  );

  server.tool(
    "create_order",
    "Create a purchase order (staged in the gateway and forwarded to the hub). Lines resolve against the product catalog by SKU.",
    {
      po_number: z.string().optional(),
      buyer_org_id: z.string().optional(),
      ship_to: z.string().optional(),
      notes: z.string().optional(),
      lines: z.array(z.object({ sku: z.string(), quantity: z.number(), unit_price: z.number().optional() })),
    },
    (input) => run(() => resources.createOrder(db, actor, input)),
  );

  server.tool(
    "acknowledge_order",
    "Acknowledge a submitted order (submitted → confirmed) by id or PO number.",
    { id_or_po_number: z.string() },
    ({ id_or_po_number }) => run(() => resources.ackOrder(db, actor, id_or_po_number)),
  );

  server.tool(
    "update_order_status",
    "Update an order's status: confirmed, processing, shipped, delivered, or cancelled.",
    { id_or_po_number: z.string(), status: z.string() },
    ({ id_or_po_number, status }) => run(() => resources.updateOrderStatus(db, actor, id_or_po_number, status)),
  );

  server.tool(
    "push_inventory",
    "Set stock quantities by SKU. Hub-connected orgs deliver to the hub (queued in the outbox if the hub is unreachable).",
    { rows: z.array(z.object({ sku: z.string(), qty: z.number() })) },
    ({ rows }) => run(() => resources.pushInventory(db, actor, rows)),
  );

  server.tool(
    "list_warranty_claims",
    "List warranty claims, optionally filtered by status (submitted, under_review, approved, denied, closed).",
    { status: z.string().optional() },
    ({ status }) => run(() => resources.listClaims(db, actor, status)),
  );

  server.tool(
    "get_warranty_claim",
    "Get one warranty claim by id or claim number.",
    { id_or_claim_number: z.string() },
    ({ id_or_claim_number }) => run(() => resources.getClaim(db, actor, id_or_claim_number)),
  );

  server.tool(
    "create_warranty_claim",
    "File a warranty claim (description required; sku/dot_number/quantity/customer_ref optional). Returns the claim number for tracking.",
    {
      description: z.string(),
      sku: z.string().optional(),
      dot_number: z.string().optional(),
      quantity: z.number().optional(),
      customer_ref: z.string().optional(),
    },
    (input) => run(() => resources.createClaim(db, actor, input)),
  );

  server.tool(
    "update_warranty_claim",
    "Update a warranty claim's status (submitted, under_review, approved, denied, closed) and/or resolution note.",
    { id_or_claim_number: z.string(), status: z.string().optional(), resolution: z.string().optional() },
    ({ id_or_claim_number, ...patch }) => run(() => resources.updateClaim(db, actor, id_or_claim_number, patch)),
  );

  return server;
}

export function registerMcp(app: FastifyInstance, db: Db) {
  app.post("/mcp", async (req, reply) => {
    const actor = await authenticate(db, req.headers.authorization);
    if (!actor) {
      req.apiLogged = true;
      req.apiError = "invalid api key";
      return reply.code(401).send({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized: send Authorization: Bearer <api key>" },
        id: null,
      });
    }

    // Stateless: a fresh server+transport per request; no session tracking.
    const server = buildMcpServer(db, actor);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    reply.hijack();
    reply.raw.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req.raw, reply.raw, req.body);
  });

  // Stateless server: no SSE stream or session teardown endpoints.
  for (const method of ["GET", "DELETE"] as const) {
    app.route({
      method,
      url: "/mcp",
      handler: async (_req, reply) =>
        reply.code(405).send({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Method not allowed (stateless MCP endpoint; POST only)" },
          id: null,
        }),
    });
  }
}

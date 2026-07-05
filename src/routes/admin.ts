import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { Config } from "../config.js";
import type { Db } from "../db.js";
import { resolve850Lines } from "../edi/service.js";
import { parse850 } from "../edi/sets.js";
import { parseInterchange, type X12Interchange } from "../edi/x12.js";
import { classifyContent, parseInventoryCsv, parsePriceCsv, type CsvMapping } from "../files/csv.js";
import { pollEndpoint } from "../files/poller.js";
import {
  fetchHttpsFile,
  fetchSftpFiles,
  type HttpsEndpointConfig,
  type SftpEndpointConfig,
} from "../files/transports.js";
import { getEdiPartnerMapping, type EdiPartnerMapping } from "../mappings.js";

const SAMPLE_LIMIT = 4096;
const ROW_LIMIT = 100;

interface PreviewParseBody {
  content?: string;
  file_type?: string;
  org_id?: string;
  /** Try a CSV mapping before saving it to the endpoint config. */
  mapping?: CsvMapping;
  /** Try an EDI mapping before saving it to the partner's profile. */
  edi_mapping?: EdiPartnerMapping;
}

/**
 * Service-role-only admin surface: the manual poll trigger plus the dry-run
 * preview endpoints a management UI needs to build mapping profiles — parse a
 * sample without writing anything, and fetch sample files from an endpoint
 * without marking them processed.
 */
export function registerAdminRoutes(app: FastifyInstance, config: Config, db: Db) {
  const requireServiceRole: preHandlerHookHandler = async (req, reply) => {
    const header = req.headers.authorization ?? "";
    const token = header.replace(/^Bearer\s+/i, "").trim();
    if (!token || token !== config.serviceRoleKey) {
      return reply.code(401).send({ ok: false, status: 401, error: "service role key required" });
    }
  };

  app.post<{ Params: { endpointId: string } }>(
    "/admin/poll/:endpointId",
    { preHandler: [requireServiceRole] },
    async (req, reply) => {
      const { data: endpoint, error } = await db
        .from("file_endpoints")
        .select("id, org_id, name, kind, file_type, config, created_by")
        .eq("id", req.params.endpointId)
        .maybeSingle();
      if (error) throw new Error(`endpoint lookup failed: ${error.message}`);
      if (!endpoint) return reply.code(404).send({ ok: false, status: 404, error: "endpoint not found" });
      const outcome = await pollEndpoint(db, endpoint);
      return { ok: outcome.status === "success", ...outcome };
    },
  );

  app.post<{ Body: PreviewParseBody }>(
    "/admin/preview/parse",
    { preHandler: [requireServiceRole] },
    async (req, reply) => {
      const { content, file_type = "auto", org_id, mapping, edi_mapping } = req.body ?? {};
      if (!content || typeof content !== "string") {
        return reply.code(400).send({ ok: false, status: 400, error: "body must include content (string)" });
      }

      let classification: string;
      try {
        classification = classifyContent(content, file_type);
      } catch (err) {
        return { ok: true, classification: null, error: err instanceof Error ? err.message : String(err) };
      }

      if (classification === "edi") {
        return { ok: true, classification, ...(await previewEdi(db, content, org_id, edi_mapping)) };
      }

      try {
        const rows =
          classification === "csv_inventory"
            ? parseInventoryCsv(content, mapping ?? {}).map((r) => ({ sku: r.sku, qty: r.qty }))
            : parsePriceCsv(content, mapping ?? {}).map((r) => ({ sku: r.sku, price: r.price }));
        let unknownSkus: string[] | null = null;
        if (org_id) {
          const { data: products, error } = await db.from("products").select("sku").eq("org_id", org_id);
          if (error) throw new Error(`product lookup failed: ${error.message}`);
          const known = new Set((products ?? []).map((p) => p.sku.toLowerCase()));
          unknownSkus = rows.map((r) => r.sku).filter((sku) => !known.has(sku.toLowerCase()));
        }
        return {
          ok: true,
          classification,
          row_count: rows.length,
          rows: rows.slice(0, ROW_LIMIT),
          unknown_skus: unknownSkus,
        };
      } catch (err) {
        return { ok: true, classification, error: err instanceof Error ? err.message : String(err) };
      }
    },
  );

  app.post<{ Params: { endpointId: string } }>(
    "/admin/preview/fetch/:endpointId",
    { preHandler: [requireServiceRole] },
    async (req, reply) => {
      const { data: endpoint, error } = await db
        .from("file_endpoints")
        .select("id, org_id, name, kind, file_type, config")
        .eq("id", req.params.endpointId)
        .maybeSingle();
      if (error) throw new Error(`endpoint lookup failed: ${error.message}`);
      if (!endpoint) return reply.code(404).send({ ok: false, status: 404, error: "endpoint not found" });

      const cfg = (endpoint.config ?? {}) as Record<string, unknown>;
      // Preview ignores processed-state so already-ingested files still show.
      const none = new Set<string>();
      const files =
        endpoint.kind === "sftp"
          ? await fetchSftpFiles(cfg as unknown as SftpEndpointConfig, none)
          : await fetchHttpsFile(cfg as unknown as HttpsEndpointConfig, none);

      return {
        ok: true,
        endpoint: { id: endpoint.id, name: endpoint.name, kind: endpoint.kind, file_type: endpoint.file_type },
        files: files.map((f) => {
          let classification: string | null = null;
          let classifyError: string | null = null;
          try {
            classification = classifyContent(f.content, endpoint.file_type);
          } catch (err) {
            classifyError = err instanceof Error ? err.message : String(err);
          }
          return {
            name: f.name,
            key: f.key,
            size: f.content.length,
            classification,
            classify_error: classifyError,
            sample: f.content.slice(0, SAMPLE_LIMIT),
          };
        }),
      };
    },
  );
}

async function previewEdi(db: Db, content: string, orgId?: string, tryMapping?: EdiPartnerMapping) {
  let interchange: X12Interchange;
  try {
    interchange = parseInterchange(content);
  } catch (err) {
    return { error: `not a parseable X12 interchange: ${err instanceof Error ? err.message : String(err)}` };
  }

  const summary = {
    sender: `${interchange.senderQualifier}/${interchange.senderId}`,
    receiver: `${interchange.receiverQualifier}/${interchange.receiverId}`,
    control: interchange.control,
    transaction_sets: interchange.groups.flatMap((g) => g.transactions.map((t) => t.set)),
  };
  if (!orgId) return { interchange: summary };

  const { data: partner } = await db
    .from("edi_partners")
    .select("id, name, partner_org_id, is_active")
    .eq("org_id", orgId)
    .eq("isa_qualifier", interchange.senderQualifier)
    .eq("isa_id", interchange.senderId)
    .maybeSingle();

  const mapping = tryMapping ?? (partner ? await getEdiPartnerMapping(db, orgId, partner.id) : {});
  const transactions = [];
  for (const group of interchange.groups) {
    for (const txn of group.transactions) {
      if (txn.set !== "850") {
        transactions.push({ set: txn.set, error: "only 850 is processed inbound" });
        continue;
      }
      try {
        const po = parse850(txn);
        const resolution = await resolve850Lines(db, orgId, po.lines, mapping);
        transactions.push({
          set: txn.set,
          po_number: po.poNumber,
          lines: resolution.map((r) => ({
            line_number: r.line.lineNumber,
            quantity: r.line.quantity,
            unit_price: r.line.unitPrice,
            identifiers: { VN: r.line.vendorPart, UP: r.line.upc, BP: r.line.buyerPart },
            lookup: r.lookup,
            resolved: r.product,
            error: r.error,
          })),
        });
      } catch (err) {
        transactions.push({ set: txn.set, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  return {
    interchange: summary,
    partner: partner
      ? { id: partner.id, name: partner.name, linked_org: partner.partner_org_id, is_active: partner.is_active }
      : null,
    partner_error: partner ? null : `no EDI partner for ISA ${summary.sender}`,
    mapping_used: mapping,
    transactions,
  };
}

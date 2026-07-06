import type { Db } from "../db.js";
import { getHubConnection } from "../hub/connector.js";
import { enqueueDelivery } from "../hub/outbox.js";
import {
  DEFAULT_QUALIFIER_PRIORITY,
  getEdiPartnerMapping,
  xrefSku,
  type EdiPartnerMapping,
} from "../mappings.js";
import {
  generate855,
  generate856,
  generate810,
  generate997,
  parse850,
  parse997,
  type Edi850,
  type Edi850Line,
} from "./sets.js";
import { parseInterchange, type X12Interchange, type X12Transaction } from "./x12.js";

/**
 * Next outbound control number for an org. Outbound control numbers are
 * written zero-padded to 9 digits, so lexicographic max == numeric max.
 */
export async function nextControlNumber(db: Db, orgId: string): Promise<string> {
  const { data, error } = await db
    .from("edi_messages")
    .select("control_number")
    .eq("org_id", orgId)
    .eq("direction", "outbound")
    .not("control_number", "is", null)
    .order("control_number", { ascending: false })
    .limit(1);
  if (error) throw new Error(`control number lookup failed: ${error.message}`);
  const last = data?.[0]?.control_number;
  const next = (last ? parseInt(last, 10) : 0) + 1;
  return String(next).padStart(9, "0");
}

export interface EdiIdentity {
  qualifier: string;
  id: string;
}

async function storeOutbound(
  db: Db,
  args: {
    orgId: string;
    partnerId: string | null;
    set: string;
    control: string;
    raw: string;
    relatedOrderId?: string | null;
  },
): Promise<string> {
  const { data, error } = await db
    .from("edi_messages")
    .insert({
      org_id: args.orgId,
      partner_id: args.partnerId,
      direction: "outbound",
      transaction_set: args.set,
      control_number: args.control,
      status: "generated",
      raw: args.raw,
      related_order_id: args.relatedOrderId ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`failed to store outbound ${args.set}: ${error.message}`);
  return data.id;
}

export interface Acknowledged {
  message_id: string;
  transaction_set: string;
  control_number: string;
  /** "accepted" | "accepted_with_errors" | "rejected" | "unmatched" */
  disposition: string;
}

export interface InboundResult {
  messageId: string;
  transactionSet: string;
  status: "processed" | "error";
  error: string | null;
  orderIds: string[];
  ack997Id: string | null;
  /** Outbound messages reconciled by inbound 997s in this interchange. */
  acknowledged: Acknowledged[];
}

const AK5_DISPOSITION: Record<string, string> = {
  A: "accepted",
  E: "accepted_with_errors",
  R: "rejected",
  M: "rejected",
  W: "rejected",
  X: "rejected",
};

/**
 * Applies one inbound 997 to the outbound ledger: each acknowledged
 * transaction (AK2 set + AK1 group control) is matched to our outbound
 * edi_messages row (control numbers are the 9-digit per-org sequence) and its
 * status moves to `processed` (accepted) or `error` (rejected), stamping
 * processed_at. Unmatched acknowledgments are reported, not dropped.
 */
export async function reconcile997(db: Db, orgId: string, txn: X12Transaction): Promise<Acknowledged[]> {
  const ack = parse997(txn);
  const control = String(parseInt(ack.groupControl, 10)).padStart(9, "0");
  // Some 997s omit AK2 loops; fall back to the group-level result.
  const entries = ack.acknowledged.length
    ? ack.acknowledged.map((a) => ({ set: a.set, status: a.status }))
    : [{ set: null as string | null, status: ack.groupStatus }];

  const results: Acknowledged[] = [];
  for (const entry of entries) {
    let query = db
      .from("edi_messages")
      .select("id, transaction_set")
      .eq("org_id", orgId)
      .eq("direction", "outbound")
      .eq("control_number", control);
    if (entry.set) query = query.eq("transaction_set", entry.set);
    const { data: outbound, error } = await query.limit(1);
    if (error) throw new Error(`997 reconciliation lookup failed: ${error.message}`);
    const match = outbound?.[0];
    const disposition = AK5_DISPOSITION[entry.status] ?? "accepted";
    if (!match) {
      results.push({
        message_id: "",
        transaction_set: entry.set ?? "?",
        control_number: control,
        disposition: "unmatched",
      });
      continue;
    }
    const { error: updateError } = await db
      .from("edi_messages")
      .update(
        disposition === "rejected"
          ? { status: "error", error: `rejected by partner 997 (AK5 ${entry.status})`, processed_at: new Date().toISOString() }
          : { status: "processed", processed_at: new Date().toISOString() },
      )
      .eq("id", match.id);
    if (updateError) throw new Error(`997 reconciliation update failed: ${updateError.message}`);
    results.push({
      message_id: match.id,
      transaction_set: match.transaction_set,
      control_number: control,
      disposition,
    });
  }
  return results;
}

/**
 * Full inbound pipeline for a raw X12 interchange received for `orgId`
 * (the org that owns the API client or file endpoint):
 *   1. store the raw message in edi_messages (status received)
 *   2. resolve the trading partner from the ISA sender identity
 *   3. for each 850: create purchase_orders + purchase_order_lines
 *      (PO1 qualifiers VN → products.sku, UP → products.barcode)
 *   4. generate + store a 997 back to the sender
 */
export async function processInboundInterchange(
  db: Db,
  orgId: string,
  raw: string,
  existingMessageId?: string,
): Promise<InboundResult> {
  let interchange: X12Interchange | null = null;
  let transactionSet = "unknown";
  try {
    interchange = parseInterchange(raw);
    transactionSet = interchange.groups[0]?.transactions[0]?.set ?? "unknown";
  } catch {
    // Stored below with a parse error.
  }

  let messageId: string;
  if (existingMessageId) {
    // Operator retry of a stored message: reuse the ledger row.
    messageId = existingMessageId;
    const { error } = await db
      .from("edi_messages")
      .update({ status: "received", error: null, processed_at: null })
      .eq("id", messageId);
    if (error) throw new Error(`failed to reset message for retry: ${error.message}`);
  } else {
    const { data: inserted, error: insertError } = await db
      .from("edi_messages")
      .insert({
        org_id: orgId,
        direction: "inbound",
        transaction_set: transactionSet,
        control_number: interchange?.control ?? null,
        status: "received",
        raw,
      })
      .select("id")
      .single();
    if (insertError) throw new Error(`failed to store inbound message: ${insertError.message}`);
    messageId = inserted.id;
  }

  const fail = async (message: string): Promise<InboundResult> => {
    await db
      .from("edi_messages")
      .update({ status: "error", error: message, processed_at: new Date().toISOString() })
      .eq("id", messageId);
    return {
      messageId,
      transactionSet,
      status: "error",
      error: message,
      orderIds: [],
      ack997Id: null,
      acknowledged: [],
    };
  };

  if (!interchange) return fail("document is not a parseable X12 interchange");

  // Resolve the trading partner from the ISA sender identity.
  const { data: partner, error: partnerError } = await db
    .from("edi_partners")
    .select("id, partner_org_id, name")
    .eq("org_id", orgId)
    .eq("isa_qualifier", interchange.senderQualifier)
    .eq("isa_id", interchange.senderId)
    .eq("is_active", true)
    .maybeSingle();
  if (partnerError) return fail(`partner lookup failed: ${partnerError.message}`);
  if (!partner) {
    return fail(`no active EDI partner for ISA ${interchange.senderQualifier}/${interchange.senderId}`);
  }
  await db.from("edi_messages").update({ partner_id: partner.id }).eq("id", messageId);

  const orderIds: string[] = [];
  const acknowledged: Acknowledged[] = [];
  // A 997 is never acknowledged with another 997; only answer content sets.
  const hasContentSets = interchange.groups.some((g) => g.transactions.some((t) => t.set !== "997"));
  try {
    const mapping = await getEdiPartnerMapping(db, orgId, partner.id);
    for (const group of interchange.groups) {
      for (const txn of group.transactions) {
        if (txn.set === "997") {
          acknowledged.push(...(await reconcile997(db, orgId, txn)));
          continue;
        }
        if (txn.set !== "850") {
          throw new Error(`unsupported inbound transaction set ${txn.set} (only 850 and 997 are processed)`);
        }
        if (!partner.partner_org_id) {
          throw new Error(`EDI partner "${partner.name}" is not linked to a platform org`);
        }
        const orderId = await createOrderFrom850(db, orgId, partner.partner_org_id, txn, mapping);
        orderIds.push(orderId);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Still acknowledge receipt: the interchange arrived even if we couldn't apply it.
    const ack997Id = hasContentSets ? await emit997(db, orgId, partner.id, interchange).catch(() => null) : null;
    await db
      .from("edi_messages")
      .update({ status: "error", error: message, processed_at: new Date().toISOString() })
      .eq("id", messageId);
    return { messageId, transactionSet, status: "error", error: message, orderIds, ack997Id, acknowledged };
  }

  const ack997Id = hasContentSets ? await emit997(db, orgId, partner.id, interchange) : null;
  await db
    .from("edi_messages")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
      related_order_id: orderIds[0] ?? null,
    })
    .eq("id", messageId);

  // Hub-connected orgs: forward the validated interchange to the hub's API
  // (edi.receive) via the outbox. Local order rows are staging; the hub is
  // the system of record.
  if (hasContentSets) {
    try {
      const conn = await getHubConnection(db, orgId);
      if (conn) await enqueueDelivery(db, orgId, "edi.receive", { document: raw }, messageId);
    } catch (err) {
      // Forwarding is best-effort here; the outbox sweep will retry.
    }
  }

  return { messageId, transactionSet, status: "processed", error: null, orderIds, ack997Id, acknowledged };
}

export interface ResolvedLine {
  line: Edi850Line;
  /** Identifier value used for the lookup (after cross-reference). */
  lookup: string | null;
  product: { id: string; sku: string; name: string } | null;
  error: string | null;
}

/**
 * Resolves 850 lines to seller products, honoring the partner's mapping
 * profile (qualifier priority + SKU cross-reference). VN/BP resolve against
 * products.sku, UP against products.barcode — a cross-referenced value always
 * resolves against products.sku. Read-only; shared by ingestion and preview.
 */
export async function resolve850Lines(
  db: Db,
  sellerOrgId: string,
  lines: Edi850Line[],
  mapping: EdiPartnerMapping = {},
): Promise<ResolvedLine[]> {
  const priority = mapping.qualifier_priority ?? DEFAULT_QUALIFIER_PRIORITY;
  const results: ResolvedLine[] = [];
  for (const line of lines) {
    const byQualifier = { VN: line.vendorPart, UP: line.upc, BP: line.buyerPart };
    let resolved: ResolvedLine = {
      line,
      lookup: null,
      product: null,
      error: `PO1 line ${line.lineNumber} has no product identifier for qualifiers ${priority.join("/")}`,
    };
    for (const qualifier of priority) {
      const value = byQualifier[qualifier];
      if (!value) continue;
      const mapped = xrefSku(value, mapping.sku_xref);
      const wasXrefed = mapped !== value;
      let query = db.from("products").select("id, sku, name").eq("org_id", sellerOrgId).limit(1);
      // UP is a barcode lookup unless the xref already translated it to a SKU.
      query = qualifier === "UP" && !wasXrefed ? query.eq("barcode", mapped) : query.ilike("sku", mapped);
      const { data: products, error } = await query;
      if (error) throw new Error(`product lookup failed: ${error.message}`);
      if (products?.[0]) {
        resolved = { line, lookup: mapped, product: products[0], error: null };
        break;
      }
      resolved = {
        line,
        lookup: mapped,
        product: null,
        error: `PO1 line ${line.lineNumber}: no product matches ${qualifier} ${mapped}`,
      };
    }
    results.push(resolved);
  }
  return results;
}

async function createOrderFrom850(
  db: Db,
  sellerOrgId: string,
  buyerOrgId: string,
  txn: X12Transaction,
  mapping: EdiPartnerMapping,
): Promise<string> {
  const po: Edi850 = parse850(txn);

  const resolution = await resolve850Lines(db, sellerOrgId, po.lines, mapping);
  const failures = resolution.filter((r) => r.error);
  if (failures.length > 0) throw new Error(failures.map((f) => f.error).join("; "));
  const resolved = resolution.map((r) => ({
    product_id: r.product!.id,
    sku: r.product!.sku,
    name: r.product!.name,
    quantity: r.line.quantity,
    unit_price: r.line.unitPrice ?? 0,
  }));

  const subtotal = resolved.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
  const { data: order, error: orderError } = await db
    .from("purchase_orders")
    .insert({
      po_number: po.poNumber,
      buyer_org_id: buyerOrgId,
      seller_org_id: sellerOrgId,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      ship_to_address: po.shipTo?.address ?? null,
      notes: po.notes,
      subtotal,
      total_amount: subtotal,
    })
    .select("id")
    .single();
  if (orderError) throw new Error(`failed to create purchase order ${po.poNumber}: ${orderError.message}`);

  const { error: linesError } = await db.from("purchase_order_lines").insert(
    resolved.map((l, i) => ({
      order_id: order.id,
      product_id: l.product_id,
      sku: l.sku,
      name: l.name,
      quantity: l.quantity,
      unit_price: l.unit_price,
      // total_price is a generated column.
      sort_order: i,
    })),
  );
  if (linesError) {
    // Don't leave a line-less order behind.
    await db.from("purchase_orders").delete().eq("id", order.id);
    throw new Error(`failed to create lines for ${po.poNumber}: ${linesError.message}`);
  }
  return order.id;
}

async function emit997(db: Db, orgId: string, partnerId: string, received: X12Interchange): Promise<string> {
  const control = await nextControlNumber(db, orgId);
  const raw = generate997(received, {
    // Reply with the identities reversed: we were the receiver.
    senderQualifier: received.receiverQualifier,
    senderId: received.receiverId,
    receiverQualifier: received.senderQualifier,
    receiverId: received.senderId,
    controlNumber: control,
  });
  return storeOutbound(db, { orgId, partnerId, set: "997", control, raw });
}

async function partnerForBuyer(db: Db, orgId: string, buyerOrgId: string) {
  const { data } = await db
    .from("edi_partners")
    .select("id, isa_qualifier, isa_id")
    .eq("org_id", orgId)
    .eq("partner_org_id", buyerOrgId)
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
}

/** Our outbound ISA identity: the org's own partner row is not modeled, so use ZZ + org id prefix. */
function selfIdentity(orgId: string): EdiIdentity {
  return { qualifier: "ZZ", id: orgId.replace(/-/g, "").slice(0, 15).toUpperCase() };
}

/** Generate + store an 855 acknowledgment for an order (by id). */
export async function emit855ForOrder(db: Db, orderId: string): Promise<{ messageId: string; raw: string }> {
  const { data: order, error } = await db
    .from("purchase_orders")
    .select(
      "id, po_number, created_at, seller_org_id, buyer_org_id, seller:organizations!purchase_orders_seller_org_id_fkey(name), buyer:organizations!purchase_orders_buyer_org_id_fkey(name), lines:purchase_order_lines(sku, name, quantity, unit_price)",
    )
    .eq("id", orderId)
    .single();
  if (error || !order) throw new Error(`order ${orderId} not found: ${error?.message ?? "no row"}`);

  const partner = await partnerForBuyer(db, order.seller_org_id, order.buyer_org_id);
  const self = selfIdentity(order.seller_org_id);
  const control = await nextControlNumber(db, order.seller_org_id);
  const raw = generate855(
    {
      poNumber: order.po_number,
      orderDate: new Date(order.created_at),
      sellerName: order.seller?.name ?? "SELLER",
      buyerName: order.buyer?.name ?? "BUYER",
      lines: order.lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPrice: l.unit_price, name: l.name })),
    },
    {
      senderQualifier: self.qualifier,
      senderId: self.id,
      receiverQualifier: partner?.isa_qualifier ?? "ZZ",
      receiverId: partner?.isa_id ?? "UNKNOWN",
      controlNumber: control,
    },
  );
  const messageId = await storeOutbound(db, {
    orgId: order.seller_org_id,
    partnerId: partner?.id ?? null,
    set: "855",
    control,
    raw,
    relatedOrderId: order.id,
  });
  return { messageId, raw };
}

/** Generate + store an 856 ASN for a shipment (by id). */
export async function emit856ForShipment(db: Db, shipmentId: string): Promise<{ messageId: string; raw: string }> {
  const { data: shipment, error } = await db
    .from("shipments")
    .select(
      "id, shipment_number, shipped_at, carrier, bol_number, pro_number, seller_org_id, buyer_org_id, order_id, order:purchase_orders(po_number), lines:shipment_lines(quantity, order_line:purchase_order_lines(sku))",
    )
    .eq("id", shipmentId)
    .single();
  if (error || !shipment) throw new Error(`shipment ${shipmentId} not found: ${error?.message ?? "no row"}`);

  const partner = await partnerForBuyer(db, shipment.seller_org_id, shipment.buyer_org_id);
  const self = selfIdentity(shipment.seller_org_id);
  const control = await nextControlNumber(db, shipment.seller_org_id);
  const raw = generate856(
    {
      shipmentNumber: shipment.shipment_number,
      shippedAt: new Date(shipment.shipped_at),
      poNumber: shipment.order?.po_number ?? "",
      carrier: shipment.carrier,
      bolNumber: shipment.bol_number,
      proNumber: shipment.pro_number,
      lines: shipment.lines.map((l) => ({ sku: l.order_line?.sku ?? "", quantity: l.quantity })),
    },
    {
      senderQualifier: self.qualifier,
      senderId: self.id,
      receiverQualifier: partner?.isa_qualifier ?? "ZZ",
      receiverId: partner?.isa_id ?? "UNKNOWN",
      controlNumber: control,
    },
  );
  const messageId = await storeOutbound(db, {
    orgId: shipment.seller_org_id,
    partnerId: partner?.id ?? null,
    set: "856",
    control,
    raw,
    relatedOrderId: shipment.order_id,
  });
  return { messageId, raw };
}

/** Generate + store an 810 invoice for an order_invoice (by id). */
export async function emit810ForInvoice(db: Db, invoiceId: string): Promise<{ messageId: string; raw: string }> {
  const { data: invoice, error } = await db
    .from("order_invoices")
    .select(
      "id, invoice_number, issue_date, total, order_id, seller_org_id, buyer_org_id, seller:organizations!order_invoices_seller_org_id_fkey(name), buyer:organizations!order_invoices_buyer_org_id_fkey(name), order:purchase_orders(po_number, created_at, lines:purchase_order_lines(sku, quantity, unit_price))",
    )
    .eq("id", invoiceId)
    .single();
  if (error || !invoice) throw new Error(`invoice ${invoiceId} not found: ${error?.message ?? "no row"}`);
  if (!invoice.order) throw new Error(`invoice ${invoiceId} has no related order`);

  const partner = await partnerForBuyer(db, invoice.seller_org_id, invoice.buyer_org_id);
  const self = selfIdentity(invoice.seller_org_id);
  const control = await nextControlNumber(db, invoice.seller_org_id);
  const raw = generate810(
    {
      invoiceNumber: invoice.invoice_number,
      issueDate: new Date(invoice.issue_date),
      poNumber: invoice.order.po_number,
      orderDate: new Date(invoice.order.created_at),
      sellerName: invoice.seller?.name ?? "SELLER",
      buyerName: invoice.buyer?.name ?? "BUYER",
      total: invoice.total,
      lines: invoice.order.lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPrice: l.unit_price })),
    },
    {
      senderQualifier: self.qualifier,
      senderId: self.id,
      receiverQualifier: partner?.isa_qualifier ?? "ZZ",
      receiverId: partner?.isa_id ?? "UNKNOWN",
      controlNumber: control,
    },
  );
  const messageId = await storeOutbound(db, {
    orgId: invoice.seller_org_id,
    partnerId: partner?.id ?? null,
    set: "810",
    control,
    raw,
    relatedOrderId: invoice.order_id,
  });
  return { messageId, raw };
}

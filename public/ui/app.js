/* tread-sync-gateway admin dashboard — no build step, plain DOM. */
"use strict";

const $app = document.getElementById("app");
const SCOPES = ["products:read", "products:write", "orders:read", "orders:write", "inventory:write", "edi:write", "warranty:read", "warranty:write"];
let orgs = [];

// ── infrastructure ────────────────────────────────────────────────────────────

function token() { return sessionStorage.getItem("gw_token") || ""; }

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) {
    sessionStorage.removeItem("gw_token");
    renderLogin("Session token rejected — sign in again.");
    throw new Error("unauthorized");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok && data.error) throw new Error(data.error);
  if (!res.ok) throw new Error(`request failed (${res.status})`);
  return data;
}

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) el.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined) continue;
    el.append(child.nodeType ? child : document.createTextNode(child));
  }
  return el;
}

function toast(msg, isErr = false) {
  const el = h("div", { class: `toast${isErr ? " err" : ""}` }, msg);
  document.body.append(el);
  setTimeout(() => el.remove(), isErr ? 6000 : 3000);
}

function modal(title, content, { wide } = {}) {
  const box = h("div", { class: `modal${wide ? " wide" : ""}` }, h("h3", {}, title), content);
  const backdrop = h("div", { class: "modal-backdrop", onclick: (e) => e.target === backdrop && close() }, box);
  document.body.append(backdrop);
  function close() { backdrop.remove(); }
  return { close, box };
}

const fmtDate = (s) => (s ? new Date(s).toLocaleString() : "—");
const badgeClass = { active: "ok", processed: "ok", success: "ok", confirmed: "ok", generated: "info", sent: "info", received: "info", running: "info", error: "err", failed: "err", inactive: "err", low_stock: "warn" };
const badge = (text) => h("span", { class: `badge ${badgeClass[text] || ""}` }, text);
const orgName = (id) => orgs.find((o) => o.id === id)?.name || id?.slice(0, 8) || "—";

function orgSelect(value, attrs = {}) {
  return h("select", attrs, orgs.map((o) => {
    const opt = h("option", { value: o.id }, `${o.name} (${o.type})`);
    if (o.id === value) opt.selected = true;
    return opt;
  }));
}

function field(labelText, input, hint) {
  return h("div", {}, h("label", {}, labelText), input, hint ? h("div", { class: "hint" }, hint) : null);
}

function jsonArea(value, rows = 8) {
  return h("textarea", { class: "code", rows, style: "width:100%" },
    value === undefined ? "" : JSON.stringify(value, null, 2));
}

function readJson(textarea, label) {
  const text = textarea.value.trim();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { throw new Error(`${label}: invalid JSON`); }
}

function actionBtn(label, fn, cls = "secondary small") {
  return h("button", {
    class: cls,
    onclick: async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      btn.disabled = true;
      try { await fn(); } catch (err) { toast(err.message, true); } finally { btn.disabled = false; }
    },
  }, label);
}

function table(headers, rows, emptyText) {
  if (!rows.length) return h("div", { class: "empty" }, emptyText);
  return h("table", {},
    h("thead", {}, h("tr", {}, headers.map((th) => h("th", {}, th)))),
    h("tbody", {}, rows));
}

// ── login ─────────────────────────────────────────────────────────────────────

function renderLogin(note) {
  const input = h("input", { type: "password", placeholder: "Admin token", autofocus: "" });
  const form = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      sessionStorage.setItem("gw_token", input.value.trim());
      try {
        await api("/admin/api/overview");
        route();
      } catch { /* api() already returned to login */ }
    },
  },
    field("Token", input, "GATEWAY_ADMIN_TOKEN (or the service-role key if none is set)"),
    h("button", { type: "submit" }, "Sign in"),
  );
  $app.replaceChildren(h("div", { class: "login-wrap" },
    h("div", { class: "login" },
      h("h1", {}, "tread-sync ", h("span", { style: "color:var(--accent)" }, "gateway")),
      h("p", { class: "sub" }, note || "Operator console"),
      form)));
}

// ── layout + router ───────────────────────────────────────────────────────────

const VIEWS = {
  overview: { label: "Overview", render: viewOverview },
  clients: { label: "API Clients", render: viewClients },
  partners: { label: "EDI Partners", render: viewPartners },
  messages: { label: "EDI Messages", render: viewMessages },
  endpoints: { label: "File Endpoints", render: viewEndpoints },
  hub: { label: "Hub Connection", render: viewHub },
  preview: { label: "Preview / Dry-run", render: viewPreview },
  settings: { label: "Org Settings", render: viewSettings },
  logs: { label: "Logs & Runs", render: viewLogs },
};

async function route() {
  if (!token()) return renderLogin();
  const key = (location.hash || "#overview").slice(1);
  const view = VIEWS[key] || VIEWS.overview;
  if (!orgs.length) {
    try { orgs = (await api("/admin/api/orgs")).orgs; } catch (err) { return; }
  }
  const main = h("div", { class: "main" }, h("p", { class: "muted" }, "Loading…"));
  $app.replaceChildren(h("div", { class: "layout" },
    h("div", { class: "sidebar" },
      h("div", { class: "brand" }, "tread-sync ", h("span", {}, "gateway")),
      h("div", { class: "nav" }, Object.entries(VIEWS).map(([k, v]) =>
        h("a", { href: `#${k}`, class: k === key ? "active" : "" }, v.label))),
      h("div", { class: "foot" },
        h("button", { class: "secondary small", onclick: () => { sessionStorage.removeItem("gw_token"); renderLogin(); } }, "Sign out"))),
    main));
  try {
    main.replaceChildren(await view.render());
  } catch (err) {
    if (err.message !== "unauthorized") main.replaceChildren(h("div", { class: "empty" }, `Failed to load: ${err.message}`));
  }
}
window.addEventListener("hashchange", route);

// ── overview ──────────────────────────────────────────────────────────────────

async function viewOverview() {
  const o = await api("/admin/api/overview");
  const msgCards = Object.entries(o.messages_by_status).map(([k, n]) =>
    h("div", { class: "card" }, h("div", { class: "num" }, String(n)), h("div", { class: "label" }, k)));
  return h("div", {},
    h("h1", {}, "Overview"),
    h("p", { class: "sub" }, "Gateway health at a glance."),
    h("div", { class: "cards" },
      h("div", { class: "card" }, h("div", { class: "num" }, String(o.clients)), h("div", { class: "label" }, "API clients")),
      h("div", { class: "card" }, h("div", { class: "num" }, String(o.partners)), h("div", { class: "label" }, "EDI partners")),
      h("div", { class: "card" }, h("div", { class: "num" }, String(o.endpoints)), h("div", { class: "label" }, "File endpoints")),
      h("div", { class: `card${o.unacknowledged ? " warn" : ""}` },
        h("div", { class: "num" }, String(o.unacknowledged)), h("div", { class: "label" }, "Awaiting 997 ack"))),
    h("div", { class: "cards" }, msgCards),
    h("h2", {}, "Recent integration runs"),
    table(["Started", "Org", "Status", "Records", "Detail"],
      o.recent_runs.map((r) => h("tr", {},
        h("td", {}, fmtDate(r.started_at)),
        h("td", {}, r.org?.name || "—"),
        h("td", {}, badge(r.status)),
        h("td", {}, String(r.records_processed)),
        h("td", { class: "muted" }, r.detail || ""))),
      "No runs yet."));
}

// ── API clients ───────────────────────────────────────────────────────────────

async function viewClients() {
  const { clients } = await api("/admin/api/clients");
  const rows = clients.map((c) => h("tr", {},
    h("td", {}, c.name, h("div", { class: "muted" }, c.key_prefix)),
    h("td", {}, c.org?.name || orgName(c.org_id)),
    h("td", {}, c.scopes.map((s) => badge(s))),
    h("td", {}, `${c.rate_limit_per_min}/min`),
    h("td", {}, badge(c.is_active ? "active" : "inactive"),
      c.expires_at ? h("div", { class: "muted" }, `expires ${fmtDate(c.expires_at)}`) : null),
    h("td", {}, fmtDate(c.last_used_at)),
    h("td", {},
      actionBtn("Edit", () => editClient(c)),
      " ",
      actionBtn(c.is_active ? "Deactivate" : "Activate", async () => {
        await api(`/admin/api/clients/${c.id}`, { method: "PATCH", body: { is_active: !c.is_active } });
        toast(`${c.name} ${c.is_active ? "deactivated" : "activated"}`); route();
      }, c.is_active ? "danger small" : "secondary small"))));
  return h("div", {},
    h("h1", {}, "API Clients"),
    h("p", { class: "sub" }, "Bearer keys for the partner REST API. Keys are hashed — the plaintext is shown once at creation."),
    h("div", { class: "toolbar" }, h("div", { class: "spacer" }), h("button", { onclick: createClient }, "+ New client")),
    table(["Name", "Org", "Scopes", "Rate limit", "Status", "Last used", ""], rows, "No API clients yet."));
}

function scopeChecks(selected = []) {
  const wrap = h("div", { class: "checks" }, SCOPES.map((s) =>
    h("label", {}, h("input", { type: "checkbox", value: s, ...(selected.includes(s) ? { checked: "" } : {}) }), s)));
  wrap.read = () => [...wrap.querySelectorAll("input:checked")].map((i) => i.value);
  return wrap;
}

function createClient() {
  const org = orgSelect();
  const name = h("input", { placeholder: "e.g. Acme Distribution ERP" });
  const scopes = scopeChecks(["products:read"]);
  const rate = h("input", { type: "number", value: "120" });
  const expires = h("input", { type: "date" });
  const { close, box } = modal("New API client", h("div", {},
    field("Organization", org), field("Name", name), field("Scopes", scopes),
    h("div", { class: "row" }, field("Rate limit (req/min)", rate), field("Expires (optional)", expires)),
    h("div", { class: "actions" },
      h("button", { class: "secondary", onclick: () => close() }, "Cancel"),
      actionBtn("Create", async () => {
        const res = await api("/admin/api/clients", { method: "POST", body: {
          org_id: org.value, name: name.value.trim(), scopes: scopes.read(),
          rate_limit_per_min: Number(rate.value) || 120,
          expires_at: expires.value ? new Date(expires.value).toISOString() : null,
        }});
        box.replaceChildren(h("h3", {}, "API key created"),
          h("p", { class: "sub" }, "Copy it now — it is not stored and cannot be shown again."),
          h("div", { class: "keybox" }, res.api_key),
          h("div", { class: "actions" },
            h("button", { onclick: () => navigator.clipboard.writeText(res.api_key).then(() => toast("Copied")) }, "Copy"),
            h("button", { class: "secondary", onclick: () => { close(); route(); } }, "Done")));
      }, ""))));
}

function editClient(c) {
  const name = h("input", { value: c.name });
  const scopes = scopeChecks(c.scopes);
  const rate = h("input", { type: "number", value: String(c.rate_limit_per_min) });
  const { close } = modal(`Edit ${c.name}`, h("div", {},
    field("Name", name), field("Scopes", scopes), field("Rate limit (req/min)", rate),
    h("div", { class: "actions" },
      h("button", { class: "secondary", onclick: () => close() }, "Cancel"),
      actionBtn("Save", async () => {
        await api(`/admin/api/clients/${c.id}`, { method: "PATCH", body: {
          name: name.value.trim(), scopes: scopes.read(), rate_limit_per_min: Number(rate.value) || c.rate_limit_per_min,
        }});
        close(); toast("Client updated"); route();
      }, ""))));
}

// ── EDI partners ──────────────────────────────────────────────────────────────

async function viewPartners() {
  const { partners } = await api("/admin/api/partners");
  const rows = partners.map((p) => h("tr", {},
    h("td", {}, p.name, p.notes ? h("div", { class: "muted" }, p.notes) : null),
    h("td", {}, p.org?.name || orgName(p.org_id)),
    h("td", {}, `${p.isa_qualifier}/${p.isa_id}`),
    h("td", {}, p.partner_org?.name || h("span", { class: "badge warn" }, "not linked")),
    h("td", {}, badge(p.is_active ? "active" : "inactive")),
    h("td", {},
      actionBtn("Edit", () => editPartner(p)), " ",
      actionBtn("Mapping", () => editPartnerMapping(p)), " ",
      actionBtn(p.is_active ? "Deactivate" : "Activate", async () => {
        await api(`/admin/api/partners/${p.id}`, { method: "PATCH", body: { is_active: !p.is_active } });
        toast("Partner updated"); route();
      }, p.is_active ? "danger small" : "secondary small"))));
  return h("div", {},
    h("h1", {}, "EDI Partners"),
    h("p", { class: "sub" }, "ISA sender identities mapped to platform orgs. Inbound 850s resolve their partner here."),
    h("div", { class: "toolbar" }, h("div", { class: "spacer" }), h("button", { onclick: () => editPartner(null) }, "+ New partner")),
    table(["Name", "Owner org", "ISA identity", "Linked buyer org", "Status", ""], rows, "No partners yet."));
}

function editPartner(p) {
  const org = orgSelect(p?.org_id);
  const name = h("input", { value: p?.name || "", placeholder: "Trading partner name" });
  const qual = h("input", { value: p?.isa_qualifier || "ZZ", maxlength: "2" });
  const isa = h("input", { value: p?.isa_id || "", placeholder: "ISA sender ID" });
  const buyerWrap = orgSelect(p?.partner_org_id);
  buyerWrap.prepend(h("option", { value: "" }, "— not linked —"));
  if (!p?.partner_org_id) buyerWrap.value = "";
  const notes = h("input", { value: p?.notes || "" });
  const { close } = modal(p ? `Edit ${p.name}` : "New EDI partner", h("div", {},
    field("Owner organization", org, "The org that receives this partner's documents (the seller)."),
    field("Name", name),
    h("div", { class: "row" }, field("ISA qualifier", qual), field("ISA ID", isa)),
    field("Linked buyer org", buyerWrap, "Inbound 850s create purchase orders with this org as the buyer."),
    field("Notes", notes),
    h("div", { class: "actions" },
      h("button", { class: "secondary", onclick: () => close() }, "Cancel"),
      actionBtn("Save", async () => {
        const body = {
          org_id: org.value, name: name.value.trim(), isa_qualifier: qual.value.trim() || "ZZ",
          isa_id: isa.value.trim(), partner_org_id: buyerWrap.value || null, notes: notes.value.trim() || null,
        };
        if (p) await api(`/admin/api/partners/${p.id}`, { method: "PATCH", body });
        else await api("/admin/api/partners", { method: "POST", body });
        close(); toast("Partner saved"); route();
      }, ""))));
}

async function editPartnerMapping(p) {
  const { config } = await api(`/admin/api/org-config/${p.org_id}`);
  const current = (config.edi_mappings || {})[p.id] || { qualifier_priority: ["VN", "UP", "BP"], sku_xref: {} };
  const area = jsonArea(current, 12);
  const { close } = modal(`EDI mapping — ${p.name}`, h("div", {},
    h("p", { class: "sub" }, "qualifier_priority: which PO1 identifiers to try in order (VN/UP/BP). sku_xref: partner part number → your SKU."),
    area,
    h("div", { class: "actions" },
      h("button", { class: "secondary", onclick: () => close() }, "Cancel"),
      actionBtn("Save mapping", async () => {
        const mapping = readJson(area, "mapping") || {};
        const next = { ...config, edi_mappings: { ...(config.edi_mappings || {}), [p.id]: mapping } };
        await api(`/admin/api/org-config/${p.org_id}`, { method: "PUT", body: { config: next } });
        close(); toast("Mapping saved");
      }, ""))), { wide: true });
}

// ── EDI messages ──────────────────────────────────────────────────────────────

async function viewMessages() {
  const filters = { direction: "", status: "", set: "", org_id: "" };
  const wrap = h("div", {});
  const sel = (name, options) => h("select", { onchange: (e) => { filters[name] = e.target.value; load(); } },
    options.map(([v, l]) => h("option", { value: v }, l)));
  const orgFilter = orgSelect("", { onchange: (e) => { filters.org_id = e.target.value; load(); } });
  orgFilter.prepend(h("option", { value: "", selected: "" }, "All orgs"));

  const listWrap = h("div", {});
  const unackWrap = h("div", {});

  async function load() {
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    const { messages } = await api(`/admin/api/messages?${params}`);
    listWrap.replaceChildren(table(["When", "Dir", "Set", "Control #", "Partner", "Status", "Error"],
      messages.map((m) => h("tr", { class: "clickable", onclick: () => showMessage(m.id) },
        h("td", {}, fmtDate(m.created_at)),
        h("td", {}, m.direction),
        h("td", {}, badge(m.transaction_set)),
        h("td", { class: "muted" }, m.control_number || "—"),
        h("td", {}, m.partner?.name || "—"),
        h("td", {}, badge(m.status)),
        h("td", { class: "muted" }, m.error ? m.error.slice(0, 80) : ""))),
      "No messages match."));
    const un = await api("/admin/edi/unacknowledged");
    unackWrap.replaceChildren(
      h("h2", {}, `Awaiting partner 997 (${un.count})`),
      table(["Sent", "Set", "Control #", "Org"],
        un.messages.map((m) => h("tr", { class: "clickable", onclick: () => showMessage(m.id) },
          h("td", {}, fmtDate(m.created_at)), h("td", {}, badge(m.transaction_set)),
          h("td", {}, m.control_number || "—"), h("td", {}, orgName(m.org_id)))),
        "Everything acknowledged."));
  }

  async function showMessage(id) {
    const { message: m } = await api(`/admin/api/messages/${id}`);
    const { close } = modal(`${m.direction} ${m.transaction_set} — ${m.status}`, h("div", {},
      h("dl", { class: "kv" },
        h("dt", {}, "Org"), h("dd", {}, orgName(m.org_id)),
        h("dt", {}, "Control #"), h("dd", {}, m.control_number || "—"),
        h("dt", {}, "Created"), h("dd", {}, fmtDate(m.created_at)),
        h("dt", {}, "Processed"), h("dd", {}, fmtDate(m.processed_at)),
        h("dt", {}, "Related order"), h("dd", {}, m.related_order_id || "—"),
        h("dt", {}, "Error"), h("dd", {}, m.error || "—")),
      h("pre", { class: "code" }, m.raw),
      h("div", { class: "actions" },
        m.direction === "inbound" && m.status === "error"
          ? actionBtn("Reprocess now", async () => {
              const res = await api(`/admin/edi/retry/${m.id}`, { method: "POST" });
              toast(res.ok ? "Reprocessed successfully" : `Still failing: ${res.error}`, !res.ok);
              close(); load();
            }, "")
          : null,
        h("button", { class: "secondary", onclick: () => close() }, "Close"))), { wide: true });
  }

  wrap.append(
    h("h1", {}, "EDI Messages"),
    h("p", { class: "sub" }, "Full in/out ledger. Click a row for the raw X12; failed inbound messages can be reprocessed after a fix."),
    h("div", { class: "toolbar" },
      orgFilter,
      sel("direction", [["", "All directions"], ["inbound", "Inbound"], ["outbound", "Outbound"]]),
      sel("status", [["", "All statuses"], ["received", "received"], ["processed", "processed"], ["generated", "generated"], ["sent", "sent"], ["error", "error"]]),
      sel("set", [["", "All sets"], ["850", "850"], ["855", "855"], ["856", "856"], ["810", "810"], ["997", "997"]])),
    listWrap, unackWrap);
  await load();
  return wrap;
}

// ── File endpoints ────────────────────────────────────────────────────────────

async function viewEndpoints() {
  const { endpoints } = await api("/admin/api/endpoints");
  const rows = endpoints.map((ep) => h("tr", {},
    h("td", {}, ep.name,
      h("div", { class: "muted" }, ep.kind === "sftp"
        ? `${ep.config.username || "?"}@${ep.config.host || "?"}:${ep.config.remote_path || "/"}`
        : ep.config.url || "")),
    h("td", {}, ep.org?.name || orgName(ep.org_id)),
    h("td", {}, badge(ep.kind), " ", badge(ep.file_type)),
    h("td", {}, badge(ep.is_active ? "active" : "inactive")),
    h("td", {}, fmtDate(ep.last_polled_at),
      ep.last_error ? h("div", { class: "muted", style: "color:var(--err)" }, ep.last_error.slice(0, 90)) : null),
    h("td", {},
      actionBtn("Poll now", async () => {
        const res = await api(`/admin/poll/${ep.id}`, { method: "POST" });
        toast(`Polled: ${res.filesSeen} file(s), ${res.recordsProcessed} record(s)${res.errors.length ? ` — ${res.errors.length} error(s)` : ""}`, res.status !== "success");
        route();
      }), " ",
      actionBtn("Retry queue", () => showRetryQueue(ep)), " ",
      actionBtn("Edit", () => editEndpoint(ep)), " ",
      actionBtn(ep.is_active ? "Disable" : "Enable", async () => {
        await api(`/admin/api/endpoints/${ep.id}`, { method: "PATCH", body: { is_active: !ep.is_active } });
        toast("Endpoint updated"); route();
      }, ep.is_active ? "danger small" : "secondary small"))));
  return h("div", {},
    h("h1", {}, "File Endpoints"),
    h("p", { class: "sub" }, "SFTP/HTTPS sources polled on the cron schedule. Failures retry with backoff, then dead-letter."),
    h("div", { class: "toolbar" }, h("div", { class: "spacer" }), h("button", { onclick: () => editEndpoint(null) }, "+ New endpoint")),
    table(["Name", "Org", "Kind / type", "Status", "Last poll", ""], rows, "No file endpoints yet."));
}

function editEndpoint(ep) {
  const cfg = ep?.config || {};
  const org = orgSelect(ep?.org_id);
  const name = h("input", { value: ep?.name || "" });
  const kind = h("select", {}, ["sftp", "https"].map((k) => {
    const o = h("option", { value: k }, k.toUpperCase());
    if ((ep?.kind || "sftp") === k) o.selected = true;
    return o;
  }));
  const fileType = h("select", {}, ["auto", "edi", "csv_inventory", "csv_prices"].map((t) => {
    const o = h("option", { value: t }, t);
    if ((ep?.file_type || "auto") === t) o.selected = true;
    return o;
  }));
  const sftpFields = {
    host: h("input", { value: cfg.host || "" }), port: h("input", { type: "number", value: cfg.port || "22" }),
    username: h("input", { value: cfg.username || "" }),
    password: h("input", { type: "password", value: cfg.password || "", placeholder: "unchanged if •••" }),
    remote_path: h("input", { value: cfg.remote_path || "/" }),
  };
  const httpsFields = {
    url: h("input", { value: cfg.url || "", placeholder: "https://vendor.example.com/inventory.csv" }),
    auth_header: h("input", { value: cfg.auth_header || "", placeholder: "Bearer … (optional)" }),
  };
  const mapping = jsonArea(cfg.mapping, 8);
  const retry = jsonArea(cfg.retry, 4);
  const sftpBlock = h("div", {},
    h("div", { class: "row" }, field("Host", sftpFields.host), field("Port", sftpFields.port)),
    h("div", { class: "row" }, field("Username", sftpFields.username), field("Password", sftpFields.password)),
    field("Remote path", sftpFields.remote_path));
  const httpsBlock = h("div", {}, field("URL", httpsFields.url), field("Auth header", httpsFields.auth_header));
  const conn = h("div", {}, kind.value === "https" ? httpsBlock : sftpBlock);
  kind.addEventListener("change", () => conn.replaceChildren(kind.value === "https" ? httpsBlock : sftpBlock));

  const { close } = modal(ep ? `Edit ${ep.name}` : "New file endpoint", h("div", {},
    h("div", { class: "row" }, field("Organization", org), field("Name", name)),
    h("div", { class: "row" }, field("Kind", kind), field("File type", fileType)),
    conn,
    field("Mapping profile (JSON, optional)", mapping,
      'Column overrides, sku_xref, multipliers — or a dynamic "target" routing rows into any table (dotted fields merge into jsonb).'),
    field("Retry policy (JSON, optional)", retry, "{max_retries, base_backoff_minutes, max_backoff_minutes} — defaults 5 / 15 / 1440."),
    h("div", { class: "actions" },
      h("button", { class: "secondary", onclick: () => close() }, "Cancel"),
      actionBtn("Save", async () => {
        const connCfg = kind.value === "sftp"
          ? { host: sftpFields.host.value.trim(), port: Number(sftpFields.port.value) || 22,
              username: sftpFields.username.value.trim(), password: sftpFields.password.value,
              remote_path: sftpFields.remote_path.value.trim() }
          : { url: httpsFields.url.value.trim(), auth_header: httpsFields.auth_header.value };
        const body = {
          org_id: org.value, name: name.value.trim(), kind: kind.value, file_type: fileType.value,
          config: { ...connCfg, mapping: readJson(mapping, "mapping"), retry: readJson(retry, "retry") },
        };
        if (body.config.mapping === undefined) delete body.config.mapping;
        if (body.config.retry === undefined) delete body.config.retry;
        if (ep) await api(`/admin/api/endpoints/${ep.id}`, { method: "PATCH", body });
        else await api("/admin/api/endpoints", { method: "POST", body });
        close(); toast("Endpoint saved"); route();
      }, ""))), { wide: true });
}

async function showRetryQueue(ep) {
  const res = await api(`/admin/retry/${ep.id}`);
  const entries = Object.entries(res.retry_state);
  const content = h("div", {},
    h("h2", {}, "Backing off"),
    table(["File", "Attempts", "Next try", "Last error", ""],
      entries.map(([key, e]) => h("tr", {},
        h("td", {}, key), h("td", {}, String(e.attempts)), h("td", {}, fmtDate(e.next_at)),
        h("td", { class: "muted" }, e.last_error),
        h("td", {}, actionBtn("Requeue", async () => {
          await api(`/admin/requeue/${ep.id}`, { method: "POST", body: { key } });
          toast("Requeued"); close(); showRetryQueue(ep);
        })))),
      "Nothing backing off."),
    h("h2", {}, "Dead letter"),
    table(["File", ""],
      res.dead_letter.map((key) => h("tr", {},
        h("td", {}, key),
        h("td", {}, actionBtn("Requeue", async () => {
          await api(`/admin/requeue/${ep.id}`, { method: "POST", body: { key } });
          toast("Requeued"); close(); showRetryQueue(ep);
        })))),
      "Dead-letter queue is empty."),
    h("div", { class: "actions" }, h("button", { class: "secondary", onclick: () => close() }, "Close")));
  const { close } = modal(`Retry queue — ${ep.name}`, content, { wide: true });
}

// ── Hub connection ────────────────────────────────────────────────────────────

async function viewHub() {
  const { connections } = await api("/admin/api/hub-connections");
  const rows = connections.map((c) => h("tr", {},
    h("td", {}, c.name, h("div", { class: "muted" }, c.hub_url)),
    h("td", {}, orgName(c.org_id)),
    h("td", {}, badge(c.is_active ? "active" : "inactive")),
    h("td", {}, c.last_ok_at ? h("span", {}, badge("ok"), " ", fmtDate(c.last_ok_at)) : h("span", { class: "muted" }, "never"),
      c.last_error ? h("div", { class: "muted", style: "color:var(--err)" }, c.last_error.slice(0, 90)) : null),
    h("td", {},
      actionBtn("Test", async () => {
        const r = await api(`/admin/hub/test/${c.org_id}`, { method: "POST" });
        toast(r.ok ? `Connected — hub returned ${r.products} product(s)` : `Failed: ${r.error}`, !r.ok);
        route();
      }), " ",
      actionBtn("Sync catalog", async () => {
        const r = await api(`/admin/hub/sync-catalog/${c.org_id}`, { method: "POST" });
        toast(r.ok ? `Catalog synced: ${r.synced} product(s)` : `Failed: ${r.error}`, !r.ok);
      }), " ",
      actionBtn("Edit", () => editHubConnection(c)), " ",
      actionBtn(c.is_active ? "Disable" : "Enable", async () => {
        await api(`/admin/api/hub-connections/${c.id}`, { method: "PATCH", body: { is_active: !c.is_active } });
        toast("Connection updated"); route();
      }, c.is_active ? "danger small" : "secondary small"))));

  const deliveriesWrap = h("div", {});
  async function loadDeliveries() {
    const { deliveries } = await api("/admin/api/deliveries?limit=50");
    deliveriesWrap.replaceChildren(
      h("h2", {}, "Delivery outbox"),
      h("p", { class: "sub" }, "Domain payloads bound for the hub. Unsupported = the hub's API doesn't accept that resource yet; kept for replay."),
      h("div", { class: "toolbar" },
        actionBtn("Process outbox now", async () => {
          const r = await api("/admin/hub/outbox/process", { method: "POST" });
          toast(`Outbox: ${JSON.stringify(r.outcomes)}`); loadDeliveries();
        }, "")),
      table(["When", "Org", "Resource", "Status", "Attempts", "Last error", ""],
        deliveries.map((d) => h("tr", {},
          h("td", {}, fmtDate(d.created_at)),
          h("td", {}, orgName(d.org_id)),
          h("td", {}, badge(d.resource)),
          h("td", {}, h("span", { class: `badge ${d.status === "delivered" ? "ok" : d.status === "pending" ? "info" : d.status === "unsupported" ? "warn" : "err"}` }, d.status)),
          h("td", {}, String(d.attempts)),
          h("td", { class: "muted" }, d.last_error ? d.last_error.slice(0, 70) : ""),
          h("td", {}, d.status !== "delivered"
            ? actionBtn("Retry", async () => {
                await api(`/admin/hub/deliveries/${d.id}/retry`, { method: "POST" });
                toast("Retried"); loadDeliveries();
              })
            : null))),
        "Outbox is empty."));
  }
  await loadDeliveries();

  return h("div", {},
    h("h1", {}, "Hub Connection"),
    h("p", { class: "sub" }, "The middleware's only line to the hub app: its public API, using a hub-issued key the hub can scope and revoke. No shared database."),
    h("div", { class: "toolbar" }, h("div", { class: "spacer" }), h("button", { onclick: () => editHubConnection(null) }, "+ New connection")),
    table(["Connection", "Org", "Status", "Last contact", ""], rows, "No hub connection configured — routes run in local mode."),
    deliveriesWrap);
}

function editHubConnection(c) {
  const org = orgSelect(c?.org_id);
  const name = h("input", { value: c?.name || "tread-sync-hub" });
  const url = h("input", { value: c?.hub_url || "", placeholder: "https://<hub-project>.supabase.co" });
  const anonKey = h("input", { type: "password", placeholder: c ? "unchanged" : "hub anon key" });
  const apiKey = h("input", { type: "password", placeholder: c ? "unchanged" : "hub-issued API key (trk_live_…)" });
  const { close } = modal(c ? "Edit hub connection" : "New hub connection", h("div", {},
    h("div", { class: "row" }, field("Organization", org), field("Name", name)),
    field("Hub URL", url),
    field("Hub anon key", anonKey, "PostgREST apikey header — public key of the hub project."),
    field("Hub API key", apiKey, "Issued by the hub (api_clients): scoped, rate-limited, revocable."),
    h("div", { class: "actions" },
      h("button", { class: "secondary", onclick: () => close() }, "Cancel"),
      actionBtn("Save", async () => {
        if (c) {
          await api(`/admin/api/hub-connections/${c.id}`, { method: "PATCH", body: {
            name: name.value.trim(), hub_url: url.value.trim(), anon_key: anonKey.value, api_key: apiKey.value,
          }});
        } else {
          await api("/admin/api/hub-connections", { method: "POST", body: {
            org_id: org.value, name: name.value.trim(), hub_url: url.value.trim(),
            anon_key: anonKey.value, api_key: apiKey.value,
          }});
        }
        close(); toast("Connection saved"); route();
      }, ""))));
}

// ── Preview / dry-run ─────────────────────────────────────────────────────────

async function viewPreview() {
  const org = orgSelect();
  const fileType = h("select", {}, ["auto", "edi", "csv_inventory", "csv_prices"].map((t) => h("option", { value: t }, t)));
  const content = h("textarea", { class: "code", rows: 10, style: "width:100%", placeholder: "Paste an X12 interchange or CSV sample…" });
  const mapping = jsonArea(undefined, 5);
  mapping.placeholder = '{"sku_column": "PartNo", "target": {…}} — optional trial CSV mapping';
  const ediMapping = jsonArea(undefined, 4);
  ediMapping.placeholder = '{"sku_xref": {"VENDOR-ABC": "MY-SKU"}} — optional trial EDI mapping';
  const result = h("div", {});

  const { endpoints } = await api("/admin/api/endpoints");
  const epSel = h("select", {}, endpoints.map((e) => h("option", { value: e.id }, e.name)));

  return h("div", {},
    h("h1", {}, "Preview / Dry-run"),
    h("p", { class: "sub" }, "Validate content and trial mappings with zero writes — nothing is ingested or marked processed."),
    h("div", { class: "row" }, field("Organization", org), field("Declared file type", fileType)),
    field("Content", content),
    h("div", { class: "row" }, field("Trial CSV mapping (JSON)", mapping), field("Trial EDI mapping (JSON)", ediMapping)),
    h("div", { class: "toolbar", style: "margin-top:14px" },
      actionBtn("Run dry-run parse", async () => {
        const body = { content: content.value, file_type: fileType.value, org_id: org.value };
        const m = readJson(mapping, "CSV mapping"); if (m) body.mapping = m;
        const em = readJson(ediMapping, "EDI mapping"); if (em) body.edi_mapping = em;
        const res = await api("/admin/preview/parse", { method: "POST", body });
        result.replaceChildren(h("h2", {}, `Result — ${res.classification || "unclassified"}`),
          h("pre", { class: "code" }, JSON.stringify(res, null, 2)));
      }, ""),
      h("div", { class: "spacer" }),
      epSel,
      actionBtn("Fetch samples from endpoint", async () => {
        const res = await api(`/admin/preview/fetch/${epSel.value}`, { method: "POST" });
        result.replaceChildren(h("h2", {}, `Files on ${res.endpoint.name}`),
          table(["Name", "Size", "Classified as", "Sample"],
            res.files.map((f) => h("tr", {},
              h("td", {}, f.name), h("td", {}, String(f.size)),
              h("td", {}, f.classification ? badge(f.classification) : h("span", { class: "badge err" }, f.classify_error || "?")),
              h("td", {}, h("pre", { class: "code", style: "max-height:120px" }, f.sample.slice(0, 400))))),
            "No files at the endpoint."));
      })),
    result);
}

// ── Org settings ──────────────────────────────────────────────────────────────

async function viewSettings() {
  const org = orgSelect();
  const body = h("div", {});
  async function load() {
    const { config } = await api(`/admin/api/org-config/${org.value}`);
    const rules = jsonArea(config.stock_status_rules, 8);
    const exposed = jsonArea(config.exposed_objects, 12);
    const ediMaps = jsonArea(config.edi_mappings, 8);
    body.replaceChildren(
      field("Stock status rules", rules, '{"thresholds":[{"max":0,"status":"backorder"},{"max":8,"status":"low_stock"}],"fallback":"in_stock"} — used by /v1/inventory and CSV ingestion.'),
      field("Exposed dynamic objects", exposed, 'Declares GET/POST /v1/objects/:key resources: {"stock": {"table":"products","scope":"products:read","select":"sku,stock_qty","writable_fields":["stock_qty"],"match_field":"sku","write_scope":"inventory:write"}}'),
      field("EDI mappings (per partner id)", ediMaps, "Usually edited from the Partners page; raw view here."),
      h("div", { class: "toolbar", style: "margin-top:16px" },
        actionBtn("Save settings", async () => {
          const { config: current } = await api(`/admin/api/org-config/${org.value}`);
          const next = { ...current };
          const r = readJson(rules, "stock_status_rules"); if (r !== undefined) next.stock_status_rules = r; else delete next.stock_status_rules;
          const e = readJson(exposed, "exposed_objects"); if (e !== undefined) next.exposed_objects = e; else delete next.exposed_objects;
          const m = readJson(ediMaps, "edi_mappings"); if (m !== undefined) next.edi_mappings = m; else delete next.edi_mappings;
          await api(`/admin/api/org-config/${org.value}`, { method: "PUT", body: { config: next } });
          toast("Settings saved");
        }, "")));
  }
  org.addEventListener("change", load);
  await load();
  return h("div", {},
    h("h1", {}, "Org Settings"),
    h("p", { class: "sub" }, "Per-org gateway configuration, stored in the org's gateway config row — no deploy needed."),
    field("Organization", org),
    body);
}

// ── Logs & runs ───────────────────────────────────────────────────────────────

async function viewLogs() {
  const wrap = h("div", {});
  const content = h("div", {});
  let tab = "logs";
  const tabs = h("div", { class: "tabs" },
    h("button", { class: "active", onclick: (e) => switchTab("logs", e.target) }, "API request log"),
    h("button", { onclick: (e) => switchTab("runs", e.target) }, "Integration runs"));
  async function switchTab(t, btn) {
    tab = t;
    tabs.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    await load();
  }
  async function load() {
    if (tab === "logs") {
      const { logs } = await api("/admin/api/logs?limit=100");
      content.replaceChildren(table(["When", "Client", "Resource", "Status", "ms", "Error"],
        logs.map((l) => h("tr", {},
          h("td", {}, fmtDate(l.created_at)),
          h("td", {}, l.client?.name || h("span", { class: "muted" }, "—")),
          h("td", {}, l.resource),
          h("td", {}, h("span", { class: `badge ${l.status < 400 ? "ok" : l.status === 429 ? "warn" : "err"}` }, String(l.status))),
          h("td", {}, l.duration_ms === null ? "—" : String(l.duration_ms)),
          h("td", { class: "muted" }, l.error || ""))),
        "No requests logged yet."));
    } else {
      const { runs } = await api("/admin/api/runs?limit=100");
      content.replaceChildren(table(["Started", "Org", "Capability", "Status", "Records", "Detail"],
        runs.map((r) => h("tr", {},
          h("td", {}, fmtDate(r.started_at)),
          h("td", {}, r.org?.name || orgName(r.org_id)),
          h("td", {}, r.capability),
          h("td", {}, badge(r.status)),
          h("td", {}, String(r.records_processed)),
          h("td", { class: "muted" }, r.detail || ""))),
        "No runs yet."));
    }
  }
  wrap.append(
    h("h1", {}, "Logs & Runs"),
    h("p", { class: "sub" }, "Every authenticated API request and every file-poll outcome."),
    tabs, content);
  await load();
  return wrap;
}

// ── boot ──────────────────────────────────────────────────────────────────────

route();

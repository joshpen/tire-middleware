/* Tread Ready embeddable portal widget core.
 * Host pages include /embed/<flow>.js which sets window.__TR_FLOW and loads
 * this file. Usage:
 *   <div data-tread-ready-widget="quote" data-dealer-slug="..." data-portal-key="pk_portal_dealer_...."></div>
 *   <script src="https://gateway.example.com/embed/quote.js"></script>
 * The widget only performs portal-safe reads and request submissions.
 */
(function () {
  "use strict";
  var scriptEl = document.currentScript;
  var BASE = (window.__TR_BASE__ || (scriptEl && new URL(scriptEl.src).origin)) + "/api/portal/v1";
  var EMBED_BASE = window.__TR_BASE__ || (scriptEl && new URL(scriptEl.src).origin);

  var FLOWS = {
    quote: {
      title: "Request a quote",
      endpoint: "quote-requests",
      startEvent: "quote_started",
      submitEvent: "quote_submitted",
      fields: [
        ["customer_name", "Your name", "text", true],
        ["customer_email", "Email", "email", false],
        ["customer_phone", "Phone", "tel", false],
        ["tire_size", "Tire size (e.g. 265/70R17)", "text", false],
        ["vehicle", "Vehicle or equipment", "text", false],
        ["quantity", "Quantity", "number", false],
        ["notes", "Anything else?", "textarea", false],
      ],
    },
    booking: {
      title: "Book service",
      endpoint: "appointments",
      startEvent: "booking_started",
      submitEvent: "booking_submitted",
      fields: [
        ["customer_name", "Your name", "text", true],
        ["customer_email", "Email", "email", false],
        ["customer_phone", "Phone", "tel", false],
        ["service_type", "Service needed", "text", true],
        ["preferred_date", "Preferred date", "date", false],
        ["preferred_time_window", "Preferred time", "text", false],
        ["vehicle", "Vehicle", "text", false],
        ["notes", "Notes", "textarea", false],
      ],
    },
    warranty: {
      title: "Start a warranty claim",
      endpoint: "warranty-intake",
      startEvent: "warranty_started",
      submitEvent: "warranty_submitted",
      fields: [
        ["customer_name", "Your name", "text", true],
        ["customer_email", "Email", "email", false],
        ["customer_phone", "Phone", "tel", false],
        ["tire_info", "Tire (brand, model, size)", "text", true],
        ["dot_number", "DOT number (sidewall)", "text", false],
        ["tread_depth_32nds", "Tread depth (32nds)", "number", false],
        ["issue_description", "Describe the issue", "textarea", true],
      ],
    },
    fleet: {
      title: "Fleet service inquiry",
      endpoint: "fleet-inquiries",
      startEvent: "fleet_inquiry_submitted",
      submitEvent: "fleet_inquiry_submitted",
      fields: [
        ["business_name", "Business name", "text", true],
        ["contact_person", "Contact person", "text", true],
        ["customer_email", "Email", "email", false],
        ["customer_phone", "Phone", "tel", false],
        ["fleet_size", "Fleet size", "number", false],
        ["vehicle_types", "Vehicle / equipment types", "text", false],
        ["service_needs", "Service needs", "textarea", false],
      ],
    },
  };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "style") node.setAttribute("style", attrs[k]);
      else if (k.indexOf("on") === 0) node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function api(slug, key, path, opts) {
    return fetch(BASE + "/dealers/" + encodeURIComponent(slug) + path, {
      method: (opts && opts.method) || "GET",
      headers: { "X-Portal-Key": key, "Content-Type": "application/json", "X-Portal-Source": "embed" },
      body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok || data.ok === false) throw new Error(data.error || "Something went wrong");
        return data;
      });
    });
  }

  function track(slug, key, name, module) {
    api(slug, key, "/events", { method: "POST", body: { event_name: name, module: module } }).catch(function () {});
  }

  function mount(container) {
    var flowName = container.getAttribute("data-tread-ready-widget") || window.__TR_FLOW || "quote";
    var flow = FLOWS[flowName];
    var slug = container.getAttribute("data-dealer-slug");
    var key = container.getAttribute("data-portal-key");
    if (!flow || !slug || !key) return;

    api(slug, key, "/brand")
      .then(function (res) {
        render(container, flow, flowName, slug, key, res.brand || {});
        track(slug, key, "widget_loaded", flowName);
      })
      .catch(function (err) {
        container.appendChild(el("p", { style: "color:#b91c1c;font-family:sans-serif;font-size:14px" }, [
          "This form is unavailable right now. (" + err.message + ")",
        ]));
      });
  }

  function render(container, flow, flowName, slug, key, brand) {
    var accent = brand.accent_color || "#2563eb";
    var box = "font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:440px;border:1px solid #e5e7eb;border-radius:12px;padding:20px;background:#fff;color:#111827";
    var inputStyle = "width:100%;box-sizing:border-box;padding:9px 10px;margin:4px 0 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px";
    var form = el("form", { style: box }, []);
    if (brand.logo_url) form.appendChild(el("img", { src: brand.logo_url, alt: "", style: "max-height:40px;margin-bottom:10px" }));
    form.appendChild(el("h3", { style: "margin:0 0 12px;font-size:17px;color:" + (brand.primary_color || "#111827") }, [flow.title]));

    var started = false;
    flow.fields.forEach(function (f) {
      var name = f[0], label = f[1], type = f[2], required = f[3];
      form.appendChild(el("label", { style: "font-size:12px;font-weight:600;color:#374151" }, [label + (required ? " *" : "")]));
      var input = type === "textarea"
        ? el("textarea", { name: name, rows: 3, style: inputStyle })
        : el("input", { name: name, type: type, style: inputStyle });
      if (required) input.setAttribute("required", "");
      input.addEventListener("focus", function () {
        if (!started) { started = true; track(slug, key, flow.startEvent, flowName); }
      });
      form.appendChild(input);
    });

    var status = el("p", { style: "font-size:13px;margin:0 0 8px;display:none" }, []);
    var button = el("button", {
      type: "submit",
      style: "width:100%;padding:11px;border:none;border-radius:8px;font-size:15px;font-weight:600;color:#fff;cursor:pointer;background:" + accent,
    }, ["Submit"]);
    form.appendChild(status);
    form.appendChild(button);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var payload = {};
      new FormData(form).forEach(function (v, k) { if (v !== "") payload[k] = v; });
      button.disabled = true;
      button.textContent = "Sending…";
      api(slug, key, "/" + flow.endpoint, { method: "POST", body: payload })
        .then(function () {
          track(slug, key, flow.submitEvent, flowName);
          form.innerHTML = "";
          form.appendChild(el("h3", { style: "margin:0;font-size:16px;color:" + accent }, ["Thanks — request received!"]));
          form.appendChild(el("p", { style: "font-size:14px;color:#374151" }, ["The team will follow up with you shortly."]));
        })
        .catch(function (err) {
          status.setAttribute("style", "font-size:13px;margin:0 0 8px;color:#b91c1c");
          status.textContent = err.message;
          button.disabled = false;
          button.textContent = "Submit";
        });
    });

    container.appendChild(form);
  }

  function boot() {
    var nodes = document.querySelectorAll("[data-tread-ready-widget]:not([data-tr-mounted])");
    nodes.forEach(function (node) {
      node.setAttribute("data-tr-mounted", "1");
      mount(node);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

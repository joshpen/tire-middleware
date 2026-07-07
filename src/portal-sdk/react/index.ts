/**
 * React components for the Tread Ready portal — package-ready without a React
 * dependency in this repo. The host app injects its own React instance:
 *
 *   import React from "react";
 *   import { createTreadReadyComponents } from "tread-ready-portal-sdk/react";
 *   const { TreadReadyQuoteForm } = createTreadReadyComponents(React);
 *   <TreadReadyQuoteForm dealerSlug="metro-tire" portalKey="pk_portal_dealer_…" baseUrl="https://…" />
 *
 * Each form component wraps the same embeddable widget flows: it loads the
 * dealer brand, renders the flow's fields, submits via the portal client, and
 * shows success/error states. Portal-safe only — no internal data.
 */
import { createTreadReadyPortalClient, type PortalClientConfig } from "../client/index.js";

/* Minimal structural type for the injected React instance. */
interface ReactLike {
  createElement: (type: unknown, props?: unknown, ...children: unknown[]) => unknown;
  useState: <T>(initial: T) => [T, (v: T) => void];
  useEffect: (fn: () => void, deps?: unknown[]) => void;
}

export interface PortalFormProps {
  dealerSlug: string;
  portalKey: string;
  baseUrl: string;
  onSubmitted?: (result: unknown) => void;
}

type Flow = {
  title: string;
  submit: (client: ReturnType<typeof createTreadReadyPortalClient>, payload: Record<string, unknown>) => Promise<unknown>;
  fields: [name: string, label: string, type: string, required: boolean][];
};

const FLOWS: Record<string, Flow> = {
  quote: {
    title: "Request a quote",
    submit: (c, p) => c.createQuoteRequest(p),
    fields: [
      ["customer_name", "Your name", "text", true],
      ["customer_email", "Email", "email", false],
      ["customer_phone", "Phone", "tel", false],
      ["tire_size", "Tire size", "text", false],
      ["vehicle", "Vehicle or equipment", "text", false],
      ["quantity", "Quantity", "number", false],
      ["notes", "Notes", "textarea", false],
    ],
  },
  booking: {
    title: "Book service",
    submit: (c, p) => c.createAppointmentRequest(p),
    fields: [
      ["customer_name", "Your name", "text", true],
      ["customer_email", "Email", "email", false],
      ["customer_phone", "Phone", "tel", false],
      ["service_type", "Service needed", "text", true],
      ["preferred_date", "Preferred date", "date", false],
      ["notes", "Notes", "textarea", false],
    ],
  },
  warranty: {
    title: "Start a warranty claim",
    submit: (c, p) => c.createWarrantyIntake(p),
    fields: [
      ["customer_name", "Your name", "text", true],
      ["customer_email", "Email", "email", false],
      ["tire_info", "Tire (brand, model, size)", "text", true],
      ["dot_number", "DOT number", "text", false],
      ["issue_description", "Describe the issue", "textarea", true],
    ],
  },
  fleet: {
    title: "Fleet service inquiry",
    submit: (c, p) => c.createFleetInquiry(p),
    fields: [
      ["business_name", "Business name", "text", true],
      ["contact_person", "Contact person", "text", true],
      ["customer_email", "Email", "email", false],
      ["fleet_size", "Fleet size", "number", false],
      ["service_needs", "Service needs", "textarea", false],
    ],
  },
};

export function createTreadReadyComponents(React: ReactLike) {
  const h = React.createElement;

  function makeForm(flowName: string) {
    return function PortalForm(props: PortalFormProps) {
      const flow = FLOWS[flowName]!;
      const [values, setValues] = React.useState<Record<string, unknown>>({});
      const [state, setState] = React.useState<{ phase: string; error?: string }>({ phase: "idle" });

      const submit = (e: { preventDefault(): void }) => {
        e.preventDefault();
        setState({ phase: "sending" });
        const client = createTreadReadyPortalClient(props as PortalClientConfig);
        flow
          .submit(client, values)
          .then((result) => {
            setState({ phase: "done" });
            props.onSubmitted?.(result);
          })
          .catch((err: Error) => setState({ phase: "error", error: err.message }));
      };

      if (state.phase === "done") {
        return h("div", { className: "tr-portal-success" }, "Thanks — request received!");
      }
      return h(
        "form",
        { className: `tr-portal-form tr-portal-${flowName}`, onSubmit: submit },
        h("h3", null, flow.title),
        ...flow.fields.map(([name, label, type, required]) =>
          h(
            "label",
            { key: name },
            label,
            h(type === "textarea" ? "textarea" : "input", {
              name,
              type,
              required,
              onChange: (e: { target: { value: string } }) => setValues({ ...values, [name]: e.target.value }),
            }),
          ),
        ),
        state.phase === "error" ? h("p", { className: "tr-portal-error" }, state.error) : null,
        h("button", { type: "submit", disabled: state.phase === "sending" }, state.phase === "sending" ? "Sending…" : "Submit"),
      );
    };
  }

  function TreadReadyDealerServices(props: PortalFormProps) {
    const [services, setServices] = React.useState<unknown[]>([]);
    React.useEffect(() => {
      createTreadReadyPortalClient(props as PortalClientConfig).getServices().then(setServices, () => setServices([]));
    }, [props.dealerSlug]);
    return h(
      "ul",
      { className: "tr-portal-services" },
      ...services.map((s, i) => h("li", { key: i }, typeof s === "string" ? s : (s as { label?: string }).label ?? "")),
    );
  }

  return {
    TreadReadyQuoteForm: makeForm("quote"),
    TreadReadyBookingForm: makeForm("booking"),
    TreadReadyWarrantyStart: makeForm("warranty"),
    TreadReadyFleetInquiry: makeForm("fleet"),
    TreadReadyDealerServices,
  };
}

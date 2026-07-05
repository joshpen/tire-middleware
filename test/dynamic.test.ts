import { describe, expect, it } from "vitest";
import { buildPatch, coerceValue, type IngestTarget } from "../src/dynamic.js";
import { DEFAULT_STOCK_STATUS_RULES, stockStatusFor } from "../src/domain/inventory.js";
import { parseGenericCsv } from "../src/files/csv.js";

describe("coerceValue", () => {
  it("heuristically types numbers and booleans, keeps text", () => {
    expect(coerceValue("12")).toBe(12);
    expect(coerceValue("12.5")).toBe(12.5);
    expect(coerceValue("true")).toBe(true);
    expect(coerceValue("LT245-75R17-E")).toBe("LT245-75R17-E");
  });

  it("honors explicit coercions", () => {
    expect(coerceValue("12", "string")).toBe("12");
    expect(coerceValue("$141.50", "number")).toBe(141.5);
    expect(coerceValue("yes", "boolean")).toBe(true);
    expect(coerceValue('{"a":1}', "json")).toEqual({ a: 1 });
    expect(coerceValue("not-a-number", "number")).toBeNull();
  });
});

describe("buildPatch", () => {
  const target: IngestTarget = {
    table: "dealer_inventory",
    match: { column: "sku", field: "sku" },
    set: {
      qty_on_hand: "qty",
      location: "bin",
      "field_values.tread_depth_mm": "tread",
      "field_values.dot_week": "dot",
    },
  };

  it("maps plain fields and merges dotted fields into the existing jsonb doc", () => {
    const patch = buildPatch(
      { sku: "A1", qty: "7", bin: "B-12", tread: "9.5", dot: "2325" },
      target,
      (root) => (root === "field_values" ? { existing_key: "kept" } : null),
    );
    expect(patch).toEqual({
      qty_on_hand: 7,
      location: "B-12",
      field_values: { existing_key: "kept", tread_depth_mm: 9.5, dot_week: 2325 },
    });
  });

  it("skips empty and missing columns", () => {
    const patch = buildPatch({ sku: "A1", qty: "3", bin: "" }, target, () => null);
    expect(patch).toEqual({ qty_on_hand: 3 });
  });
});

describe("stockStatusFor with rules", () => {
  it("uses default thresholds", () => {
    expect(stockStatusFor(0)).toBe("backorder");
    expect(stockStatusFor(8)).toBe("low_stock");
    expect(stockStatusFor(9)).toBe("in_stock");
  });

  it("honors org-specific rules", () => {
    const rules = {
      thresholds: [
        { max: -1, status: "oversold" },
        { max: 20, status: "reorder" },
      ],
      fallback: "healthy",
    };
    expect(stockStatusFor(-5, rules)).toBe("oversold");
    expect(stockStatusFor(0, rules)).toBe("reorder");
    expect(stockStatusFor(21, rules)).toBe("healthy");
    expect(stockStatusFor(9, DEFAULT_STOCK_STATUS_RULES)).toBe("in_stock");
  });
});

describe("parseGenericCsv", () => {
  it("returns normalized-header row objects", () => {
    const rows = parseGenericCsv("SKU,Qty On Hand,Bin Loc\nA1,7,B-12\n");
    expect(rows).toEqual([{ sku: "A1", qty_on_hand: "7", bin_loc: "B-12" }]);
  });

  it("applies the xref to the designated match column only", () => {
    const rows = parseGenericCsv(
      "sku,alias\nVENDOR-99,VENDOR-99\n",
      { sku_xref: { "vendor-99": "SMOKE-SKU-1" } },
      "sku",
    );
    expect(rows).toEqual([{ sku: "SMOKE-SKU-1", alias: "VENDOR-99" }]);
  });
});

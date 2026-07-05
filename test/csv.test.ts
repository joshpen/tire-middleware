import { describe, expect, it } from "vitest";
import { classifyContent, parseCsv, parseInventoryCsv, parsePriceCsv } from "../src/files/csv.js";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, and CRLF", () => {
    const rows = parseCsv('sku,name\r\n"A,1","says ""hi"""\r\nB2,plain\r\n');
    expect(rows).toEqual([
      ["sku", "name"],
      ["A,1", 'says "hi"'],
      ["B2", "plain"],
    ]);
  });
});

describe("parseInventoryCsv", () => {
  it("maps sku/qty columns with flexible headers", () => {
    const rows = parseInventoryCsv("SKU,Qty On Hand\nLT245-75R17-E,12\np225-60r16,0\nbad-row,\n");
    expect(rows).toEqual([
      { sku: "LT245-75R17-E", qty: 12 },
      { sku: "p225-60r16", qty: 0 },
    ]);
  });

  it("rejects CSVs without the required columns", () => {
    expect(() => parseInventoryCsv("a,b\n1,2\n")).toThrow(/sku and qty/);
  });
});

describe("parsePriceCsv", () => {
  it("maps sku/price columns and strips dollar signs", () => {
    const rows = parsePriceCsv("sku,list_price\nLT245-75R17-E,$141.50\nP225-60R16,92\n");
    expect(rows).toEqual([
      { sku: "LT245-75R17-E", price: 141.5 },
      { sku: "P225-60R16", price: 92 },
    ]);
  });
});

describe("classifyContent", () => {
  it("routes ISA content to EDI regardless of declared type", () => {
    expect(classifyContent("ISA*00*...", "csv_inventory")).toBe("edi");
    expect(classifyContent("\nISA*00*...", "auto")).toBe("edi");
  });

  it("honors the declared CSV type", () => {
    expect(classifyContent("sku,qty\nA,1\n", "csv_inventory")).toBe("csv_inventory");
    expect(classifyContent("sku,price\nA,1\n", "csv_prices")).toBe("csv_prices");
  });

  it("sniffs headers for auto endpoints", () => {
    expect(classifyContent("sku,qty_on_hand\nA,1\n", "auto")).toBe("csv_inventory");
    expect(classifyContent("sku,list_price\nA,9.99\n", "auto")).toBe("csv_prices");
    expect(() => classifyContent("a,b\n1,2\n", "auto")).toThrow(/classify/);
  });

  it("rejects non-EDI content on edi endpoints", () => {
    expect(() => classifyContent("sku,qty\nA,1\n", "edi")).toThrow(/ISA/);
  });
});

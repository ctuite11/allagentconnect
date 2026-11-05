import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOT_SHEET_CRITERIA,
  fromCriteriaPayload,
  parseHotSheetInteger,
  parseHotSheetNumber,
  toCriteriaPayload,
} from "@/lib/hotSheetCriteriaCore";

describe("parseHotSheetNumber", () => {
  it("parses comma-formatted prices", () => {
    expect(parseHotSheetNumber("500,000")).toBe(500000);
    expect(parseHotSheetNumber("1,200,000")).toBe(1200000);
  });

  it("parses unformatted prices", () => {
    expect(parseHotSheetNumber("500000")).toBe(500000);
    expect(parseHotSheetNumber("1200000")).toBe(1200000);
  });

  it("returns null for empty or invalid input", () => {
    expect(parseHotSheetNumber("")).toBeNull();
    expect(parseHotSheetNumber("abc")).toBeNull();
  });
});

describe("parseHotSheetInteger", () => {
  it("strips commas before parsing", () => {
    expect(parseHotSheetInteger("1,250")).toBe(1250);
    expect(parseHotSheetInteger("2500")).toBe(2500);
  });
});

describe("toCriteriaPayload price conversion", () => {
  it("saves comma-formatted min/max as numeric values", () => {
    const payload = toCriteriaPayload({
      ...DEFAULT_HOT_SHEET_CRITERIA,
      minPrice: "500,000",
      maxPrice: "1,200,000",
      hasNoMin: false,
      hasNoMax: false,
    });
    expect(payload.minPrice).toBe(500000);
    expect(payload.maxPrice).toBe(1200000);
  });

  it("nulls prices when No Minimum / No Maximum are set", () => {
    const payload = toCriteriaPayload({
      ...DEFAULT_HOT_SHEET_CRITERIA,
      minPrice: "500,000",
      maxPrice: "1,200,000",
      hasNoMin: true,
      hasNoMax: true,
    });
    expect(payload.minPrice).toBeNull();
    expect(payload.maxPrice).toBeNull();
  });

  it("keeps a valid range where min < max with commas", () => {
    const min = parseHotSheetNumber("500,000");
    const max = parseHotSheetNumber("1,200,000");
    expect(min).not.toBeNull();
    expect(max).not.toBeNull();
    expect(min! < max!).toBe(true);
  });

  it("round-trips saved numeric prices through fromCriteriaPayload", () => {
    const loaded = fromCriteriaPayload({
      minPrice: 500000,
      maxPrice: 1200000,
      hasNoMin: false,
      hasNoMax: false,
    });
    const resaved = toCriteriaPayload(loaded);
    expect(resaved.minPrice).toBe(500000);
    expect(resaved.maxPrice).toBe(1200000);
  });
});

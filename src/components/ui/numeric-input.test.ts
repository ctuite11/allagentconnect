import { describe, it, expect } from "vitest";
import { numericValidationMessage as v, sanitizeNumericInput as s } from "./numeric-input";

describe("NumericInput keeps the old number-field limits", () => {
  it("fiscal year 1900–2100", () => {
    expect(v("2026", "1900", "2100", undefined)).toBe("");
    expect(v("1201", "1900", "2100", undefined)).not.toBe("");
    expect(v("2101", "1900", "2100", undefined)).not.toBe("");
  });
  it("bathrooms step 0.5", () => {
    expect(v("2.5", undefined, undefined, "0.5")).toBe("");
    expect(v("2.3", undefined, undefined, "0.5")).not.toBe("");
  });
  it("units min 2, auto-activate min 1, counts min 0, implicit whole numbers", () => {
    expect(v("1", "2", undefined, undefined)).not.toBe("");
    expect(v("0", 1, undefined, undefined)).not.toBe("");
    expect(v("2", "0", undefined, undefined)).toBe("");
    expect(v("2.5", undefined, undefined, undefined)).not.toBe("");
    expect(v("", "1900", "2100", undefined)).toBe("");
  });
  it("no negatives or letters can be typed", () => {
    expect(s("-0.5", true)).toBe("0.5");
    expect(s("12a3", false)).toBe("123");
  });
});

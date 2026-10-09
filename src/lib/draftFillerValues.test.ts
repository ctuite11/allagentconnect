import { describe, it, expect } from "vitest";
import { clearDraftFiller as c } from "./draftFillerValues";

describe("clearDraftFiller", () => {
  it("blanks exact filler values on drafts", () => {
    expect(c("draft", "address", "Draft")).toBe("");
    expect(c("draft", "city", "TBD")).toBe("");
    expect(c("draft", "zip_code", "00000")).toBe("");
    expect(c("draft", "price", "0")).toBe("");
  });
  it("keeps values on non-drafts", () => {
    expect(c("active", "address", "Draft")).toBe("Draft");
    expect(c("active", "city", "TBD")).toBe("TBD");
    expect(c("active", "zip_code", "00000")).toBe("00000");
    expect(c("active", "price", "0")).toBe("0");
  });
  it("keeps real values containing filler words (exact match only)", () => {
    expect(c("draft", "address", "12 Draft Rd")).toBe("12 Draft Rd");
    expect(c("draft", "city", "TBD Village")).toBe("TBD Village");
    expect(c("draft", "zip_code", "000001")).toBe("000001");
    expect(c("draft", "address", "12 Main St")).toBe("12 Main St");
    expect(c("draft", "city", "Boston")).toBe("Boston");
    expect(c("draft", "zip_code", "02129")).toBe("02129");
    expect(c("draft", "price", "750000")).toBe("750000");
  });
});

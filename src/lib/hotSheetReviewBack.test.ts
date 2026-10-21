import { describe, it, expect } from "vitest";
import { resolveHotSheetReviewBack } from "./hotSheetReviewBack";

describe("Hot Sheet results Back follows the path used", () => {
  it("Hot Sheets → Results returns to Hot Sheets even when a buyer is linked", () => {
    const t = resolveHotSheetReviewBack({ originFrom: "/agent/hot-sheets", buyerContextClientId: "c1" });
    expect(t.path).toBe("/agent/hot-sheets");
    expect(t.label).toBe("Back to Hot Sheets");
  });

  it("Buyer dashboard → Results returns to the buyer dashboard", () => {
    const t = resolveHotSheetReviewBack({ originFrom: "/agent/buyers/c1/favorites", buyerContextClientId: "c1" });
    expect(t.path).toBe("/agent/buyers/c1");
    expect(t.label).toBe("Back to buyer");
  });

  it("Hot Sheets → Buyer list → Results returns to the buyer list, carrying Hot Sheets onward", () => {
    const t = resolveHotSheetReviewBack({
      originFrom: "/hot-sheets/buyer/c1",
      parentFrom: "/agent/hot-sheets",
      buyerContextClientId: "c1",
    });
    expect(t.path).toBe("/hot-sheets/buyer/c1");
    expect(t.state).toEqual({ from: "/agent/hot-sheets" });
  });

  it("Buyer dashboard → Buyer list → Results returns to the buyer list, carrying the dashboard onward", () => {
    const t = resolveHotSheetReviewBack({
      originFrom: "/hot-sheets/buyer/c1",
      parentFrom: "/agent/buyers/c1",
    });
    expect(t.path).toBe("/hot-sheets/buyer/c1");
    expect(t.state).toEqual({ from: "/agent/buyers/c1" });
  });
});

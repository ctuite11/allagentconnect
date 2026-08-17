import { describe, expect, it } from "vitest";
import {
  adminPublishTransitions,
  memberPublishTransitions,
  publishStatusLabel,
  slugifyDevelopmentName,
} from "./publishStatus";

describe("publishStatus", () => {
  it("labels known publish statuses", () => {
    expect(publishStatusLabel("pending_review")).toBe("Pending review");
    expect(publishStatusLabel("published")).toBe("Published");
  });

  it("limits member transitions to submit/withdraw only", () => {
    expect(memberPublishTransitions("draft")).toEqual(["pending_review"]);
    expect(memberPublishTransitions("pending_review")).toEqual(["draft"]);
    expect(memberPublishTransitions("published")).toEqual([]);
  });

  it("allows admin publish/pause/archive matrix", () => {
    expect(adminPublishTransitions("pending_review")).toEqual([
      "published",
      "draft",
      "archived",
    ]);
    expect(adminPublishTransitions("published")).toEqual(["paused", "archived"]);
  });

  it("slugifies development names", () => {
    expect(slugifyDevelopmentName("Harbor View Residences!")).toBe("harbor-view-residences");
  });
});

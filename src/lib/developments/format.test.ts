import { describe, expect, it } from "vitest";
import {
  asStringList,
  formatStartingFrom,
  formatUsd,
  lifecycleLabel,
  unitStatusLabel,
} from "@/lib/developments/format";

describe("developments format helpers", () => {
  it("formats USD and TBD", () => {
    expect(formatUsd(1250000)).toBe("$1,250,000");
    expect(formatUsd(null)).toBe("Price TBD");
    expect(formatStartingFrom(899000)).toBe("From $899,000");
    expect(formatStartingFrom(null)).toBeNull();
  });

  it("labels lifecycle and unit status vocabulary", () => {
    expect(lifecycleLabel("under_construction")).toBe("Under Construction");
    expect(unitStatusLabel("under_agreement")).toBe("Under Agreement");
    expect(unitStatusLabel("available")).toBe("Available");
  });

  it("normalizes amenity/highlight JSON arrays", () => {
    expect(asStringList([" Pool ", { label: "Gym" }, { name: " Concierge " }, 12])).toEqual([
      "Pool",
      "Gym",
      "Concierge",
    ]);
  });
});

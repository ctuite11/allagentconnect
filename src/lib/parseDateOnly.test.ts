import { describe, expect, it } from "vitest";
import { parseDateOnly } from "@/lib/utils";

describe("parseDateOnly", () => {
  it("keeps the calendar day", () => {
    const d = parseDateOnly("2026-10-15");
    expect(d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })).toBe("Thu, Oct 15, 2026");
  });
  it("returns Invalid Date for malformed or rollover input", () => {
    for (const v of ["2026-02-30", "2026-13-01", "10/15/2026", "", null, undefined]) {
      expect(Number.isNaN(parseDateOnly(v).getTime())).toBe(true);
    }
  });
});

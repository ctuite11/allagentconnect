import { describe, it, expect } from "vitest";
import { parseRecipientList, MAX_RECIPIENTS } from "./parseRecipientList";

describe("parseRecipientList", () => {
  it("splits commas, semicolons and spaces", () => {
    expect(parseRecipientList("a@x.com, b@y.com;c@z.com d@w.com").valid).toEqual([
      "a@x.com", "b@y.com", "c@z.com", "d@w.com",
    ]);
  });
  it("removes duplicates case-insensitively", () => {
    expect(parseRecipientList("A@x.com, a@x.com").valid).toEqual(["a@x.com"]);
  });
  it("reports invalid addresses", () => {
    const r = parseRecipientList("a@x.com, bad-address");
    expect(r.invalid).toEqual(["bad-address"]);
  });
  it("flags more than 25 recipients", () => {
    const list = Array.from({ length: MAX_RECIPIENTS + 1 }, (_, i) => `u${i}@x.com`).join(",");
    expect(parseRecipientList(list).tooMany).toBe(true);
    const ok = Array.from({ length: MAX_RECIPIENTS }, (_, i) => `u${i}@x.com`).join(",");
    expect(parseRecipientList(ok).tooMany).toBe(false);
  });
});

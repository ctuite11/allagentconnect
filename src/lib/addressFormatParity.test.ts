import { describe, expect, it } from "vitest";
import { buildDisplayAddress } from "./utils";
import fixtures from "../../supabase/functions/_shared/addressFormatFixtures.json";

// Same fixtures run against the email formatter in supabase/functions/_shared/addressFormatParity.test.ts
describe("web address formatter parity fixtures", () => {
  for (const f of fixtures) {
    it(f.name, () => {
      expect(buildDisplayAddress(f.input)).toBe(f.expected);
    });
  }
});

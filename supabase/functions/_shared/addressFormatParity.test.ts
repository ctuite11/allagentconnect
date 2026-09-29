import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { formatListingShareEmailFullAddress } from "./listingShareEmailAddress.ts";
import fixtures from "./addressFormatFixtures.json" with { type: "json" };

// Same fixtures run against the web formatter in src/lib/addressFormatParity.test.ts
for (const f of fixtures) {
  Deno.test(`email address formatter parity: ${f.name}`, () => {
    assertEquals(formatListingShareEmailFullAddress(f.input), f.expected);
  });
}

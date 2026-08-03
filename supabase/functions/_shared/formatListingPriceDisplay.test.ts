import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  formatListingPriceDisplay,
  formatListingPriceForShare,
} from "./formatListingPriceDisplay.ts";

Deno.test("fixed price formats as whole dollars", () => {
  assertEquals(formatListingPriceDisplay({ price: 1250000 }), "$1,250,000");
});

Deno.test("full range formats both endpoints", () => {
  assertEquals(
    formatListingPriceDisplay({ price: null, price_range_min: 1150000, price_range_max: 1250000 }),
    "$1,150,000 – $1,250,000",
  );
});

Deno.test("reversed range endpoints are normalized low to high", () => {
  assertEquals(
    formatListingPriceDisplay({ price_range_min: 1250000, price_range_max: 1150000 }),
    "$1,150,000 – $1,250,000",
  );
});

Deno.test("partial range is omitted, matching the app helper", () => {
  assertEquals(formatListingPriceDisplay({ price_range_min: 900000 }), null);
  assertEquals(formatListingPriceDisplay({ price_range_max: 900000 }), null);
});

Deno.test("zero / null / empty price never renders $0", () => {
  assertEquals(formatListingPriceDisplay({ price: 0 }), null);
  assertEquals(formatListingPriceDisplay({ price: null }), null);
  assertEquals(formatListingPriceDisplay({}), null);
  assertEquals(
    formatListingPriceDisplay({ price: 0, price_range_min: 0, price_range_max: 0 }),
    null,
  );
});

Deno.test("rental share price appends /month", () => {
  assertEquals(
    formatListingPriceForShare({ price: 3200, listing_type: "for_rent" }),
    "$3,200/month",
  );
  assertEquals(
    formatListingPriceForShare({
      price_range_min: 3000,
      price_range_max: 3500,
      listing_type: "for_rent",
    }),
    "$3,000 – $3,500/month",
  );
});

Deno.test("no price yields null for share, not $0", () => {
  assertEquals(formatListingPriceForShare({ price: 0, listing_type: "for_sale" }), null);
});

import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { formatListingPriceForShare } from "./formatListingPriceDisplay.ts";

/** Mirrors the title composition in supabase/functions/social-preview/index.ts */
function buildTitle(listing: Record<string, unknown>): string {
  const priceText = formatListingPriceForShare(listing as never);
  const addressLine = `${listing.address}, ${listing.city}, ${listing.state}`;
  return priceText ? `${priceText} · ${addressLine}` : `${addressLine} · All Agent Connect`;
}

const base = { address: "7 Cross Street", city: "Wilmington", state: "MA" };

Deno.test("title: fixed price", () => {
  assertEquals(buildTitle({ ...base, price: 1250000 }), "$1,250,000 · 7 Cross Street, Wilmington, MA");
});

Deno.test("title: both range values", () => {
  assertEquals(
    buildTitle({ ...base, price_range_min: 1150000, price_range_max: 1250000 }),
    "$1,150,000 – $1,250,000 · 7 Cross Street, Wilmington, MA",
  );
});

Deno.test("title: min only omits price segment", () => {
  assertEquals(buildTitle({ ...base, price_range_min: 900000 }), "7 Cross Street, Wilmington, MA · All Agent Connect");
});

Deno.test("title: max only omits price segment", () => {
  assertEquals(buildTitle({ ...base, price_range_max: 900000 }), "7 Cross Street, Wilmington, MA · All Agent Connect");
});

Deno.test("title: rental appends /month", () => {
  assertEquals(buildTitle({ ...base, price: 3200, listing_type: "for_rent" }), "$3,200/month · 7 Cross Street, Wilmington, MA");
});

Deno.test("title: zero or null price never renders $0", () => {
  assertEquals(buildTitle({ ...base, price: 0 }), "7 Cross Street, Wilmington, MA · All Agent Connect");
  assertEquals(buildTitle({ ...base, price: null }), "7 Cross Street, Wilmington, MA · All Agent Connect");
});

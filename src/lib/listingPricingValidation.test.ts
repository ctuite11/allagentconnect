import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formHasValidListingPricing,
  listingHasValidPricing,
  listingSatisfiesPricingRule,
} from "./listingPricingValidation.ts";

Deno.test("allows draft with no pricing", () => {
  assertEquals(
    listingSatisfiesPricingRule({
      status: "draft",
      listing_type: "for_sale",
      price: 0,
    }),
    true,
  );
});

Deno.test("blocks for-sale off_market with no price/range", () => {
  assertEquals(
    listingSatisfiesPricingRule({
      status: "off_market",
      listing_type: "for_sale",
      price: 0,
      price_range_min: null,
      price_range_max: null,
    }),
    false,
  );
});

Deno.test("blocks for-sale coming_soon / active without pricing", () => {
  assertEquals(
    listingSatisfiesPricingRule({
      status: "coming_soon",
      listing_type: "for_sale",
      price: null,
    }),
    false,
  );
  assertEquals(
    listingSatisfiesPricingRule({
      status: "active",
      listing_type: "for_sale",
      price: 0,
    }),
    false,
  );
});

Deno.test("allows valid price and valid range", () => {
  assertEquals(listingHasValidPricing({ listing_type: "for_sale", price: 500000 }), true);
  assertEquals(
    listingHasValidPricing({
      listing_type: "for_sale",
      price: 0,
      price_range_min: 400000,
      price_range_max: 450000,
    }),
    true,
  );
});

Deno.test("requires monthly rent (price) for rentals", () => {
  assertEquals(
    listingSatisfiesPricingRule({
      status: "active",
      listing_type: "for_rent",
      price: 0,
    }),
    false,
  );
  assertEquals(
    listingSatisfiesPricingRule({
      status: "active",
      listing_type: "for_rent",
      price: 3200,
    }),
    true,
  );
});

Deno.test("form helper matches sale/rent rules", () => {
  assertEquals(
    formHasValidListingPricing({
      listing_type: "for_sale",
      price: "",
      price_range_min: "100000",
      price_range_max: "200000",
    }),
    true,
  );
  assertEquals(
    formHasValidListingPricing({
      listing_type: "for_rent",
      monthly_rent: "2500",
    }),
    true,
  );
});

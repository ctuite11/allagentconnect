import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  EMPTY_PREFERENCES,
  matchesCommunicationPreferences,
  type AgentPreferences,
} from "./communicationPreferencesMatcher.ts";

const FRANK_EVENT = {
  state: "MA",
  city: "Quincy",
  price: 1_000_000,
  minPrice: 700_000,
  maxPrice: 1_000_000,
  propertyTypes: ["condo"],
};

Deno.test("all blank preferences → matches, no dimension configured", () => {
  const r = matchesCommunicationPreferences(EMPTY_PREFERENCES, FRANK_EVENT);
  assertEquals(r.matches, true);
  assertEquals(r.anyDimensionConfigured, false);
});

Deno.test("price-only band that intersects → matches", () => {
  const a: AgentPreferences = { ...EMPTY_PREFERENCES, minPrice: 100_000, maxPrice: 80_000_000 };
  const r = matchesCommunicationPreferences(a, FRANK_EVENT);
  assertEquals(r.matches, true);
  assertEquals(r.anyDimensionConfigured, true);
});

Deno.test("property-type only, event type included → matches", () => {
  const a: AgentPreferences = {
    ...EMPTY_PREFERENCES,
    propertyTypes: ["single_family", "condo", "townhouse"],
  };
  const r = matchesCommunicationPreferences(a, FRANK_EVENT);
  assertEquals(r.matches, true);
});

Deno.test("property-type only, event type not included → fails on property_type", () => {
  const a: AgentPreferences = { ...EMPTY_PREFERENCES, propertyTypes: ["single_family"] };
  const r = matchesCommunicationPreferences(a, FRANK_EVENT);
  assertEquals(r.matches, false);
  assertEquals(r.failedDimension, "property_type");
});

Deno.test("state-only geo row matches Frank's MA event", () => {
  const a: AgentPreferences = { ...EMPTY_PREFERENCES, geoRows: [{ state: "ma" }] };
  const r = matchesCommunicationPreferences(a, FRANK_EVENT);
  assertEquals(r.matches, true);
});

Deno.test("city-only geo row for a different city → fails on location", () => {
  const a: AgentPreferences = { ...EMPTY_PREFERENCES, geoRows: [{ city: "Cambridge", state: "MA" }] };
  const r = matchesCommunicationPreferences(a, FRANK_EVENT);
  assertEquals(r.matches, false);
  assertEquals(r.failedDimension, "location");
});

Deno.test("hasNoMin/hasNoMax alone do not restrict", () => {
  const a: AgentPreferences = { ...EMPTY_PREFERENCES, hasNoMin: true, hasNoMax: true };
  const r = matchesCommunicationPreferences(a, FRANK_EVENT);
  assertEquals(r.matches, true);
  assertEquals(r.anyDimensionConfigured, false);
});

Deno.test("ZIP sentinel 00000 on geo row is ignored", () => {
  const a: AgentPreferences = {
    ...EMPTY_PREFERENCES,
    geoRows: [{ state: "MA", zip_code: "00000" }],
  };
  const r = matchesCommunicationPreferences(a, FRANK_EVENT);
  assertEquals(r.matches, true);
});

Deno.test("geo + price + type all configured, all pass", () => {
  const a: AgentPreferences = {
    ...EMPTY_PREFERENCES,
    geoRows: [{ state: "MA", city: "Quincy" }],
    minPrice: 500_000,
    maxPrice: 1_500_000,
    propertyTypes: ["condo"],
  };
  const r = matchesCommunicationPreferences(a, FRANK_EVENT);
  assertEquals(r.matches, true);
});

Deno.test("case-insensitive location match", () => {
  const a: AgentPreferences = {
    ...EMPTY_PREFERENCES,
    geoRows: [{ state: "ma", city: "QUINCY" }],
  };
  const r = matchesCommunicationPreferences(a, FRANK_EVENT);
  assertEquals(r.matches, true);
});

Deno.test("event with no price info, agent has price band → passes (event can't restrict)", () => {
  const a: AgentPreferences = { ...EMPTY_PREFERENCES, minPrice: 500_000, maxPrice: 1_000_000 };
  const r = matchesCommunicationPreferences(a, { state: "MA", propertyTypes: ["condo"] });
  assertEquals(r.matches, true);
});
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { chrisCommsBroadcastMatch } from "./chrisCommsBroadcastMatch.ts";
import { EMPTY_PREFERENCES } from "./communicationPreferencesMatcher.ts";

const agent = {
  agent_id: "1fc50da1-2664-4931-8cab-64e24dc5ed8c",
  email: "chris@allagentconnect.com",
  savedPrefs: {
    ...EMPTY_PREFERENCES,
    geoRows: [{ state: "MA", city: "Boston", county: "Suffolk" }],
    minPrice: 1_000_000,
    propertyTypes: ["condo"],
  },
};
const criteria = {
  state: "MA", cities: ["Boston"], counties: [] as string[], neighborhoods: [],
  min_price: 1_000_000, max_price: 2_000_000, property_types: ["condo"],
};

Deno.test("Chris Boston MA missing county matches without mutating preferences", () => {
  const before = JSON.stringify(agent);
  assertEquals(chrisCommsBroadcastMatch(agent, criteria, false), true);
  assertEquals(JSON.stringify(agent), before);
});
Deno.test("Chris explicit Suffolk county matches", () => {
  assertEquals(chrisCommsBroadcastMatch(agent, { ...criteria, counties: ["Suffolk"] }, false), true);
});
Deno.test("Chris known Suffolk County name representation matches", () => {
  assertEquals(chrisCommsBroadcastMatch({ ...agent, savedPrefs: { ...agent.savedPrefs, geoRows: [{ state: "MA", city: "Boston", county: "Suffolk County" }] } }, { ...criteria, counties: ["Suffolk County"] }, false), true);
});
Deno.test("Chris explicit Norfolk conflict cannot be supplemented", () => {
  assertEquals(chrisCommsBroadcastMatch(agent, { ...criteria, counties: ["Norfolk"] }, false), false);
});
Deno.test("Chris mixed counties cannot be supplemented", () => {
  assertEquals(chrisCommsBroadcastMatch(agent, { ...criteria, counties: ["Suffolk", "Norfolk"] }, false), false);
});
Deno.test("Chris unknown county cannot be supplemented", () => {
  assertEquals(chrisCommsBroadcastMatch(agent, { ...criteria, counties: ["Unknown"] }, false), false);
});
Deno.test("Chris wrong town remains excluded", () => {
  assertEquals(chrisCommsBroadcastMatch(agent, { ...criteria, cities: ["Cambridge"] }, false), false);
});
Deno.test("Chris wrong state remains excluded", () => {
  assertEquals(chrisCommsBroadcastMatch(agent, { ...criteria, state: "NY" }, false), false);
});
Deno.test("Chris missing state remains excluded", () => {
  assertEquals(chrisCommsBroadcastMatch(agent, { ...criteria, state: null }, false), false);
});
Deno.test("Chris $1M minimum retained", () => {
  assertEquals(chrisCommsBroadcastMatch(agent, { ...criteria, min_price: 500_000, max_price: 999_999 }, false), false);
});
Deno.test("Chris saved maximum retained", () => {
  assertEquals(chrisCommsBroadcastMatch({ ...agent, savedPrefs: { ...agent.savedPrefs, maxPrice: 2_000_000 } }, { ...criteria, min_price: 2_000_001, max_price: 3_000_000 }, false), false);
});
Deno.test("Chris property type retained", () => {
  assertEquals(chrisCommsBroadcastMatch(agent, { ...criteria, property_types: ["land"] }, false), false);
});
Deno.test("Chris neighborhood retained without inventing association", () => {
  assertEquals(chrisCommsBroadcastMatch({ ...agent, savedPrefs: { ...agent.savedPrefs, geoRows: [{ ...agent.savedPrefs.geoRows[0], neighborhood: "Back Bay" }] } }, { ...criteria, neighborhoods: ["Back Bay"] }, false), false);
});
Deno.test("Chris ZIP retained", () => {
  assertEquals(chrisCommsBroadcastMatch({ ...agent, savedPrefs: { ...agent.savedPrefs, geoRows: [{ ...agent.savedPrefs.geoRows[0], zip_code: "02116" }] } }, criteria, false), false);
});
Deno.test("Exact account UUID required", () => {
  assertEquals(chrisCommsBroadcastMatch({ ...agent, agent_id: "another-agent" }, criteria, false), false);
});
Deno.test("Exact recipient email required", () => {
  assertEquals(chrisCommsBroadcastMatch({ ...agent, email: "other@example.com" }, criteria, false), false);
});
Deno.test("Statewide posts remain unchanged", () => {
  assertEquals(chrisCommsBroadcastMatch(agent, { ...criteria, cities: [] }, false), false);
});
Deno.test("Changed saved town cannot acquire Boston match", () => {
  assertEquals(chrisCommsBroadcastMatch({ ...agent, savedPrefs: { ...agent.savedPrefs, geoRows: [{ state: "MA", city: "Cambridge", county: "Middlesex" }] } }, criteria, false), false);
});
Deno.test("Existing positive decisions preserved including county conflict", () => {
  assertEquals(chrisCommsBroadcastMatch(agent, { ...criteria, counties: ["Norfolk"] }, true), true);
});
Deno.test("Other accounts retain both original decisions", () => {
  for (const original of [false, true]) {
    assertEquals(chrisCommsBroadcastMatch({ ...agent, agent_id: "other-agent" }, criteria, original), original);
  }
});
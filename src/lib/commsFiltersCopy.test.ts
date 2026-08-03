import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  COMMS_FILTERS_ROUTE,
  COMMS_FILTERS_SECTION_QUERY,
  COMMS_FILTERS_UI,
} from "./commsFiltersCopy.ts";

Deno.test("Comms Filters route deep-links to filters section", () => {
  assertEquals(COMMS_FILTERS_SECTION_QUERY, "section=filters");
  assertEquals(COMMS_FILTERS_ROUTE, "/communications?section=filters");
});

Deno.test("Comms UI labels use Filters not Preferences for targeting copy", () => {
  assertEquals(COMMS_FILTERS_UI.setFilters, "Set Filters");
  assertEquals(COMMS_FILTERS_UI.setFiltersNow, "Set Filters Now");
  assertEquals(COMMS_FILTERS_UI.saveFilters, "Save Filters");
  assertEquals(COMMS_FILTERS_UI.savedToast, "Filters saved successfully");
  assertStringIncludes(COMMS_FILTERS_UI.dialogTitle, "filters");
  assertStringIncludes(COMMS_FILTERS_UI.targetingHint, "targeting filters");
  assertStringIncludes(COMMS_FILTERS_UI.sendDialogAudience, "whose filters match");
  assertEquals(COMMS_FILTERS_UI.reviewFiltersCta, "Review Communication Filters");
  assertEquals(COMMS_FILTERS_UI.savedToast.includes("Preferences"), false);
  assertEquals(COMMS_FILTERS_UI.saveFilters.includes("Preferences"), false);
});

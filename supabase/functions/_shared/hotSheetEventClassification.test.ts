import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyHotSheetEvent } from "./hotSheetEventClassification.ts";

const LISTING = "11111111-1111-1111-1111-111111111111";
const ev = (o: Record<string, unknown>) => ({
  id: "e1",
  listing_id: LISTING,
  ...o,
});

Deno.test("INSERT into a deliverable status is a New Match", () => {
  assertEquals(
    classifyHotSheetEvent(ev({ trigger_op: "INSERT", old_status: null, new_status: "active" }), LISTING).eventClass,
    "new_match",
  );
});

Deno.test("draft -> first live status is a New Match", () => {
  for (const next of ["coming_soon", "active", "off_market"]) {
    assertEquals(
      classifyHotSheetEvent(ev({ trigger_op: "UPDATE", old_status: "draft", new_status: next }), LISTING).eventClass,
      "new_match",
    );
  }
});

Deno.test("same-status UPDATE is skipped, fail closed", () => {
  const r = classifyHotSheetEvent(
    ev({ trigger_op: "UPDATE", old_status: "off_market", new_status: "off_market" }),
    LISTING,
  );
  assertEquals(r.eventClass, "skip");
  assertEquals(r.reason, "same_status_update");
});

Deno.test("real status transitions are Status Change, never New Match", () => {
  const cases: Array<[string, string]> = [
    ["active", "off_market"],
    ["off_market", "coming_soon"],
    ["coming_soon", "active"],
    ["pending", "active"],
    ["withdrawn", "active"],
  ];
  for (const [from, to] of cases) {
    assertEquals(
      classifyHotSheetEvent(ev({ trigger_op: "UPDATE", old_status: from, new_status: to }), LISTING).eventClass,
      "status_change",
      `${from} -> ${to}`,
    );
  }
});

Deno.test("missing event context fails closed", () => {
  assertEquals(classifyHotSheetEvent(null, LISTING).eventClass, "skip");
  assertEquals(classifyHotSheetEvent(undefined, LISTING).reason, "missing_event_context");
});

Deno.test("event belonging to another listing fails closed", () => {
  const r = classifyHotSheetEvent(
    ev({ listing_id: "22222222-2222-2222-2222-222222222222", trigger_op: "INSERT", new_status: "active" }),
    LISTING,
  );
  assertEquals(r.eventClass, "skip");
  assertEquals(r.reason, "event_listing_mismatch");
});

Deno.test("unknown trigger op fails closed", () => {
  assertEquals(
    classifyHotSheetEvent(ev({ trigger_op: "DELETE", old_status: "active", new_status: "sold" }), LISTING).eventClass,
    "skip",
  );
});

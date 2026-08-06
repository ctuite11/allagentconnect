import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runListingFanout } from "./fanout.ts";

Deno.test("downstream success returns the matcher summary", async () => {
  let seen: string | null = null;
  const res = await runListingFanout({
    listingId: "listing-1",
    pauseGate: { paused: false },
    invokeMatcher: (id) => {
      seen = id;
      return Promise.resolve({
        data: { hot_sheets_processed: 3, matches: 2, jobs_queued: 2 },
      });
    },
  });
  assertEquals(seen, "listing-1");
  assertEquals(res.status, 200);
  assertEquals(res.body.success, true);
  assertEquals(res.body.hot_sheet_fanout, "invoked");
  assertEquals(res.body.matcher, {
    hot_sheets_processed: 3,
    matches: 2,
    jobs_queued: 2,
  });
});

Deno.test("downstream invocation failure returns HTTP 500", async () => {
  const res = await runListingFanout({
    listingId: "listing-1",
    pauseGate: { paused: false },
    invokeMatcher: () => Promise.resolve({ error: { message: "boom" } }),
  });
  assertEquals(res.status, 500);
  assertEquals(res.body.success, false);
  assertEquals(res.body.hot_sheet_fanout, "failed");
  assertEquals(res.body.error, "boom");
});

Deno.test("paused state makes no downstream invocation", async () => {
  let calls = 0;
  const res = await runListingFanout({
    listingId: "listing-1",
    pauseGate: {
      paused: true,
      switch: "HOT_SHEET_EMAILS_PAUSED",
      reason: "Hot Sheet emails are paused",
    },
    invokeMatcher: () => {
      calls += 1;
      return Promise.resolve({ data: null });
    },
  });
  assertEquals(calls, 0);
  assertEquals(res.status, 200);
  assertEquals(res.body.paused, true);
  assertEquals(res.body.hot_sheet_fanout, "skipped");
});

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runHotSheetOutboxWorker, type OutboxEvent } from "./worker.ts";

const EVENT: OutboxEvent = { id: "ev-1", listing_id: "L1", new_status: "active" };

function deps(over: Record<string, unknown> = {}) {
  return {
    pauseGate: { paused: false },
    workerId: "w-1",
    limit: 10,
    leaseSeconds: 300,
    claimEvents: () => Promise.resolve({ events: [EVENT] }),
    invokeMatcher: () => Promise.resolve({ data: { jobsQueued: 2 } }),
    completeEvent: () => Promise.resolve(true),
    failEvent: () => Promise.resolve(true),
    ...over,
  // deno-lint-ignore no-explicit-any
  } as any;
}

Deno.test("paused worker claims nothing and leaves events untouched", async () => {
  let claimCalls = 0;
  let matcherCalls = 0;
  let completeCalls = 0;
  let failCalls = 0;
  const res = await runHotSheetOutboxWorker(deps({
    pauseGate: { paused: true, switch: "HOT_SHEET_EMAILS_PAUSED", reason: "paused" },
    claimEvents: () => { claimCalls++; return Promise.resolve({ events: [EVENT] }); },
    invokeMatcher: () => { matcherCalls++; return Promise.resolve({ data: {} }); },
    completeEvent: () => { completeCalls++; return Promise.resolve(true); },
    failEvent: () => { failCalls++; return Promise.resolve(true); },
  }));
  assertEquals(claimCalls, 0);
  assertEquals(matcherCalls, 0);
  assertEquals(completeCalls, 0);
  assertEquals(failCalls, 0);
  assertEquals(res.body.paused, true);
  assertEquals(res.body.claimed, 0);
  assertEquals(res.body.switch, "HOT_SHEET_EMAILS_PAUSED");
});

Deno.test("successful dispatch completes the event as processed", async () => {
  let completedWith: string[] = [];
  const res = await runHotSheetOutboxWorker(deps({
    completeEvent: (id: string, w: string, s: string) => {
      completedWith = [id, w, s];
      return Promise.resolve(true);
    },
  }));
  assertEquals(completedWith, ["ev-1", "w-1", "processed"]);
  assertEquals(res.body.processed, 1);
  assertEquals(res.body.failed, 0);
  assertEquals(res.body.jobs_queued, 2);
});

Deno.test("matcher error fails the event, never completes it", async () => {
  let completed = 0;
  let failedWith = "";
  const res = await runHotSheetOutboxWorker(deps({
    invokeMatcher: () => Promise.resolve({ error: { message: "boom" } }),
    completeEvent: () => { completed++; return Promise.resolve(true); },
    failEvent: (_id: string, _w: string, e: string) => {
      failedWith = e;
      return Promise.resolve(true);
    },
  }));
  assertEquals(completed, 0);
  assertEquals(failedWith, "boom");
  assertEquals(res.body.failed, 1);
  assertEquals(res.body.processed, 0);
});

Deno.test("matcher reporting paused defers the event instead of consuming it", async () => {
  let completed = 0;
  let failedWith = "";
  const res = await runHotSheetOutboxWorker(deps({
    invokeMatcher: () => Promise.resolve({ data: { paused: true, jobsQueued: 0 } }),
    completeEvent: () => { completed++; return Promise.resolve(true); },
    failEvent: (_i: string, _w: string, e: string) => { failedWith = e; return Promise.resolve(true); },
  }));
  assertEquals(completed, 0);
  assertEquals(failedWith, "matcher_paused");
  assertEquals(res.body.processed, 0);
});

Deno.test("lost lease is reported and not counted as processed", async () => {
  const res = await runHotSheetOutboxWorker(deps({
    completeEvent: () => Promise.resolve(false),
  }));
  assertEquals(res.body.processed, 0);
  assertEquals(res.body.lost_lease, 1);
});

Deno.test("claim error surfaces as 500 with nothing processed", async () => {
  const res = await runHotSheetOutboxWorker(deps({
    claimEvents: () => Promise.resolve({ events: [], error: "claim exploded" }),
  }));
  assertEquals(res.status, 500);
  assertEquals(res.body.error, "claim exploded");
  assertEquals(res.body.processed, 0);
});

Deno.test("thrown matcher exception fails the event rather than aborting the batch", async () => {
  let failedWith = "";
  const res = await runHotSheetOutboxWorker(deps({
    claimEvents: () => Promise.resolve({ events: [EVENT, { id: "ev-2", listing_id: "L2" }] }),
    invokeMatcher: (e: OutboxEvent) => {
      if (e.id === "ev-1") throw new Error("network down");
      return Promise.resolve({ data: { jobsQueued: 1 } });
    },
    failEvent: (_i: string, _w: string, err: string) => { failedWith = err; return Promise.resolve(true); },
  }));
  assertEquals(failedWith, "network down");
  assertEquals(res.body.failed, 1);
  assertEquals(res.body.processed, 1);
});

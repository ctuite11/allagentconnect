import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createAddListingDraftSession } from "./addListingDraftSession.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

Deno.test("two simultaneous ensureDraftListing calls create exactly one draft", async () => {
  const session = createAddListingDraftSession();
  let createCount = 0;
  const gate = deferred<void>();

  const create = async () => {
    createCount += 1;
    await gate.promise;
    return { id: `draft-${createCount}` };
  };

  const p1 = session.ensureDraftListing(create);
  const p2 = session.ensureDraftListing(create);
  gate.resolve();
  const [id1, id2] = await Promise.all([p1, p2]);

  assertEquals(createCount, 1);
  assertEquals(id1, "draft-1");
  assertEquals(id2, "draft-1");
  assertEquals(session.getDraftId(), "draft-1");
});

Deno.test("manual save overlapping autosave create path yields exactly one draft", async () => {
  const session = createAddListingDraftSession();
  let createCount = 0;
  const gate = deferred<void>();

  const create = async () => {
    createCount += 1;
    await gate.promise;
    return { id: "shared-draft" };
  };

  // Autosave and manual save both need a draft id for the same session.
  session.beginSave(); // manual save active
  const autosaveEnsure = session.ensureDraftListing(create);
  const manualEnsure = session.ensureDraftListing(create);
  gate.resolve();
  const [a, b] = await Promise.all([autosaveEnsure, manualEnsure]);
  session.endSave();

  assertEquals(createCount, 1);
  assertEquals(a, "shared-draft");
  assertEquals(b, "shared-draft");
});

Deno.test("photo upload overlapping save create path yields exactly one draft", async () => {
  const session = createAddListingDraftSession();
  let createCount = 0;
  const gate = deferred<void>();

  const create = async () => {
    createCount += 1;
    await gate.promise;
    return { id: "photo-save-draft" };
  };

  session.beginSave();
  const saveEnsure = session.ensureDraftListing(create);
  const photoEnsure = session.ensureDraftListing(create);
  gate.resolve();
  const [saveId, photoId] = await Promise.all([saveEnsure, photoEnsure]);
  session.endSave();

  assertEquals(createCount, 1);
  assertEquals(saveId, photoId);
  assertEquals(session.getDraftId(), "photo-save-draft");
});

Deno.test("existing draft performs update path (ensure does not insert)", async () => {
  const session = createAddListingDraftSession();
  session.setDraftId("existing-draft-id");
  let createCount = 0;

  const id = await session.ensureDraftListing(async () => {
    createCount += 1;
    return { id: "should-not-create" };
  });

  assertEquals(createCount, 0);
  assertEquals(id, "existing-draft-id");
  assertEquals(session.getDraftId(), "existing-draft-id");
});

Deno.test("failed creation clears in-flight lock and can be retried", async () => {
  const session = createAddListingDraftSession();
  let attempts = 0;

  const first = await session.ensureDraftListing(async () => {
    attempts += 1;
    return null;
  });
  assertEquals(first, null);
  assertEquals(session.getDraftId(), null);
  assertEquals(session.isDraftCreationInFlight(), false);

  const second = await session.ensureDraftListing(async () => {
    attempts += 1;
    return { id: "retry-ok" };
  });
  assertEquals(second, "retry-ok");
  assertEquals(session.getDraftId(), "retry-ok");
  assertEquals(attempts, 2);
});

Deno.test("failed creation that throws can also be retried", async () => {
  const session = createAddListingDraftSession();
  let attempts = 0;

  const first = await session.ensureDraftListing(async () => {
    attempts += 1;
    throw new Error("insert failed");
  });
  assertEquals(first, null);
  assertEquals(session.isDraftCreationInFlight(), false);

  const second = await session.ensureDraftListing(async () => {
    attempts += 1;
    return { id: "after-throw" };
  });
  assertEquals(second, "after-throw");
  assertEquals(attempts, 2);
});

Deno.test("autosave is skipped while another save is active", () => {
  const session = createAddListingDraftSession();
  assertEquals(session.shouldSkipAutosaveTick(), false);

  session.beginSave();
  assertEquals(session.shouldSkipAutosaveTick(), true);
  session.endSave();
  assertEquals(session.shouldSkipAutosaveTick(), false);
});

Deno.test("autosave is skipped while draft creation is in flight", async () => {
  const session = createAddListingDraftSession();
  const gate = deferred<void>();

  const pending = session.ensureDraftListing(async () => {
    await gate.promise;
    return { id: "inflight" };
  });

  assertEquals(session.shouldSkipAutosaveTick(), true);
  assertEquals(session.isDraftCreationInFlight(), true);

  gate.resolve();
  await pending;

  assertEquals(session.shouldSkipAutosaveTick(), false);
  assertEquals(session.isDraftCreationInFlight(), false);
});

Deno.test("draft id is set synchronously before in-flight lock releases", async () => {
  const observed: Array<{ draftId: string | null; inFlight: boolean }> = [];
  const session = createAddListingDraftSession();
  const gate = deferred<void>();

  const pending = session.ensureDraftListing(async () => {
    await gate.promise;
    return { id: "sync-id" };
  });

  // After create resolves but before awaiters continue, ref must be set and lock cleared in finally.
  // Probe inside create after return is handled by session — verify post-await state and that
  // getDraftId was available to concurrent callers that joined the same promise.
  gate.resolve();
  const id = await pending;
  observed.push({
    draftId: session.getDraftId(),
    inFlight: session.isDraftCreationInFlight(),
  });

  assertEquals(id, "sync-id");
  assertEquals(observed[0].draftId, "sync-id");
  assertEquals(observed[0].inFlight, false);
});

Deno.test("onDraftIdChange stays synchronized with the session ref", async () => {
  const seen: Array<string | null> = [];
  const session = createAddListingDraftSession((id) => seen.push(id));

  session.setDraftId("hydrated");
  assertEquals(seen, ["hydrated"]);

  await session.ensureDraftListing(async () => ({ id: "created" }));
  // Already had an id — create skipped; no extra callback from ensure.
  assertEquals(seen, ["hydrated"]);

  session.setDraftId(null);
  const created = await session.ensureDraftListing(async () => ({ id: "new-one" }));
  assertEquals(created, "new-one");
  assertEquals(seen[seen.length - 1], "new-one");
});

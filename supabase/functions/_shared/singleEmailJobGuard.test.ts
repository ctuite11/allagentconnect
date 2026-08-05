import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  findAllowlistEntryByJobId,
  isAllowedJobId,
  parseSingleJobRequest,
  SINGLE_SEND_ALLOWLIST,
  validateClaimedJobForSingleSend,
  validateJobForSingleSend,
} from "./singleEmailJobGuard.ts";
import { authorizeInternalServiceRole } from "./internalServiceRoleAuth.ts";
import {
  isGloballyPaused,
  isStreamPaused,
  preSendBlockReason,
} from "./emailStreams.ts";
import { ALL_PAUSES_OFF, ALL_PAUSES_ON, withEnv } from "./testEnv.ts";

const CANARY_JOB_ID = "f39cb9a8-4477-425c-98a8-b61efa0e8c1e";
const CANARY_KEY = "license-verified/48326c81-cc09-41cb-b80b-85bf45159e3c";

function canaryJob(over: Record<string, unknown> = {}) {
  return {
    id: CANARY_JOB_ID,
    status: "queued",
    stream: "transactional",
    idempotency_key: CANARY_KEY,
    payload: {
      to: "kate.fallon@gibsonsir.com",
      template: "license-verified",
    },
    ...over,
  } as never;
}

/* ---------- auth: rejected before any database work ---------- */

function reqWith(auth?: string) {
  const headers = new Headers();
  if (auth) headers.set("Authorization", auth);
  return new Request("https://x/send-single-email-job", { method: "POST", headers });
}

Deno.test("missing / bad service-role auth is rejected", () => {
  withEnv({ SUPABASE_SERVICE_ROLE_KEY: "svc-key" }, () => {
    assertEquals(authorizeInternalServiceRole(reqWith()).ok, false);
    assertEquals(authorizeInternalServiceRole(reqWith("Bearer wrong")).ok, false);
    assertEquals(authorizeInternalServiceRole(reqWith("svc-key")).ok, false);
    assertEquals(authorizeInternalServiceRole(reqWith("Bearer svc-key")).ok, true);
  });
});

Deno.test("auth is checked before body parsing / db access / claiming", async () => {
  const src = await Deno.readTextFile(
    new URL("../send-single-email-job/index.ts", import.meta.url),
  );
  const authAt = src.indexOf("authorizeInternalServiceRole(req)");
  const parseAt = src.indexOf("await req.json()");
  const clientAt = src.indexOf("createClient(");
  const claimAt = src.indexOf('.update({');
  assertEquals(authAt > -1, true);
  assertEquals(authAt < parseAt, true);
  assertEquals(authAt < clientAt, true);
  assertEquals(authAt < claimAt, true);
});

/* ---------- job id ---------- */

Deno.test("missing or invalid job id yields no claim", () => {
  for (const bad of [null, undefined, "x", {}, { job_id: "" }, { job_id: 42 }, { job_id: "not-a-uuid" }]) {
    assertEquals(parseSingleJobRequest(bad as unknown).ok, false);
  }
  const ok = parseSingleJobRequest({ job_id: CANARY_JOB_ID });
  assertEquals(ok.ok, true);
  if (ok.ok) assertEquals(ok.jobId, CANARY_JOB_ID);
});

Deno.test("batch semantics are refused outright", () => {
  assertEquals(
    parseSingleJobRequest({ job_id: CANARY_JOB_ID, limit: 50 }),
    { ok: false, error: "batch_mode_not_supported" },
  );
  assertEquals(
    parseSingleJobRequest({ job_id: CANARY_JOB_ID, job_ids: [CANARY_JOB_ID] }),
    { ok: false, error: "batch_mode_not_supported" },
  );
});

/* ---------- row validation ---------- */

Deno.test("the canary job validates", () => {
  const v = validateJobForSingleSend(canaryJob());
  assertEquals(v.ok, true);
});

Deno.test("wrong stream, recipient, template or idempotency key is rejected", () => {
  assertEquals(
    validateJobForSingleSend(canaryJob({ stream: "communications" })),
    { ok: false, error: "stream_not_allowed" },
  );
  assertEquals(
    validateJobForSingleSend(canaryJob({ stream: "hot_sheet" })),
    { ok: false, error: "stream_not_allowed" },
  );
  assertEquals(
    validateJobForSingleSend(canaryJob({ stream: "system" })),
    { ok: false, error: "stream_not_allowed" },
  );
  assertEquals(
    validateJobForSingleSend(
      canaryJob({ payload: { to: "someone@else.com", template: "license-verified" } }),
    ),
    { ok: false, error: "recipient_mismatch" },
  );
  assertEquals(
    validateJobForSingleSend(
      canaryJob({
        payload: {
          to: ["kate.fallon@gibsonsir.com", "someone@else.com"],
          template: "license-verified",
        },
      }),
    ),
    { ok: false, error: "recipient_mismatch" },
  );
  assertEquals(
    validateJobForSingleSend(
      canaryJob({ payload: { to: "kate.fallon@gibsonsir.com", template: "hot-sheet-status-change" } }),
    ),
    { ok: false, error: "template_mismatch" },
  );
  assertEquals(
    validateJobForSingleSend(canaryJob({ idempotency_key: "license-verified/other" })),
    { ok: false, error: "idempotency_key_not_allowlisted" },
  );
  assertEquals(
    validateJobForSingleSend(canaryJob({ idempotency_key: null })),
    { ok: false, error: "idempotency_key_not_allowlisted" },
  );
  assertEquals(validateJobForSingleSend(null), { ok: false, error: "job_not_found" });
});

Deno.test("only queued rows may be claimed — repeated invocation cannot send twice", () => {
  for (const status of ["processing", "sent", "failed", "cancelled"]) {
    assertEquals(
      validateJobForSingleSend(canaryJob({ status })),
      { ok: false, error: "job_not_queued" },
    );
  }
});

Deno.test("allowlist contains only the reviewed canary job", () => {
  assertEquals(SINGLE_SEND_ALLOWLIST.length, 1);
  assertEquals(SINGLE_SEND_ALLOWLIST[0].job_id, CANARY_JOB_ID);
  assertEquals(SINGLE_SEND_ALLOWLIST[0].idempotency_key, CANARY_KEY);
  assertEquals(SINGLE_SEND_ALLOWLIST[0].recipient, "kate.fallon@gibsonsir.com");
  assertEquals(SINGLE_SEND_ALLOWLIST[0].template, "license-verified");
  assertEquals(SINGLE_SEND_ALLOWLIST[0].stream, "transactional");
  assertEquals(Object.keys(SINGLE_SEND_ALLOWLIST[0]).sort(), [
    "idempotency_key",
    "job_id",
    "recipient",
    "stream",
    "template",
  ]);
});

/* ---------- exact-UUID gate ---------- */

Deno.test("another UUID is rejected before any database access", async () => {
  const other = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  assertEquals(isAllowedJobId(other), false);
  assertEquals(findAllowlistEntryByJobId(other), null);
  assertEquals(isAllowedJobId(CANARY_JOB_ID), true);

  const src = await Deno.readTextFile(
    new URL("../send-single-email-job/index.ts", import.meta.url),
  );
  const gateAt = src.indexOf("findAllowlistEntryByJobId(jobId)");
  const clientAt = src.indexOf("createClient(SUPABASE_URL");
  const queryAt = src.indexOf('.from("email_jobs")');
  assertEquals(gateAt > -1, true);
  assertEquals(gateAt < clientAt, true);
  assertEquals(gateAt < queryAt, true);
});

Deno.test("a row whose id differs from the allowlisted UUID is rejected", () => {
  assertEquals(
    validateJobForSingleSend(canaryJob({ id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" })),
    { ok: false, error: "job_id_not_allowlisted" },
  );
  assertEquals(
    validateJobForSingleSend(canaryJob({ id: null })),
    { ok: false, error: "job_id_missing" },
  );
});

Deno.test("the claim conditions on job id, queued status, stream and approved key", async () => {
  const src = await Deno.readTextFile(
    new URL("../send-single-email-job/index.ts", import.meta.url),
  );
  assertEquals(src.includes('.eq("id", jobId)'), true);
  assertEquals(src.includes('.eq("status", "queued")'), true);
  assertEquals(src.includes('.eq("stream", allowEntry.stream)'), true);
  assertEquals(
    src.includes('.eq("idempotency_key", allowEntry.idempotency_key)'),
    true,
  );
});

Deno.test("the claimed row is fully revalidated before deliverEmailJob", async () => {
  const src = await Deno.readTextFile(
    new URL("../send-single-email-job/index.ts", import.meta.url),
  );
  const revalidateAt = src.indexOf("validateClaimedJobForSingleSend(");
  const deliverAt = src.indexOf("await deliverEmailJob(");
  assertEquals(revalidateAt > -1, true);
  assertEquals(deliverAt > -1, true);
  assertEquals(revalidateAt < deliverAt, true);

  // claimed rows are 'processing'; the canary must still validate
  assertEquals(validateClaimedJobForSingleSend(canaryJob({ status: "processing" })).ok, true);
  assertEquals(
    validateClaimedJobForSingleSend(
      canaryJob({ status: "processing", idempotency_key: "license-verified/other" }),
    ),
    { ok: false, error: "idempotency_key_not_allowlisted" },
  );
  assertEquals(
    validateClaimedJobForSingleSend(
      canaryJob({ status: "processing", id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }),
    ),
    { ok: false, error: "job_id_not_allowlisted" },
  );
});

Deno.test("claimed-row mismatch makes no provider call and returns the job to queued", async () => {
  const src = await Deno.readTextFile(
    new URL("../send-single-email-job/index.ts", import.meta.url),
  );
  const start = src.indexOf("validateClaimedJobForSingleSend(");
  const deliverAt = src.indexOf("await deliverEmailJob(");
  const branch = src.slice(start, deliverAt);
  assertEquals(branch.includes('status: "queued"'), true);
  assertEquals(branch.includes("attempts: row.attempts ?? 0"), true);
  assertEquals(branch.includes("claimed_row_validation_failed"), true);
  assertEquals(branch.includes("console.error"), true);
  assertEquals(branch.includes("deliverEmailJob"), false);
});

/* ---------- pause behaviour ---------- */

Deno.test("transactional pause rules: global blocks, Hot Sheet / Comms do not", () => {
  const job = {
    stream: "transactional",
    idempotency_key: CANARY_KEY,
    payload: { template: "license-verified" },
  };
  withEnv(ALL_PAUSES_ON, () => {
    assertEquals(preSendBlockReason(job), "global_pause");
  });
  withEnv({ ...ALL_PAUSES_OFF, HOT_SHEET_EMAILS_PAUSED: "true" }, () => {
    assertEquals(preSendBlockReason(job), null);
  });
  withEnv({ ...ALL_PAUSES_OFF, COMMS_EMAILS_PAUSED: "true" }, () => {
    assertEquals(preSendBlockReason(job), null);
  });
  withEnv(
    { ...ALL_PAUSES_OFF, HOT_SHEET_EMAILS_PAUSED: "true", COMMS_EMAILS_PAUSED: "true" },
    () => {
      assertEquals(preSendBlockReason(job), null);
      assertEquals(isStreamPaused("transactional"), false);
      assertEquals(isGloballyPaused(), false);
    },
  );
  withEnv({ ...ALL_PAUSES_OFF, EMAIL_SENDING_PAUSED: "true" }, () => {
    assertEquals(preSendBlockReason(job), "global_pause");
    assertEquals(isGloballyPaused(), true);
  });
});

/* ---------- structural guarantees ---------- */

Deno.test("single-job function never uses the batch claim RPC and claims one row", async () => {
  const src = await Deno.readTextFile(
    new URL("../send-single-email-job/index.ts", import.meta.url),
  );
  // strip comments so prose about the rule doesn't count as a violation
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assertEquals(code.includes("email_jobs_claim"), false);
  assertEquals(code.includes("p_limit"), false);
  // conditional single-row claim
  assertEquals(src.includes('.eq("id", jobId)'), true);
  assertEquals(src.includes('.eq("status", "queued")'), true);
  assertEquals(src.includes('.eq("stream", allowEntry.stream)'), true);
  assertEquals(src.includes("claimed.length !== 1"), true);
  // reuses the one delivery implementation
  assertEquals(src.includes("deliverEmailJob"), true);
  assertEquals(src.includes("sendEmail("), false);
});

Deno.test("there is exactly one email delivery implementation", async () => {
  const worker = await Deno.readTextFile(
    new URL("../process-email-queue/index.ts", import.meta.url),
  );
  assertEquals(worker.includes("deliverEmailJob"), true);
  assertEquals(worker.includes("sendEmail("), false);
  const core = await Deno.readTextFile(new URL("./emailJobDelivery.ts", import.meta.url));
  assertEquals(core.includes("preSendBlockReason"), true);
  assertEquals(core.includes("sendEmail("), true);
});
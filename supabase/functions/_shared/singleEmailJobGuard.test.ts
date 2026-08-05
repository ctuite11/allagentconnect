import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseSingleJobRequest,
  SINGLE_SEND_ALLOWLIST,
  validateJobForSingleSend,
} from "./singleEmailJobGuard.ts";
import { authorizeInternalServiceRole } from "./internalServiceRoleAuth.ts";
import { preSendBlockReason } from "./emailStreams.ts";
import { ALL_PAUSES_OFF, ALL_PAUSES_ON, withEnv } from "./testEnv.ts";

const CANARY_JOB_ID = "1d72f81a-b45a-439a-a919-deecc845a8cf";
const CANARY_KEY =
  "hs-agent:beb483e0-6125-40df-8532-15e53a3b4c59:0775b03d-e774-4dc9-9627-f0d2ec752fd3:active";

function canaryJob(over: Record<string, unknown> = {}) {
  return {
    id: CANARY_JOB_ID,
    status: "queued",
    stream: "hot_sheet",
    idempotency_key: CANARY_KEY,
    payload: {
      to: "chris@allagentconnect.com",
      template: "new-match-notification",
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
    validateJobForSingleSend(canaryJob({ stream: "transactional" })),
    { ok: false, error: "stream_not_allowed" },
  );
  assertEquals(
    validateJobForSingleSend(canaryJob({ stream: "system" })),
    { ok: false, error: "stream_not_allowed" },
  );
  assertEquals(
    validateJobForSingleSend(
      canaryJob({ payload: { to: "someone@else.com", template: "new-match-notification" } }),
    ),
    { ok: false, error: "recipient_mismatch" },
  );
  assertEquals(
    validateJobForSingleSend(
      canaryJob({
        payload: {
          to: ["chris@allagentconnect.com", "someone@else.com"],
          template: "new-match-notification",
        },
      }),
    ),
    { ok: false, error: "recipient_mismatch" },
  );
  assertEquals(
    validateJobForSingleSend(
      canaryJob({ payload: { to: "chris@allagentconnect.com", template: "hot-sheet-status-change" } }),
    ),
    { ok: false, error: "template_mismatch" },
  );
  assertEquals(
    validateJobForSingleSend(canaryJob({ idempotency_key: "hs-agent:other:other:active" })),
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
  assertEquals(SINGLE_SEND_ALLOWLIST[0].idempotency_key, CANARY_KEY);
  assertEquals(SINGLE_SEND_ALLOWLIST[0].recipient, "chris@allagentconnect.com");
  assertEquals(SINGLE_SEND_ALLOWLIST[0].template, "new-match-notification");
  assertEquals(SINGLE_SEND_ALLOWLIST[0].stream, "hot_sheet");
});

/* ---------- pause behaviour ---------- */

Deno.test("paused state blocks the send (job stays queued)", () => {
  const job = {
    stream: "hot_sheet",
    idempotency_key: CANARY_KEY,
    payload: { template: "new-match-notification" },
  };
  withEnv(ALL_PAUSES_ON, () => {
    assertEquals(preSendBlockReason(job), "global_pause");
  });
  withEnv({ ...ALL_PAUSES_OFF, HOT_SHEET_EMAILS_PAUSED: "true" }, () => {
    assertEquals(preSendBlockReason(job), "stream_paused:hot_sheet");
  });
  withEnv(ALL_PAUSES_OFF, () => {
    assertEquals(preSendBlockReason(job), null);
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
  assertEquals(src.includes('.eq("stream", SINGLE_SEND_ALLOWED_STREAM)'), true);
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
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { authorizeInternalServiceRole } from "./internalServiceRoleAuth.ts";
import { allowedStreams, isGloballyPaused } from "./emailStreams.ts";

const SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service-role-test-key";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon-key";

function envWith(secret: string | undefined) {
  return { get: (k: string) => (k === "SUPABASE_SERVICE_ROLE_KEY" ? secret : undefined) };
}

function req(authorization: string | null) {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization != null) headers.set("Authorization", authorization);
  return new Request("https://example.test/functions/v1/process-email-queue", {
    method: "POST",
    headers,
    body: JSON.stringify({ source: "pg_cron" }),
  });
}

async function workerSource(): Promise<string> {
  return await Deno.readTextFile(
    new URL("../process-email-queue/index.ts", import.meta.url),
  );
}

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = Deno.env.get(k);
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

Deno.test("global pause true → paused response, zero claims possible", () => {
  withEnv({ EMAIL_SENDING_PAUSED: "true" }, () => {
    assertEquals(isGloballyPaused(), true);
    // allowedStreams() is empty under global pause, so email_jobs_claim can
    // never be reached with a non-empty stream list.
    assertEquals(allowedStreams(), []);
  });
});

Deno.test("global pause false + no auth → 401, zero claims", () => {
  withEnv({ EMAIL_SENDING_PAUSED: "false" }, () => {
    assertEquals(isGloballyPaused(), false);
    assertEquals(authorizeInternalServiceRole(req(null), envWith(SERVICE_ROLE)), {
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
  });
});

Deno.test("global pause false + anon auth → 401, zero claims", () => {
  withEnv({ EMAIL_SENDING_PAUSED: "false" }, () => {
    assertEquals(authorizeInternalServiceRole(req(`Bearer ${ANON}`), envWith(SERVICE_ROLE)), {
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
  });
});

Deno.test("global pause false + malformed / wrong bearer → 401", () => {
  const env = envWith(SERVICE_ROLE);
  assertEquals(authorizeInternalServiceRole(req("Bearer"), env).ok, false);
  assertEquals(authorizeInternalServiceRole(req("Basic abc"), env).ok, false);
  assertEquals(authorizeInternalServiceRole(req("Bearer wrong"), env).ok, false);
});

Deno.test("exact service role → allowed to continue", () => {
  assertEquals(
    authorizeInternalServiceRole(req(`Bearer ${SERVICE_ROLE}`), envWith(SERVICE_ROLE)),
    { ok: true },
  );
});

Deno.test("worker: global pause is the first operational guard, auth is next", async () => {
  const src = await workerSource();
  const pauseIdx = src.indexOf("if (isGloballyPaused())");
  const authIdx = src.indexOf("authorizeInternalServiceRole(req)");
  const streamsIdx = src.indexOf("const streams = allowedStreams()");
  assertEquals(pauseIdx > 0, true);
  assertEquals(authIdx > pauseIdx, true);
  assertEquals(streamsIdx > authIdx, true);
});

Deno.test("worker: auth occurs before client creation and email_jobs_claim", async () => {
  const src = await workerSource();
  const authIdx = src.indexOf("authorizeInternalServiceRole(req)");
  const clientIdx = src.indexOf("createClient(SUPABASE_URL");
  const claimIdx = src.indexOf('"email_jobs_claim"');
  const resendIdx = src.indexOf('Deno.env.get("RESEND_API_KEY")');
  assertEquals(authIdx > 0, true);
  assertEquals(clientIdx > authIdx, true);
  assertEquals(claimIdx > authIdx, true);
  assertEquals(resendIdx > authIdx, true);
});

Deno.test("config.toml requires JWT verification for process-email-queue", async () => {
  const config = await Deno.readTextFile(new URL("../../config.toml", import.meta.url));
  assertEquals(
    /\[functions\.process-email-queue\]\s*\nverify_jwt\s*=\s*true/.test(config),
    true,
  );
});

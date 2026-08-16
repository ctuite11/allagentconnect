import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  authorizeInternalServiceRole,
  extractBearerToken,
  SERVICE_ROLE_KEY_ENV,
  serviceRoleInvokeHeaders,
} from "./internalServiceRoleAuth.ts";

const SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service-role-test-key";
const ANON_OR_USER = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon-or-user-jwt";

function envWith(secret: string | undefined) {
  return {
    get(key: string) {
      if (key === SERVICE_ROLE_KEY_ENV) return secret;
      return undefined;
    },
  };
}

function reqWithAuth(authorization: string | null) {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization != null) headers.set("Authorization", authorization);
  return new Request("https://example.test/functions/v1/send-new-match-notification", {
    method: "POST",
    headers,
    body: JSON.stringify({ listing_id: "should-not-be-parsed-when-unauthorized" }),
  });
}

Deno.test("missing SUPABASE_SERVICE_ROLE_KEY env fails closed with 503", () => {
  assertEquals(authorizeInternalServiceRole(reqWithAuth(`Bearer ${SERVICE_ROLE}`), envWith(undefined)), {
    ok: false,
    status: 503,
    error: "misconfigured",
  });
  assertEquals(authorizeInternalServiceRole(reqWithAuth(`Bearer ${SERVICE_ROLE}`), envWith("")), {
    ok: false,
    status: 503,
    error: "misconfigured",
  });
  assertEquals(authorizeInternalServiceRole(reqWithAuth(`Bearer ${SERVICE_ROLE}`), envWith("   ")), {
    ok: false,
    status: 503,
    error: "misconfigured",
  });
});

Deno.test("missing Authorization header → 401", () => {
  assertEquals(authorizeInternalServiceRole(reqWithAuth(null), envWith(SERVICE_ROLE)), {
    ok: false,
    status: 401,
    error: "Unauthorized",
  });
});

Deno.test("malformed bearer header → 401", () => {
  const env = envWith(SERVICE_ROLE);
  assertEquals(authorizeInternalServiceRole(reqWithAuth(""), env), {
    ok: false,
    status: 401,
    error: "Unauthorized",
  });
  assertEquals(authorizeInternalServiceRole(reqWithAuth("Bearer"), env), {
    ok: false,
    status: 401,
    error: "Unauthorized",
  });
  assertEquals(authorizeInternalServiceRole(reqWithAuth("Bearer "), env), {
    ok: false,
    status: 401,
    error: "Unauthorized",
  });
  assertEquals(authorizeInternalServiceRole(reqWithAuth(`Basic ${SERVICE_ROLE}`), env), {
    ok: false,
    status: 401,
    error: "Unauthorized",
  });
  assertEquals(extractBearerToken("Token abc"), null);
  assertEquals(extractBearerToken(`Bearer ${SERVICE_ROLE}`), SERVICE_ROLE);
});

Deno.test("incorrect token → 401", () => {
  assertEquals(
    authorizeInternalServiceRole(reqWithAuth("Bearer wrong-service-role-key"), envWith(SERVICE_ROLE)),
    { ok: false, status: 401, error: "Unauthorized" },
  );
});

Deno.test("non-service-role authenticated token → 401", () => {
  assertEquals(
    authorizeInternalServiceRole(reqWithAuth(`Bearer ${ANON_OR_USER}`), envWith(SERVICE_ROLE)),
    { ok: false, status: 401, error: "Unauthorized" },
  );
});

Deno.test("exact service-role bearer token → authorized", () => {
  assertEquals(
    authorizeInternalServiceRole(reqWithAuth(`Bearer ${SERVICE_ROLE}`), envWith(SERVICE_ROLE)),
    { ok: true },
  );
});

Deno.test("authorized request while paused still returns pause semantics (source order)", async () => {
  // Auth runs first; pause gate remains after auth and still short-circuits with
  // jobsQueued/hot_sheet_fanout skipped — no matching or enqueue work.
  const matcher = await Deno.readTextFile(
    new URL("../send-new-match-notification/index.ts", import.meta.url),
  );
  const bridge = await Deno.readTextFile(
    new URL("../notify-matching-buyers/index.ts", import.meta.url),
  );
  const fanout = await Deno.readTextFile(
    new URL("../notify-matching-buyers/fanout.ts", import.meta.url),
  );
  const authIdx = matcher.indexOf("authorizeInternalServiceRole(req)");
  const pauseIdx = matcher.indexOf("assertHotSheetEnqueueAllowed()");
  const jobsQueuedIdx = matcher.indexOf("jobsQueued: 0");
  assertEquals(authIdx > 0 && pauseIdx > authIdx, true);
  assertEquals(jobsQueuedIdx > pauseIdx, true);

  const bridgeAuth = bridge.indexOf("authorizeInternalServiceRole(req)");
  const bridgePause = bridge.indexOf("assertHotSheetEnqueueAllowed()");
  assertEquals(bridgeAuth > 0 && bridgePause > bridgeAuth, true);
  // Pause short-circuit response is produced by the extracted fanout core, and
  // the bridge must reach it only after the auth gate.
  assertEquals(bridge.indexOf("runListingFanout(") > bridgePause, true);
  assertEquals(fanout.includes('hot_sheet_fanout: "skipped"'), true);
});

Deno.test("serviceRoleInvokeHeaders carries Authorization + apikey", () => {
  assertEquals(serviceRoleInvokeHeaders(SERVICE_ROLE), {
    Authorization: `Bearer ${SERVICE_ROLE}`,
    apikey: SERVICE_ROLE,
  });
});

Deno.test("Hot Sheet producers enforce service-role auth before work", async () => {
  const matcher = await Deno.readTextFile(
    new URL("../send-new-match-notification/index.ts", import.meta.url),
  );
  const bridge = await Deno.readTextFile(
    new URL("../notify-matching-buyers/index.ts", import.meta.url),
  );

  for (const src of [matcher, bridge]) {
    assertEquals(src.includes("internalServiceRoleAuth.ts"), true);
    assertEquals(src.includes("authorizeInternalServiceRole"), true);
    assertEquals(src.includes("auth.error"), true);
    assertEquals(src.includes("auth.status"), true);

    // Compare call sites, not imports.
    const authIdx = src.indexOf("authorizeInternalServiceRole(req)");
    const pauseIdx = src.indexOf("assertHotSheetEnqueueAllowed()");
    const bodyIdx = src.indexOf("req.json()");
    assertEquals(authIdx > 0, true);
    assertEquals(pauseIdx > authIdx, true);
    assertEquals(bodyIdx > authIdx, true);

    // Auth must also precede runtime client creation (not the import).
    const clientIdx = Math.max(
      src.indexOf("createClient(SUPABASE_URL"),
      src.indexOf("createClient(supabaseUrl"),
    );
    assertEquals(clientIdx > authIdx, true);
  }
  // Unauthorized path must not reach matching / enqueue symbols before the gate
  // (gate is first executable auth call after OPTIONS).
  const matcherAuth = matcher.indexOf("authorizeInternalServiceRole(req)");
  const matcherRpc = matcher.indexOf("check_hot_sheet_matches");
  // Enqueues now go through the atomic delivery-claim helper rather than a
  // direct email_jobs insert; the auth-before-work guarantee is unchanged.
  const matcherJobs = matcher.indexOf("enqueueHotSheetDelivery(supabase");
  const matcherSent = matcher.indexOf('.from("hot_sheet_sent_listings")');
  assertEquals(matcherRpc > matcherAuth, true);
  assertEquals(matcherJobs > matcherAuth, true);
  assertEquals(matcherSent > matcherAuth, true);

  // Bridge still passes listing_id + explicit service-role headers downstream.
  assertEquals(bridge.includes("listingId: listing.listing_id"), true);
  assertEquals(bridge.includes("serviceRoleInvokeHeaders"), true);
  assertEquals(bridge.includes("Authorization"), true);
  assertEquals(bridge.includes("apikey"), true);
  assertEquals(bridge.includes("send-new-match-notification"), true);
});

Deno.test("config.toml requires JWT verification for Hot Sheet producers", async () => {
  const config = await Deno.readTextFile(
    new URL("../../config.toml", import.meta.url),
  );
  assertEquals(
    /\[functions\.send-new-match-notification\]\s*\nverify_jwt\s*=\s*true/.test(config),
    true,
  );
  assertEquals(
    /\[functions\.notify-matching-buyers\]\s*\nverify_jwt\s*=\s*true/.test(config),
    true,
  );
});

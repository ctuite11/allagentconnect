import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  authorizeCommsDigestCron,
  COMMS_DIGEST_CRON_SECRET_ENV,
  COMMS_DIGEST_CRON_SECRET_HEADER,
  timingSafeEqual,
} from "./commsDigestCronAuth.ts";

function envWith(secret: string | undefined) {
  return {
    get(key: string) {
      if (key === COMMS_DIGEST_CRON_SECRET_ENV) return secret;
      return undefined;
    },
  };
}

function reqWithSecret(secret: string | null) {
  const headers = new Headers({ "content-type": "application/json" });
  if (secret != null) headers.set(COMMS_DIGEST_CRON_SECRET_HEADER, secret);
  return new Request("https://example.test/functions/v1/process-comms-digests", {
    method: "POST",
    headers,
    body: "{}",
  });
}

Deno.test("timingSafeEqual rejects length and content mismatches", () => {
  assertEquals(timingSafeEqual("abc", "abc"), true);
  assertEquals(timingSafeEqual("abc", "abd"), false);
  assertEquals(timingSafeEqual("abc", "ab"), false);
});

Deno.test("missing COMMS_DIGEST_CRON_SECRET env fails closed with 503", () => {
  const result = authorizeCommsDigestCron(reqWithSecret("anything"), envWith(undefined));
  assertEquals(result, { ok: false, status: 503, error: "misconfigured" });

  const blank = authorizeCommsDigestCron(reqWithSecret("anything"), envWith("   "));
  assertEquals(blank, { ok: false, status: 503, error: "misconfigured" });
});

Deno.test("missing or wrong cron secret header fails with 401", () => {
  const env = envWith("correct-secret-value");
  assertEquals(authorizeCommsDigestCron(reqWithSecret(null), env), {
    ok: false,
    status: 401,
    error: "Unauthorized",
  });
  assertEquals(authorizeCommsDigestCron(reqWithSecret(""), env), {
    ok: false,
    status: 401,
    error: "Unauthorized",
  });
  assertEquals(authorizeCommsDigestCron(reqWithSecret("wrong"), env), {
    ok: false,
    status: 401,
    error: "Unauthorized",
  });
});

Deno.test("matching cron secret authorizes the request", () => {
  const secret = "correct-secret-value";
  assertEquals(
    authorizeCommsDigestCron(reqWithSecret(secret), envWith(secret)),
    { ok: true },
  );
});

Deno.test("process-comms-digests enforces COMMS_DIGEST_CRON_SECRET before work", async () => {
  const src = await Deno.readTextFile(
    new URL("../process-comms-digests/index.ts", import.meta.url),
  );
  assertEquals(src.includes("commsDigestCronAuth.ts"), true);
  assertEquals(src.includes("authorizeCommsDigestCron"), true);
});

Deno.test("vault dispatcher migration stops using service_role_key GUC", async () => {
  const sql = await Deno.readTextFile(
    new URL(
      "../../migrations/20260804210000_comms_digest_cron_vault_dispatcher.sql",
      import.meta.url,
    ),
  );
  assertEquals(sql.includes("comms_digest_cron_secret"), true);
  assertEquals(sql.includes("vault.decrypted_secrets"), true);
  assertEquals(sql.includes("x-comms-digest-cron-secret"), true);
  assertEquals(sql.includes("supabase.service_role_key"), false);
  assertEquals(/CREATE SECRET|vault\.create_secret/i.test(sql), false);
});

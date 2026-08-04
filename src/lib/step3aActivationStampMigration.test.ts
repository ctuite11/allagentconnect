import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const MIGRATION_PATH = new URL(
  "../../supabase/migrations/20260804160000_step3a_activation_stamp_patricia_maria.sql",
  import.meta.url,
);

const PATRICIA = "b01352e3-1cef-4289-8927-e2cecb666803";
const MARIA = "7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca";
const PATRICIA_AT = "2026-08-01 21:01:34.187814+00";
const MARIA_AT = "2026-08-03 09:46:57.472291+00";

const EXCLUDED = [
  "Steve Facelle",
  "Sheri Flagler",
  "Kristin Gennetti",
  "Shari Jacobson",
  "kristingennetti@gmail.com",
  "shari.jacobson@cbrealty.com",
  "sheri.flagler@cbrealty.com",
  "steve.facelle@raveis.com",
];

Deno.test("Step 3A migration targets only Patricia and Maria with redeemed_at stamps", async () => {
  const sql = await Deno.readTextFile(MIGRATION_PATH);

  assertStringIncludes(sql, "BEGIN;");
  assertStringIncludes(sql, "COMMIT;");
  assertStringIncludes(sql, PATRICIA);
  assertStringIncludes(sql, MARIA);
  assertStringIncludes(sql, PATRICIA_AT);
  assertStringIncludes(sql, MARIA_AT);
  assertStringIncludes(sql, "account_activated_at IS NULL");
  assertStringIncludes(sql, "agent_status = 'verified'");
  assertStringIncludes(sql, "status = 'redeemed'");
  assertStringIncludes(sql, "get_verified_agent_ids()");
  assertStringIncludes(sql, "RAISE EXCEPTION");

  assertEquals(/last_sign_in_at/i.test(sql), false);

  for (const needle of EXCLUDED) {
    assertEquals(sql.includes(needle), false, `migration must not mention ${needle}`);
  }

  assertEquals(/email_jobs|enqueue|pg_net/i.test(sql), false);
});

/**
 * Static source assertions (DRAFT 3 — NOT DEPLOYED).
 *
 * Guards the schema contract: agent_profiles.id IS the auth user PK, so both
 * submission functions must resolve the canonical identity snapshot by `id`,
 * never by a non-existent `user_id` column. Also guards the classification
 * token on the internal retry runner and the config.toml patch syntax.
 */
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const here = new URL("./", import.meta.url);
const read = (p: string) => Deno.readTextFileSync(new URL(p, here));

for (const fn of ["development-lead-submit", "development-showing-request"]) {
  Deno.test(`${fn} resolves agent_profiles by id`, () => {
    const src = read(`../functions/${fn}/index.ts`);
    const block = src.slice(src.indexOf('.from("agent_profiles")'));
    assert(src.includes('.from("agent_profiles")'), "must query agent_profiles");
    assertStringIncludes(block.slice(0, 400), '.eq("id", user.id)');
    assert(
      !/\.from\("agent_profiles"\)[\s\S]{0,400}\.eq\("user_id"/.test(src),
      "agent_profiles must never be keyed by user_id",
    );
  });
}

Deno.test("retry runner uses an approved auth classification", () => {
  const src = read("../functions/development-notification-retry/index.ts");
  assertStringIncludes(src, "// @auth-classification: internal-cron");
});

Deno.test("config.toml patch has no malformed ++ line", () => {
  const patch = read("../diffs/config.toml.patch");
  assert(!patch.split("\n").some((l) => l === "++"), "literal ++ line is malformed");
});

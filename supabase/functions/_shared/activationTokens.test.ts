import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  activationCanonicalString,
  parseActivationToken,
  sha256Hex,
  signActivationToken,
  verifyActivationToken,
} from "./activationTokens.ts";

const SECRET = "test-secret-do-not-use";
const ID = "3f1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8";
const USER = "11111111-2222-3333-4444-555555555555";
const EXP = 1785000000;

Deno.test("canonical string is pipe-joined with integer epoch", () => {
  assertEquals(
    activationCanonicalString({ id: ID, userId: USER, expiresAtEpoch: EXP }),
    `v1|${ID}|${USER}|${EXP}`,
  );
});

Deno.test("signing is deterministic (retry-safe)", async () => {
  const a = await signActivationToken(SECRET, { id: ID, userId: USER, expiresAtEpoch: EXP });
  const b = await signActivationToken(SECRET, { id: ID, userId: USER, expiresAtEpoch: EXP });
  assertEquals(a, b);
  assertEquals(a.split(".").length, 3);
  assert(a.startsWith(`v1.${ID}.`));
});

// Cross-checked against Postgres: translate(encode(extensions.hmac(canonical, secret, 'sha256'),'base64'),'+/','-_')
Deno.test("fixed vector matches the Postgres hmac() reference", async () => {
  const token = await signActivationToken(SECRET, { id: ID, userId: USER, expiresAtEpoch: EXP });
  assertEquals(token, "v1.3f1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8.UoVHBX0Q_PZ1C6TUNgKxaBZmBNsDl3ZgEEnijGj5QYI");
});

Deno.test("verification rejects a mutated expiry or user", async () => {
  const token = await signActivationToken(SECRET, { id: ID, userId: USER, expiresAtEpoch: EXP });
  assert(await verifyActivationToken(SECRET, token, { id: ID, userId: USER, expiresAtEpoch: EXP }));
  assert(!(await verifyActivationToken(SECRET, token, { id: ID, userId: USER, expiresAtEpoch: EXP + 1 })));
  assert(!(await verifyActivationToken(SECRET, token, { id: ID, userId: ID, expiresAtEpoch: EXP })));
  assert(!(await verifyActivationToken("other-secret", token, { id: ID, userId: USER, expiresAtEpoch: EXP })));
});

Deno.test("parser rejects malformed input", () => {
  assertEquals(parseActivationToken(""), null);
  assertEquals(parseActivationToken("v2.x.y"), null);
  assertEquals(parseActivationToken("v1.not-a-uuid.abcdefghijklmnopqrstuvwx"), null);
  assertEquals(parseActivationToken(`v1.${ID}.short`), null);
  assertEquals(parseActivationToken(`v1.${ID}.abcdefghijklmnopqrstuvwx`)?.id, ID);
});

Deno.test("sha256 hex is 64 lowercase hex chars", async () => {
  const h = await sha256Hex("abc");
  assertEquals(h, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

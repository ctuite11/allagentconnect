/**
 * Unit coverage for post-auth returnTo sanitization (no browser / no credentials).
 * Run: npx tsx e2e/unit/returnToSanitize.test.ts
 */
import assert from "node:assert/strict";

// Inline the production rules so this stays runnable without a Vite TS path build.
// Keep in sync with src/lib/sharedListingGuest.ts

const BLOCKED_POST_AUTH_PATHS = new Set([
  "/pending-verification",
  "/access-error",
  "/auth",
  "/auth/callback",
]);

function sanitizePostAuthRedirectCandidate(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  const cleanPath = path.split(/[?#]/)[0];
  if (BLOCKED_POST_AUTH_PATHS.has(cleanPath)) return null;
  return path;
}

const cases: Array<{ input: string | null; expected: string | null; name: string }> = [
  { name: "internal path", input: "/agent/messages", expected: "/agent/messages" },
  {
    name: "internal path + query",
    input: "/agent/messages?ref=stale-reminder&confirm=1",
    expected: "/agent/messages?ref=stale-reminder&confirm=1",
  },
  { name: "external https", input: "https://evil.example/x", expected: null },
  { name: "protocol-relative", input: "//evil.example/x", expected: null },
  { name: "blocked access-error", input: "/access-error", expected: null },
  { name: "blocked auth", input: "/auth", expected: null },
  { name: "blocked callback", input: "/auth/callback", expected: null },
  { name: "blocked pending", input: "/pending-verification", expected: null },
  { name: "empty", input: "", expected: null },
  { name: "null", input: null, expected: null },
];

let failed = 0;
for (const c of cases) {
  const got = sanitizePostAuthRedirectCandidate(c.input);
  try {
    assert.equal(got, c.expected, c.name);
    console.log(`PASS  ${c.name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL  ${c.name}:`, e);
  }
}

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} sanitize cases passed.`);

#!/usr/bin/env node
/**
 * Security guard (added after the 2026-07-30 seed-backdoor incident).
 *
 * Fails the build when the repository reintroduces any of:
 *   1. A production route named /seed-anything or /test-data, or a Seed / TestData page.
 *   2. An Edge Function that calls `auth.admin.*` without an explicit
 *      authorization classification.
 *   3. A service-role Edge Function performing mutations without an approved
 *      authentication classification.
 *   4. A hardcoded shared password in production source.
 *   5. A production fixture that inserts listings with status "active".
 *
 * A function may declare its authentication model with a single comment line:
 *   // @auth-classification: admin-jwt | user-jwt | token-redemption | webhook | internal-cron | public-read
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const FUNCTIONS_DIR = join(ROOT, "supabase", "functions");
const SRC_DIR = join(ROOT, "src");

// Pre-existing privileged functions accepted at the time of the 2026-07-30
// audit. They still need an explicit @auth-classification; the guard only
// blocks NEW unclassified privileged functions.
let BASELINE = new Set();
try {
  BASELINE = new Set(
    JSON.parse(readFileSync(join(ROOT, "scripts", "security", "privileged-function-baseline.json"), "utf8"))
      .functions,
  );
} catch {
  BASELINE = new Set();
}

const VALID_CLASSIFICATIONS = new Set([
  "admin-jwt",
  "user-jwt",
  "token-redemption",
  "webhook",
  "internal-cron",
  "public-read",
]);

const errors = [];

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry === "__golden__") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// ---- 1. No seed / test-data routes or pages ----
const srcFiles = walk(SRC_DIR).filter((f) => [".ts", ".tsx"].includes(extname(f)));
for (const file of srcFiles) {
  const text = readFileSync(file, "utf8");
  const routeMatch = text.match(/path=["']\/(seed[-\w]*|test-data[\w-]*)["']/i);
  if (routeMatch) {
    errors.push(`${file}: production route "${routeMatch[1]}" is forbidden (seed/test-data route).`);
  }
  if (/pages\/(Seed[\w]*|TestData[\w]*)["']/.test(text)) {
    errors.push(`${file}: imports a seed/test-data page, which must not ship to production.`);
  }
}

// ---- 2-5. Edge Function checks ----
let functionDirs = [];
try {
  functionDirs = readdirSync(FUNCTIONS_DIR).filter(
    (d) => d !== "_shared" && statSync(join(FUNCTIONS_DIR, d)).isDirectory(),
  );
} catch {
  functionDirs = [];
}

for (const name of functionDirs) {
  if (/seed|fixture|test-data|mock|demo/i.test(name)) {
    errors.push(`supabase/functions/${name}: seeding/fixture Edge Functions must not exist in production.`);
  }

  const files = walk(join(FUNCTIONS_DIR, name)).filter((f) => extname(f) === ".ts");
  const source = files.map((f) => readFileSync(f, "utf8")).join("\n");
  if (!source) continue;

  const classification = source.match(/@auth-classification:\s*([a-z-]+)/)?.[1];
  const usesAuthAdmin = /auth\.admin\./.test(source);
  const usesServiceRole = /SUPABASE_SERVICE_ROLE_KEY/.test(source);
  const mutates = /\.(insert|update|upsert|delete)\(/.test(source);
  const checksUser = /auth\.getUser\(/.test(source);
  const checksAdmin = /has_role/.test(source);

  if (usesAuthAdmin && !(checksUser && checksAdmin)) {
    if ((!classification || !VALID_CLASSIFICATIONS.has(classification)) && !BASELINE.has(name)) {
      errors.push(
        `supabase/functions/${name}: uses auth.admin.* without an admin check and without a valid ` +
          `"// @auth-classification: <model>" declaration.`,
      );
    }
  }

  if (usesServiceRole && mutates && !checksUser && !checksAdmin) {
    if ((!classification || !VALID_CLASSIFICATIONS.has(classification)) && !BASELINE.has(name)) {
      errors.push(
        `supabase/functions/${name}: service-role mutating function has no caller validation and no ` +
          `"// @auth-classification: <model>" declaration.`,
      );
    }
  }

  if (
    /seed|fixture|test-data|mock|demo/i.test(name) &&
    /status:\s*["']active["']/.test(source) &&
    /\.insert\(/.test(source) &&
    /listings/.test(source)
  ) {
    errors.push(`supabase/functions/${name}: inserts listings with status "active" — fixtures may not publish listings.`);
  }
}

// ---- 4. Hardcoded shared passwords anywhere in production source ----
const passwordPattern = /(password\s*[:=]\s*["'`])([^"'`\n]{6,})(["'`])/gi;
for (const file of [...srcFiles, ...functionDirs.flatMap((n) => walk(join(FUNCTIONS_DIR, n)))]) {
  if (extname(file) !== ".ts" && extname(file) !== ".tsx") continue;
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(passwordPattern)) {
    const value = match[2];
    if (/Deno\.env|process\.env|\$\{|import\.meta/.test(value)) continue;
    errors.push(`${file}: hardcoded password literal found ("${value.slice(0, 3)}…").`);
  }
}

if (errors.length) {
  console.error("\nSecurity guard failed:\n");
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error(`\n${errors.length} issue(s).\n`);
  process.exit(1);
}

console.log("Security guard passed: no seed backdoors or unclassified privileged functions found.");
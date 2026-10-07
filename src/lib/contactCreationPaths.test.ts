/**
 * LOCKED: every screen that creates a contact must go through
 * resolveOrCreateAgentContact (DB function resolve_or_create_agent_contact).
 * A direct clients insert/upsert anywhere in src/ fails this test.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

const SRC = path.resolve(__dirname, "..");

// Pending explicit decision: saving another AAC agent as a contact is, by
// definition, "an email associated with another member", so the locked rule
// would block it. Remove from this list once the product decision is made.
const PENDING_DECISION = ["components/agent-search/AgentMarketplaceCard.tsx"];

const MIGRATED = [
  "pages/MyClients.tsx",
  "components/ImportClientsDialog.tsx",
  "components/ShareListingDialog.tsx",
  "components/BulkShareListingsDialog.tsx",
  "components/share/PersonalHotSheetShareEmailDialog.tsx",
  "components/CreateHotSheetDialog.tsx",
  "components/SaveToHotSheetDialog.tsx",
  "components/CreateBuyerDialog.tsx",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "integrations" || name === "__tests__") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const DIRECT = /from\(\s*['"]clients['"]\s*\)(?:(?!\.from\()[\s\S]){0,250}?\.(insert|upsert)\(/;

describe("contact creation paths (locked)", () => {
  it("no screen inserts/upserts into clients directly", () => {
    const offenders = walk(SRC)
      .map((f) => path.relative(SRC, f).split(path.sep).join("/"))
      .filter((rel) => !PENDING_DECISION.includes(rel))
      .filter((rel) => DIRECT.test(readFileSync(path.join(SRC, rel), "utf8")));
    expect(offenders).toEqual([]);
  });

  it.each(MIGRATED)("%s uses resolveOrCreateAgentContact", (rel) => {
    expect(readFileSync(path.join(SRC, rel), "utf8")).toContain("resolveOrCreateAgentContact(");
  });

  it("the guard actually detects a direct insert", () => {
    expect(DIRECT.test(`supabase.from("clients").insert({ email })`)).toBe(true);
    expect(DIRECT.test(`supabase.from('clients').upsert(row)`)).toBe(true);
    expect(DIRECT.test(`supabase.from("clients").update({ a: 1 }).eq("id", x)`)).toBe(false);
  });
});

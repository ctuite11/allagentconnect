/**
 * LOCKED: "Save to contacts? → No" creates a real Hot-Sheet-only contact
 * (clients.hidden_from_contacts = true). It is attached by UUID, hidden from
 * normal contact lists/pickers/counts, shown in Hot Sheet Review/Edit and
 * buyer flows, promoted only by an explicit save, and never auto-promoted by
 * invite acceptance. DB behavior: supabase/tests/resolve_or_create_agent_contact.sql.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (["node_modules", "integrations", "__tests__"].includes(name)) continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("Hot-Sheet-only (hidden) contacts — locked", () => {
  it("No path creates a hidden real contact, never a temp- id", () => {
    const src = read("src/components/CreateHotSheetDialog.tsx");
    expect(src).not.toMatch(/temp-\$\{/);
    const noPath = src.slice(src.indexOf("const handleAddClientWithoutSaving"), src.indexOf("const handleAddManualContactClick"));
    expect(noPath).toContain("resolveOrCreateAgentContact(");
    expect(noPath).toMatch(/hidden:\s*true/);
  });

  it("resolver forwards the hidden flag to the authoritative DB function", () => {
    expect(read("src/lib/agentContactResolver.ts")).toMatch(/p_hidden:\s*input\.hidden \?\? false/);
  });

  it("My Clients and all pickers (shared loader) exclude hidden contacts", () => {
    expect(read("src/lib/contactSearch.ts")).toContain('.eq("hidden_from_contacts", false)');
    expect(read("src/pages/MyClients.tsx")).toContain("fetchAllAgentContacts");
  });

  it.each([
    "src/pages/AgentDashboard.tsx",
    "src/hooks/useSuccessHubData.ts",
    "src/components/hot-sheets/AddHotSheetRecipientDialog.tsx",
  ])("%s excludes hidden contacts from agent-facing lists/counts", (rel) => {
    expect(read(rel)).toContain('.eq("hidden_from_contacts", false)');
  });

  it("admin agent panel shows hidden contacts labeled Hot Sheet only", () => {
    const src = read("src/components/admin/AgentEditDrawer.tsx");
    expect(src).toContain("Hot Sheet only");
    expect(src).not.toContain('.eq("hidden_from_contacts", false)');
  });

  it.each([
    "src/pages/HotSheetReview.tsx",
    "src/components/EditHotsheetCriteriaDialog.tsx",
    "src/lib/enqueueHotSheetClientInvites.ts",
    "supabase/functions/process-hot-sheet/index.ts",
  ])("%s keeps including hidden contacts (no hidden filter)", (rel) => {
    expect(read(rel)).not.toContain("hidden_from_contacts");
  });

  it("only explicit saves promote; invite acceptance and backend never do", () => {
    const promoters = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "supabase/functions"))]
      .map((f) => path.relative(ROOT, f).split(path.sep).join("/"))
      .filter((rel) => /hidden_from_contacts:\s*false/.test(read(rel)));
    expect(promoters.sort()).toEqual(["src/components/CreateBuyerDialog.tsx"]);
  });

  it("My Clients lets a hidden contact through to the resolver (promotion), not a duplicate error", () => {
    expect(read("src/pages/MyClients.tsx")).toContain("existing && !existing.hidden_from_contacts");
  });
});

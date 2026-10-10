import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

// Rule (2026-10-10, 16 N Mead St): a never-published Draft leaves Draft ONLY via
// Publish → "Ready to publish?" → "Yes, Publish Listing" → publish_listing().
const root = resolve(__dirname, "..");
const addListing = readFileSync(resolve(root, "pages/AddListing.tsx"), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

describe("Draft → live only through the final confirm click", () => {
  it("publish_listing is called from exactly one place in the app", () => {
    const callers = walk(root)
      .filter((f) => !f.includes("integrations/supabase/types"))
      .filter((f) => readFileSync(f, "utf8").includes('"publish_listing"'));
    expect(callers.map((f) => f.replace(root, ""))).toEqual(["/pages/AddListing.tsx"]);
    expect(addListing.match(/"publish_listing"/g)?.length).toBe(1);
  });

  it("has no reusable confirmation flag", () => {
    expect(addListing).not.toContain("publishConfirmedRef");
  });

  it("only the confirm handler mints the publish operation id", () => {
    expect(addListing.match(/crypto\.randomUUID\(\)/g)?.length).toBe(1);
    const confirm = addListing.indexOf("const handleConfirmPublish = () => {");
    const mint = addListing.indexOf("const publishOpId = crypto.randomUUID();");
    expect(confirm).toBeGreaterThan(-1);
    expect(mint).toBeGreaterThan(confirm);
    expect(mint - confirm).toBeLessThan(300);
  });

  it("never-published listings are written as draft by Save Changes and Publish", () => {
    expect(addListing).toMatch(/neverPublished \|\| \(isAutoSave && backendStatusRef\.current === "draft"\)\s*\?\s*"draft"/);
    expect(addListing).toContain('publishNow && !neverPublished ? statusForPublish : "draft"');
  });

  it("old rental form never inserts a live listing", () => {
    const rental = readFileSync(resolve(root, "pages/AddRentalListing.tsx"), "utf8");
    expect(rental).not.toContain('status: publishNow ? formData.status : "draft"');
  });
});

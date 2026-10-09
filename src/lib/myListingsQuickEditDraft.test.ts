import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Incident 2026-10-09: My Listings Quick Edit published a draft and fired Hot Sheet emails.
// Lock: Quick Edit on a draft is price-only and the save path refuses any status for drafts.
const src = readFileSync(resolve(__dirname, "../pages/MyListings.tsx"), "utf8");

describe("My Listings Quick Edit never publishes a draft", () => {
  it("sends price only for drafts", () => {
    expect(src).toMatch(
      /if \(isDraftListingStatus\(current\.status\)\) \{\s*await onQuickUpdate\(editingId, \{ price: Number\(editPrice\) \}\);/,
    );
  });

  it("hides the status selector for drafts and shows the Publish note", () => {
    expect(src).toMatch(/isDraftListingStatus\(l\.status\) \? \(/);
    expect(src).toContain("Open the listing and click Publish to make a draft live.");
  });

  it("backstop rejects any status update on a draft before the database write", () => {
    const guard = src.indexOf("isDraftListingStatus(current.status) && updates.status !== undefined");
    const write = src.indexOf('supabase.from("listings").update(nextUpdates)');
    expect(guard).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(guard);
  });
});

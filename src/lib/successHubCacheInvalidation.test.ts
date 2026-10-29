import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({}), rpc: () => ({}) } }));

import { isHubMutatingRpc } from "./successHubCacheInvalidation";

describe("Success Hub refresh after actions", () => {
  it("publishing a listing refreshes the Success Hub", () => {
    expect(isHubMutatingRpc("publish_listing")).toBe(true);
  });
  it("finishing a Hot Sheet refreshes the Success Hub", () => {
    expect(isHubMutatingRpc("finalize_hot_sheet")).toBe(true);
  });
  it("creating a contact refreshes the Success Hub", () => {
    expect(isHubMutatingRpc("resolve_or_create_agent_contact")).toBe(true);
  });
  it("existing rules still apply", () => {
    expect(isHubMutatingRpc("create_buyer_hot_sheet")).toBe(true);
    expect(isHubMutatingRpc("admin_delete_agent")).toBe(true);
  });
  it("read-only lookups do not clear the cache", () => {
    expect(isHubMutatingRpc("get_verified_agent_ids")).toBe(false);
    expect(isHubMutatingRpc("publish_listing_preview")).toBe(false);
  });
});

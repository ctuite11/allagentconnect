import { describe, it, expect, vi, beforeEach } from "vitest";

const existing = { clients: new Set<string>(), hot_sheets: new Set<string>() };
let failLookups = false;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: "clients" | "hot_sheets") => ({
      select: () => ({
        in: async (_col: string, ids: string[]) =>
          failLookups
            ? { data: null, error: new Error("boom") }
            : { data: ids.filter((id) => existing[table].has(id)).map((id) => ({ id })), error: null },
      }),
    }),
  },
}));

import { filterStaleInviteTokens } from "./filterStaleInviteTokens";

describe("LOCKED: stale invites never block a first invite", () => {
  beforeEach(() => {
    existing.clients = new Set(["c-live"]);
    existing.hot_sheets = new Set(["hs-live"]);
    failLookups = false;
  });

  it("drops a token whose contact and Hot Sheet were deleted", async () => {
    const out = await filterStaleInviteTokens([
      { id: "t1", payload: { client_id: "c-gone", hot_sheet_id: "hs-gone" } },
    ]);
    expect(out).toHaveLength(0);
  });

  it("keeps a token for a live contact and Hot Sheet", async () => {
    const out = await filterStaleInviteTokens([
      { id: "t2", payload: { client_id: "c-live", hot_sheet_id: "hs-live" } },
    ]);
    expect(out).toHaveLength(1);
  });

  it("keeps legacy tokens without those IDs", async () => {
    const out = await filterStaleInviteTokens([{ id: "t3", payload: { client_email: "a@b.c" } }]);
    expect(out).toHaveLength(1);
  });

  it("fails safe: lookup error drops nothing", async () => {
    failLookups = true;
    const out = await filterStaleInviteTokens([
      { id: "t4", payload: { client_id: "c-gone", hot_sheet_id: "hs-gone" } },
    ]);
    expect(out).toHaveLength(1);
  });
});

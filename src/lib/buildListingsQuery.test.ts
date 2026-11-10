import { describe, expect, it, vi } from "vitest";
import { buildListingsQuery } from "./buildListingsQuery";
import type { SupabaseClient } from "@supabase/supabase-js";

function client() {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "in", "or", "ilike", "gte", "lte", "order"]) query[method] = vi.fn(() => query);
  const from = vi.fn(() => query);
  return { api: { from } as unknown as SupabaseClient, from, query };
}

describe("listing access source", () => {
  it("retains DCMLS publication checks when a buyer searches", () => {
    const { api, from } = client();
    buildListingsQuery(api, { dcmlsOnly: true, statuses: ["active"] }, { buyerScope: true });
    expect(from).toHaveBeenCalledWith("dcmls_listings_public");
    expect(from).not.toHaveBeenCalledWith("buyer_listings");
  });
  it("keeps AAC buyers on their authorized matching source", () => {
    const { api, from } = client();
    buildListingsQuery(api, { statuses: ["active"] }, { buyerScope: true });
    expect(from).toHaveBeenCalledWith("buyer_listings");
  });
  it("keeps an empty status selection empty and uses stored property codes", () => {
    const { api, query } = client();
    buildListingsQuery(api, { statuses: [], propertyTypes: ["single_family", "Multi Family"] });
    expect(query.in).toHaveBeenCalledWith("status", ["__none__"]);
    expect(query.in).toHaveBeenCalledWith("property_type", ["single_family", "multi_family"]);
  });
});

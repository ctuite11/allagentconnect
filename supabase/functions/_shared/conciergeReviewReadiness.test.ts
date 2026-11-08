import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { conciergeReviewReadinessError } from "./conciergeReviewReadiness.ts";

const listing = {
  id: "listing-1",
  agent_id: "agent-1",
  status: "draft",
  address: "100 Main Street",
  city: "Boston",
  state: "MA",
  zip_code: "02110",
  price: 1250000,
  bedrooms: 3,
  bathrooms: 2.5,
  square_feet: 1700,
  creation_source: "admin_concierge",
  creation_request_id: "request-1",
};
const request = {
  id: "request-1",
  agent_id: "agent-1",
  request_type: "listing",
  status: "in_progress",
  photo_paths: [] as string[],
};

Deno.test("only a complete, member-owned, photo-resolved draft can queue review", () => {
  assertEquals(conciergeReviewReadinessError(listing, request), null);
});
Deno.test("private intake photos hold review emails until safe transfer", () => {
  const message = conciergeReviewReadinessError(listing, {
    ...request,
    photo_paths: ["agent-1/request-1/image.jpg"],
  });
  assertEquals(message?.includes("private photos"), true);
});
Deno.test("prevents cross-agent and mismatched request review", () => {
  assertEquals(conciergeReviewReadinessError(listing, { ...request, agent_id: "other" }) !== null, true);
  assertEquals(conciergeReviewReadinessError(listing, { ...request, id: "other" }) !== null, true);
  assertEquals(conciergeReviewReadinessError(listing, { ...request, request_type: "broadcast" }) !== null, true);
});
Deno.test("prevents closed, live and unlinked drafts from sending review", () => {
  assertEquals(conciergeReviewReadinessError(listing, { ...request, status: "declined" }) !== null, true);
  assertEquals(conciergeReviewReadinessError(listing, { ...request, status: "completed" }) !== null, true);
  assertEquals(conciergeReviewReadinessError({ ...listing, status: "active" }, request) !== null, true);
  assertEquals(conciergeReviewReadinessError({ ...listing, creation_request_id: null }, request) !== null, true);
});
Deno.test("rejects incomplete address and missing listing essentials", () => {
  assertEquals(conciergeReviewReadinessError({ ...listing, city: "TBD" }, request) !== null, true);
  assertEquals(conciergeReviewReadinessError({ ...listing, zip_code: "00000" }, request) !== null, true);
  assertEquals(conciergeReviewReadinessError({ ...listing, price: 0 }, request) !== null, true);
  assertEquals(conciergeReviewReadinessError({ ...listing, square_feet: null }, request) !== null, true);
});

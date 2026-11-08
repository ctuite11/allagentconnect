/**
 * Pure fail-closed readiness gate for an agent-owned Concierge request draft.
 *
 * Called before ANY review token or email job is created. Private intake photos
 * must not be silently omitted from the review email or published listing.
 */
export interface ConciergeReviewListing {
  id: string;
  agent_id: string;
  status: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  creation_source: string | null;
  creation_request_id: string | null;
}
export interface ConciergeReviewRequest {
  id: string;
  agent_id: string;
  request_type: string;
  status: string;
  photo_paths: string[] | null;
}

export function conciergeReviewReadinessError(
  listing: ConciergeReviewListing | null,
  request: ConciergeReviewRequest | null,
): string | null {
  if (!listing || listing.creation_source !== "admin_concierge" ||
      listing.status !== "draft" || !listing.creation_request_id) {
    return "This is not a Concierge request draft.";
  }
  if (!request || request.id !== listing.creation_request_id ||
      request.agent_id !== listing.agent_id || request.request_type !== "listing") {
    return "The Concierge request does not match the listing owner.";
  }
  if (request.status === "declined" || request.status === "completed") {
    return "This Concierge request is closed.";
  }
  if (Array.isArray(request.photo_paths) && request.photo_paths.length > 0) {
    return "Agent review is on hold until the submitted private photos are securely attached to the listing.";
  }
  const price = Number(listing.price);
  if (!listing.address || listing.address.trim() === "Draft" ||
      !listing.city || listing.city === "TBD" ||
      !listing.state || !listing.zip_code || listing.zip_code === "00000" ||
      !Number.isFinite(price) || price <= 0 ||
      listing.bedrooms == null || listing.bathrooms == null || listing.square_feet == null) {
    return "Finish the listing address and essential property details before sending for review.";
  }
  return null;
}

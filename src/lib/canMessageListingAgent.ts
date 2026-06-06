/** Prefer listing.agent_id so the CTA stays available before profile fetch completes. */
export function resolveListingAgentId(
  listing: { agent_id?: string | null } | null | undefined,
  profile: { id?: string } | null | undefined,
): string | null {
  return listing?.agent_id ?? profile?.id ?? null;
}

/** In-app message to the listing agent — hidden only when the viewer is that agent. */
export function canMessageListingAgent(
  viewerId: string | null | undefined,
  listingAgentId: string | null | undefined,
): boolean {
  if (!listingAgentId) return false;
  if (!viewerId) return true;
  return viewerId !== listingAgentId;
}

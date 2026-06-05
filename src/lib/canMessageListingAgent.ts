/** In-app message to the listing agent — hidden only when the viewer is that agent. */
export function canMessageListingAgent(
  viewerId: string | null | undefined,
  listingAgentId: string | null | undefined,
): boolean {
  if (!listingAgentId) return false;
  if (!viewerId) return true;
  return viewerId !== listingAgentId;
}

/**
 * Shared visibility filter for listings.
 * Off-market listings are only visible to their owning agent.
 * This must be applied consistently across search count and results display.
 */
export function filterVisibleListings<T extends { status: string; agent_id: string }>(
  listings: T[],
  currentUserId: string | null
): T[] {
  return listings.filter(listing => {
    if (listing.status !== 'off_market') return true;
    return currentUserId != null && listing.agent_id === currentUserId;
  });
}

/**
 * Shared visibility filter for listings.
 * Off-market listings are publicly visible (same as active). This is a
 * pass-through kept for call-site compatibility.
 */
export function filterVisibleListings<T extends { status: string; agent_id: string }>(
  listings: T[],
  _currentUserId: string | null
): T[] {
  return listings;
}

/** Every listing-bearing queued email is reauthorized immediately before send. */
export const PRIVATE_LISTING_TEMPLATES = new Set([
  "listing-share", "bulk-listing-share", "hot-sheet-alert", "new-match-notification",
  "hot-sheet-status-change", "hot-sheet-subscriber-update", "hot-sheet-subscriber-status-change",
  "showing-request", "listing-contact-inquiry", "favorites-share", "price-change-notification",
]);
export const PRIVACY_EMAIL_BLOCKED = "Privacy email blocked:";

export function listingEmailPrivacy(listingIds: string[], hotSheetId: string, audience: "agent" | "external") {
  return { version: 1, listing_ids: listingIds, hot_sheet_id: hotSheetId, audience };
}

// deno-lint-ignore no-explicit-any
export async function listingEmailAllowed(client: any, policy: unknown, to: unknown): Promise<boolean> {
  const recipients = Array.isArray(to) ? to : typeof to === "string" ? to.split(",").map(value => value.trim()).filter(Boolean) : [];
  if (!policy || recipients.length === 0) return false;
  const { data, error } = await client.rpc("privacy_email_delivery_allowed", { p_policy: policy, p_to: recipients });
  return !error && data === true;
}

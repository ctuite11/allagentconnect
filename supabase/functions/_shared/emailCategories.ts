/* ------------------------------------------------------------------ */
/*  Email opt-out classification — single source of truth              */
/* ------------------------------------------------------------------ */
/**
 * An email is "subscription-style" only when it belongs to an opted-in /
 * broadcast stream. Direct 1:1 correspondence (an agent deliberately
 * sharing a listing with one person, agent<->client messages, showing
 * requests) and transactional/security mail (password reset, activation,
 * login links, verification results) are NEVER subscription mail:
 *   - no footer opt-out links
 *   - no List-Unsubscribe / List-Unsubscribe-Post headers
 *   - no suppression check
 *
 * Classification is driven by the delivery type recorded on the job
 * payload's `category`, never by a template name.
 */

/** Categories that represent opted-in / list-based streams. */
export const SUBSCRIPTION_CATEGORIES = new Set<string>([
  "hot_sheet_alerts",
  "marketing",
  "account_reminders",
  "comms_broadcast",
  "comms_digest",
  "member_updates",
  "development_notifications",
  "listing_broadcast",
]);

/**
 * Categories that exist in the system but are explicitly direct /
 * transactional. Listed for documentation and to make an accidental
 * addition to SUBSCRIPTION_CATEGORIES obvious in review.
 */
export const DIRECT_CATEGORIES = new Set<string>([
  "listing_shares", // deliberate 1:1 agent-to-agent / agent-to-client share
  "for_sale",
  "transactional",
  "security",
  "system",
]);

export function isSubscriptionCategory(
  category?: string | null,
): boolean {
  if (!category) return false; // unclassified => treated as direct, fail closed
  if (DIRECT_CATEGORIES.has(category)) return false;
  return SUBSCRIPTION_CATEGORIES.has(category);
}

/** Human label used in the visible "Unsubscribe from X" footer link. */
export function unsubscribeCategoryLabel(category: string): string {
  switch (category) {
    case "hot_sheet_alerts":
      return "hot sheet alerts";
    case "comms_broadcast":
    case "comms_digest":
      return "Communications Center emails";
    case "account_reminders":
      return "account reminders";
    case "member_updates":
      return "member updates";
    case "development_notifications":
      return "new development updates";
    case "listing_broadcast":
      return "listing notifications";
    default:
      return "marketing emails";
  }
}

/** Deep link to the signed-in Communications preferences area. */
export const MANAGE_EMAIL_PREFERENCES_URL =
  "https://allagentconnect.com/communications?prefs=1";

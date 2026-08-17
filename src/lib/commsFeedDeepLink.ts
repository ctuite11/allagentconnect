/**
 * Communications Feed deep-link helpers.
 *
 * Email/digest attachment CTAs link to `/communications/feed?broadcast=<id>`.
 * The feed uses these helpers to decide which broadcast to scroll to and
 * highlight. With no `broadcast` param the feed behaves exactly as before.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const COMMS_FEED_PATH = "/communications/feed";

/** Returns a validated broadcast id, or null when absent/malformed. */
export function parseBroadcastParam(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value || !UUID_RE.test(value)) return null;
  return value.toLowerCase();
}

/** Relative feed path for a broadcast; general feed when no id is given. */
export function buildCommsBroadcastPath(broadcastId?: string | null): string {
  const id = parseBroadcastParam(broadcastId);
  return id ? `${COMMS_FEED_PATH}?broadcast=${encodeURIComponent(id)}` : COMMS_FEED_PATH;
}

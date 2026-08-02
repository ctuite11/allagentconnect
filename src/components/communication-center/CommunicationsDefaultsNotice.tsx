type Props = { userId?: string | null | undefined };

/**
 * Retired (Aug 2026 opt-in policy).
 *
 * Comms Center email channels are OFF until an agent explicitly enables one,
 * so the old "channels are on by default" notice is obsolete and must never
 * render again. Kept as an inert no-op so existing imports stay valid.
 */
export function CommunicationsDefaultsNotice(_props: Props) {
  return null;
}
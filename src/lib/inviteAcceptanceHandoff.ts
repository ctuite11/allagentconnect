/**
 * Cross-page handoff for client hot sheet invite acceptance.
 *
 * ClientInvitationSetup writes a timestamp marker (and optional hot sheet id)
 * to sessionStorage immediately after a successful accept. The dashboard reads
 * it on mount to trigger an extra hydration pass and (optionally) seed the
 * expected hot sheet id so the empty-state never flashes when RLS lags.
 */

const TS_KEY = "aac_invite_acceptance_handoff";
const ID_KEY = "aac_invite_acceptance_hot_sheet_id";
const MAX_AGE_MS = 10 * 60 * 1000;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function markInviteAcceptance(hotSheetId?: string | null): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.setItem(TS_KEY, String(Date.now()));
    if (hotSheetId) {
      sessionStorage.setItem(ID_KEY, String(hotSheetId));
    } else {
      sessionStorage.removeItem(ID_KEY);
    }
  } catch {
    // ignore quota/permission failures
  }
}

/** Read without clearing — safe for retry loops. */
export function peekInviteAcceptance(): { fresh: boolean; hotSheetId: string | null } {
  if (!isBrowser()) return { fresh: false, hotSheetId: null };
  const raw = sessionStorage.getItem(TS_KEY);
  if (!raw) return { fresh: false, hotSheetId: null };
  const ts = Number(raw);
  const fresh = Number.isFinite(ts) && Date.now() - ts >= 0 && Date.now() - ts <= MAX_AGE_MS;
  const hotSheetId = sessionStorage.getItem(ID_KEY);
  return { fresh, hotSheetId: hotSheetId || null };
}

/** Read once and clear. */
export function consumeInviteAcceptance(): { fresh: boolean; hotSheetId: string | null } {
  const value = peekInviteAcceptance();
  if (!isBrowser()) return value;
  try {
    sessionStorage.removeItem(TS_KEY);
    sessionStorage.removeItem(ID_KEY);
  } catch {
    // ignore
  }
  return value;
}
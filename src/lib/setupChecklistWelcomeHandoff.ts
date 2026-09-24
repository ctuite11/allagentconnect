/**
 * One-time post-activation handoff for the Member Setup Checklist.
 *
 * Set when activation itself has completed (not only after auto sign-in).
 * Consumed on the first checklist appearance for that same account → Welcome
 * copy once; later appearances use reminder copy.
 *
 * Scoped per account (user id and/or email) so another signed-in account in
 * the same browser session cannot consume a different agent's handoff.
 * No DB field / no time window.
 */

export const SETUP_CHECKLIST_WELCOME_KEY_PREFIX = "aac_setup_checklist_welcome";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function userIdKey(userId: string): string {
  return `${SETUP_CHECKLIST_WELCOME_KEY_PREFIX}:uid:${userId}`;
}

function emailKey(email: string): string {
  return `${SETUP_CHECKLIST_WELCOME_KEY_PREFIX}:email:${normalizeEmail(email)}`;
}

export type SetupChecklistWelcomeIdentity = {
  userId?: string | null;
  email?: string | null;
};

/** Call once activation has succeeded (after clearRecoveryState when applicable). */
export function markSetupChecklistWelcome(identity: SetupChecklistWelcomeIdentity): void {
  if (!isBrowser()) return;
  try {
    const userId = identity.userId?.trim();
    const email = identity.email?.trim();
    if (userId) {
      sessionStorage.setItem(userIdKey(userId), "1");
    }
    if (email) {
      sessionStorage.setItem(emailKey(email), "1");
    }
  } catch {
    // ignore quota/permission failures
  }
}

/**
 * Read-and-clear for this account only. Returns true when a matching handoff
 * was present. Keys belonging to other accounts are left untouched.
 */
export function consumeSetupChecklistWelcome(
  userId: string,
  email?: string | null,
): boolean {
  if (!isBrowser() || !userId) return false;
  try {
    let hit = false;
    const uid = userIdKey(userId);
    if (sessionStorage.getItem(uid) === "1") {
      sessionStorage.removeItem(uid);
      hit = true;
    }
    const rawEmail = email?.trim();
    if (rawEmail) {
      const ek = emailKey(rawEmail);
      if (sessionStorage.getItem(ek) === "1") {
        sessionStorage.removeItem(ek);
        hit = true;
      }
    }
    // Clear legacy unscoped key only when this consume hits, so an older
    // handoff from before scoping still works once for the first viewer.
    if (hit) {
      sessionStorage.removeItem(SETUP_CHECKLIST_WELCOME_KEY_PREFIX);
    }
    return hit;
  } catch {
    return false;
  }
}

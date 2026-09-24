/**
 * One-time post-activation handoff for the Member Setup Checklist.
 *
 * Set on successful activation completion (after clearRecoveryState).
 * Consumed on the first checklist appearance → Welcome copy once; later
 * appearances use reminder copy. No DB field / no time window.
 */

export const SETUP_CHECKLIST_WELCOME_KEY = "aac_setup_checklist_welcome";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

/** Call after successful activation (after clearRecoveryState, before navigate). */
export function markSetupChecklistWelcome(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.setItem(SETUP_CHECKLIST_WELCOME_KEY, "1");
  } catch {
    // ignore quota/permission failures
  }
}

/**
 * Read-and-clear. Returns true only for the first consumer after activation.
 * Subsequent calls return false.
 */
export function consumeSetupChecklistWelcome(): boolean {
  if (!isBrowser()) return false;
  try {
    const present = sessionStorage.getItem(SETUP_CHECKLIST_WELCOME_KEY) === "1";
    if (present) {
      sessionStorage.removeItem(SETUP_CHECKLIST_WELCOME_KEY);
    }
    return present;
  } catch {
    return false;
  }
}

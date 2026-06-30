/**
 * Centralized cleanup for recovery / password-setup session markers.
 *
 * Called after a successful password update (License Verified setup OR
 * forgot-password reset) and from the global `USER_UPDATED` auth listener.
 * After this runs, the session is treated as a normal authenticated session
 * and no code path can re-route the agent back into a password form.
 */
export function clearRecoveryState(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem("aac_recovery_flow");
    sessionStorage.removeItem("aac_password_setup_flow");
    sessionStorage.removeItem("aac_agent_setup_handoff");
    sessionStorage.removeItem("aac_agent_setup_user_id");
    sessionStorage.removeItem("aac_agent_setup_email");
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("aac_processed_recovery_")) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // best-effort
  }
}

/**
 * True only when the current browser is mid-recovery / mid-setup.
 * Used by AuthCallback to decide whether to short-circuit to a password
 * form instead of routing the user normally.
 */
export function hasActiveRecoveryFlow(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem("aac_recovery_flow") === "1";
}

export function hasActiveSetupFlow(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem("aac_password_setup_flow") === "1";
}
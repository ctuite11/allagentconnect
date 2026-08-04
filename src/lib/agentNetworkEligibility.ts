/**
 * Agent Network individual-agent eligibility (mirrors DB RPCs).
 *
 * Frontend continues to load individuals via get_verified_agent_ids().
 * This module exists for regression tests and audit classification only —
 * do not invent a second independent frontend gate in Step 1.
 */

export type AgentNetworkEligibilityInput = {
  authUserExists: boolean;
  hasAgentRole: boolean;
  hasAgentProfile: boolean;
  agentStatus: string | null | undefined;
  accountActivatedAt: string | null | undefined;
  hideFromDirectory: boolean | null | undefined;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  /** Invalid fallback under the old production rule — never activation evidence. */
  company?: string | null | undefined;
  /** Never required; never an alternative to activation. */
  headshotUrl?: string | null | undefined;
};

export type AgentNetworkExclusionReason =
  | "missing_auth_user"
  | "missing_agent_role"
  | "missing_agent_profile"
  | "not_verified"
  | "not_activated"
  | "hidden_from_directory"
  | "missing_or_blank_name"
  | null;

function nonblank(value: string | null | undefined): boolean {
  return Boolean((value ?? "").trim());
}

/**
 * Current production rule (pre-containment): company can substitute for activation.
 * Reconstructs get_verified_agent_ids as of 20260718034557 / 20260718033500.
 * Does not require auth.users (matches live RPC).
 */
export function passesLegacyAgentNetworkRule(input: AgentNetworkEligibilityInput): boolean {
  if (!input.hasAgentRole) return false;
  if (!input.hasAgentProfile) return false;
  if (input.agentStatus !== "verified") return false;
  if (input.hideFromDirectory) return false;
  if (!nonblank(input.firstName) || !nonblank(input.lastName)) return false;
  if (input.accountActivatedAt != null && String(input.accountActivatedAt).trim() !== "") {
    return true;
  }
  return nonblank(input.company);
}

/**
 * Corrected containment rule (Step 1 migration).
 * Requires auth.users + account_activated_at; never company/headshot.
 */
export function passesCorrectedAgentNetworkRule(input: AgentNetworkEligibilityInput): boolean {
  return correctedAgentNetworkExclusionReason(input) === null;
}

export function correctedAgentNetworkExclusionReason(
  input: AgentNetworkEligibilityInput,
): AgentNetworkExclusionReason {
  if (!input.authUserExists) return "missing_auth_user";
  if (!input.hasAgentRole) return "missing_agent_role";
  if (!input.hasAgentProfile) return "missing_agent_profile";
  if (input.agentStatus !== "verified") return "not_verified";
  if (input.accountActivatedAt == null || String(input.accountActivatedAt).trim() === "") {
    return "not_activated";
  }
  if (input.hideFromDirectory) return "hidden_from_directory";
  if (!nonblank(input.firstName) || !nonblank(input.lastName)) {
    return "missing_or_blank_name";
  }
  return null;
}

/** Classify agents that pass the legacy rule but fail the corrected rule. */
export type CleanupClassificationGroup =
  | "password_setup_appears_complete_missing_activation"
  | "no_password_setup_evidence"
  | "missing_role_profile_settings_or_auth"
  | "duplicate_test_orphan_or_suspicious";

export type CleanupClassificationInput = AgentNetworkEligibilityInput & {
  encryptedPasswordPresent: boolean;
  lastSignInAt: string | null | undefined;
  matchedDeletedUsersArchive: boolean;
  emailLooksLikeTest: boolean;
};

export function classifyLegacyOnlyAgent(
  input: CleanupClassificationInput,
): CleanupClassificationGroup {
  if (
    input.matchedDeletedUsersArchive ||
    input.emailLooksLikeTest ||
    (!input.authUserExists && input.hasAgentProfile)
  ) {
    return "duplicate_test_orphan_or_suspicious";
  }

  if (
    !input.authUserExists ||
    !input.hasAgentRole ||
    !input.hasAgentProfile ||
    input.agentStatus !== "verified"
  ) {
    return "missing_role_profile_settings_or_auth";
  }

  const setupEvidence =
    input.encryptedPasswordPresent ||
    (input.lastSignInAt != null && String(input.lastSignInAt).trim() !== "");

  if (setupEvidence) {
    return "password_setup_appears_complete_missing_activation";
  }
  return "no_password_setup_evidence";
}

import {
  getCurrentSenderProfile,
  type SenderProfile,
  type SenderProfileSource,
} from "@/lib/currentSenderProfile";

/** @deprecated Prefer `SenderProfile` from `@/lib/currentSenderProfile`. */
export type AgentSenderProfile = SenderProfile;

/** Agent-table sender prefill — use `getCurrentSenderProfile({ source: "auto" })` when role may vary. */
export async function fetchAgentSenderProfile(): Promise<AgentSenderProfile | null> {
  return getCurrentSenderProfile({ source: "agent" });
}

export type { SenderProfile, SenderProfileSource };

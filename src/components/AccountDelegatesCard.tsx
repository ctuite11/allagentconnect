import { AssistantSection } from "@/components/AssistantSection";

/**
 * Personal-account Assistant section for Agent Settings.
 * Same underlying records as Agent Edit Profile (personal scope).
 */
export function AccountDelegatesCard() {
  return <AssistantSection scope={{ kind: "agent" }} />;
}

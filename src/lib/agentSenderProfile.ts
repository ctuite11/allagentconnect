import { supabase } from "@/integrations/supabase/client";
import { displayNameFromProfile } from "@/lib/buyerProfile";

export type AgentSenderProfile = {
  name: string;
  email: string;
  phone: string;
};

/** Sender fields for agent-side contact/share dialogs (`agent_profiles` + auth session). */
export async function fetchAgentSenderProfile(): Promise<AgentSenderProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("agent_profiles")
    .select("first_name, last_name, email, phone, cell_phone")
    .eq("id", user.id)
    .maybeSingle();

  const metadataName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";
  const name =
    displayNameFromProfile(profile?.first_name, profile?.last_name, metadataName || user.email) ||
    metadataName ||
    user.email?.split("@")[0] ||
    "";

  return {
    name,
    email: profile?.email?.trim() || user.email || "",
    phone: (profile?.cell_phone || profile?.phone || "").trim(),
  };
}

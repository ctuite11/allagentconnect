import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveUserRole } from "@/lib/resolveUserRole";

function displayNameFromProfile(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  emailFallback?: string | null,
): string {
  const display = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ").trim();
  return display || (typeof emailFallback === "string" ? emailFallback.trim() : "") || "";
}

/** Normalized sender fields for AAC email composers (name, email, phone). */
export type SenderProfile = {
  /** Full display name (first + last, with auth fallbacks). */
  name: string;
  firstName: string;
  email: string;
  phone: string;
};

export type SenderProfileSource = "auto" | "agent" | "buyer";

export type GetCurrentSenderProfileOptions = {
  /**
   * `auto` (default): buyers → `profiles`, agents/admins → `agent_profiles`,
   * unknown → `agent_profiles` when a row exists, else `profiles`.
   * `agent` / `buyer` force a specific table (e.g. buyer dashboard share).
   */
  source?: SenderProfileSource;
};

function authMetadataDisplayName(user: { user_metadata?: Record<string, unknown>; email?: string | null }) {
  return typeof user.user_metadata?.display_name === "string"
    ? user.user_metadata.display_name.trim()
    : "";
}

function buildSenderProfile(params: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  authEmail?: string | null;
  metadataDisplayName?: string;
}): SenderProfile {
  const metadataName = params.metadataDisplayName?.trim() || "";
  const name =
    displayNameFromProfile(params.firstName, params.lastName, metadataName || params.authEmail) ||
    metadataName ||
    params.authEmail?.split("@")[0] ||
    "";

  const firstName = params.firstName?.trim() || name.split(/\s+/)[0] || "";

  return {
    name,
    firstName,
    email: (typeof params.email === "string" ? params.email.trim() : "") || params.authEmail || "",
    phone: (typeof params.phone === "string" ? params.phone.trim() : "") || "",
  };
}

async function senderFromAgentProfiles(
  userId: string,
  authEmail?: string | null,
  metadataDisplayName?: string,
): Promise<SenderProfile> {
  const { data: profile } = await supabase
    .from("agent_profiles")
    .select("first_name, last_name, email, phone, cell_phone")
    .eq("id", userId)
    .maybeSingle();

  const phone =
    (typeof profile?.cell_phone === "string" && profile.cell_phone.trim()) ||
    (typeof profile?.phone === "string" && profile.phone.trim()) ||
    "";

  return buildSenderProfile({
    firstName: profile?.first_name,
    lastName: profile?.last_name,
    email: profile?.email,
    phone,
    authEmail,
    metadataDisplayName,
  });
}

async function senderFromBuyerProfiles(
  userId: string,
  authEmail?: string | null,
  metadataDisplayName?: string,
): Promise<SenderProfile> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, phone")
    .eq("id", userId)
    .maybeSingle();

  return buildSenderProfile({
    firstName: profile?.first_name,
    lastName: profile?.last_name,
    email: profile?.email,
    phone: profile?.phone,
    authEmail,
    metadataDisplayName,
  });
}

/**
 * Resolve the signed-in user's sender identity for email composers.
 * Priority: profile first/last name → profile email → profile phone → auth session email.
 */
export async function getCurrentSenderProfile(
  options: GetCurrentSenderProfileOptions = {},
): Promise<SenderProfile | null> {
  const source = options.source ?? "auto";

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const metadataName = authMetadataDisplayName(user);

  if (source === "agent") {
    return senderFromAgentProfiles(user.id, user.email, metadataName);
  }
  if (source === "buyer") {
    return senderFromBuyerProfiles(user.id, user.email, metadataName);
  }

  const { role } = await resolveUserRole(user.id);
  if (role === "buyer") {
    return senderFromBuyerProfiles(user.id, user.email, metadataName);
  }
  if (role === "agent" || role === "admin") {
    return senderFromAgentProfiles(user.id, user.email, metadataName);
  }

  const { data: agentRow } = await supabase
    .from("agent_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (agentRow) {
    return senderFromAgentProfiles(user.id, user.email, metadataName);
  }
  return senderFromBuyerProfiles(user.id, user.email, metadataName);
}

/** Prefill sender fields when a composer dialog opens. */
export function useSenderProfilePrefill(
  open: boolean,
  onSender: (sender: SenderProfile) => void,
  source: SenderProfileSource = "auto",
) {
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getCurrentSenderProfile({ source }).then((sender) => {
      if (!cancelled && sender) onSender(sender);
    });
    return () => {
      cancelled = true;
    };
  }, [open, source, onSender]);
}

import { supabase } from "@/integrations/supabase/client";

export const AGENT_ACTIVATION_SUPPORT_EMAIL = "hello@allagentconnect.com";

/** Shown when a verified agent signs in before completing License Verified activation. */
export const VERIFIED_AGENT_SIGNIN_HINT =
  "This sign-in didn't work. If you haven't activated your account yet, use the setup link from your License Verified email — don't use this sign-in form until your password is set. If you've already activated, check your password or use Forgot password.";

/**
 * Best-effort check: email belongs to a verified agent (public agent_profiles +
 * get_verified_agent_ids RPC). Used only to improve sign-in error copy; does not
 * reveal whether a password has been set.
 */
export async function isVerifiedAgentEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return false;

  try {
    const { data: profile, error: profileError } = await supabase
      .from("agent_profiles")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();

    if (profileError || !profile?.id) return false;

    const { data: verifiedRows, error: verifiedError } =
      await supabase.rpc("get_verified_agent_ids");

    if (verifiedError || !verifiedRows?.length) return false;

    return verifiedRows.some((row) => row.user_id === profile.id);
  } catch {
    return false;
  }
}

import { SupabaseClient } from "@supabase/supabase-js";

interface EnforceClientIdentityParams {
  supabase: SupabaseClient;
  clientEmailFromToken: string | null;
  setCurrentUser: (user: any) => void;
  setShowLoginPrompt: (show: boolean) => void;
}

/**
 * Centralized identity enforcement for client hotsheet pages.
 * 
 * RULE: Only the client whose email is in the invitation token 
 * can access the hotsheet directly without the onboarding popup.
 * 
 * Everyone else (agents, other clients, anonymous users) must either:
 * - See the onboarding popup
 * - OR be logged out and then onboarded correctly
 */
export async function enforceClientIdentity({
  supabase,
  clientEmailFromToken,
  setCurrentUser,
  setShowLoginPrompt,
}: EnforceClientIdentityParams): Promise<any> {
  const { data } = await supabase.auth.getUser();
  const user = data?.user || null;
  setCurrentUser(user);

  // Case 1: No client email in token → treat as anonymous client → show onboarding
  if (!clientEmailFromToken) {
    console.log("No client_email in token - showing onboarding popup");
    setShowLoginPrompt(true);
    return null;
  }

  // Case 2: There is a logged-in user
  if (user && user.email) {
    if (user.email.toLowerCase() === clientEmailFromToken.toLowerCase()) {
      // Correct client is logged in → allow access, no popup
      console.log("Correct client logged in - skipping popup");
      setShowLoginPrompt(false);
      return user;
    } else {
      // Logged in as wrong person (agent or other client) → show popup WITHOUT signing out
      // IMPORTANT: Do NOT call signOut() here - it causes global logout across all tabs
      // which can corrupt sessions in other pages like AddListing
      console.warn(
        `Logged in as different user (${user.email}) than client_email in token (${clientEmailFromToken}). Showing onboarding prompt.`
      );
      // Let the user manually decide to logout - don't force it
      setShowLoginPrompt(true);
      return null;
    }
  }

  // Case 3: No logged-in user, but we have a client_email in token
  // → Show luxury onboarding popup so they can create/login
  console.log("No user logged in but token has client_email - showing onboarding popup");
  setShowLoginPrompt(true);
  return null;
}

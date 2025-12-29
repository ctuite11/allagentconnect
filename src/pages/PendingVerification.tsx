import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { authDebug, checkIsAdmin, getAgentStatus } from "@/lib/authDebug";

const POLL_INTERVAL_MS = 5000;

const PendingVerification = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const didNavigate = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const emailSentRef = useRef(false);

  // Send pending approval email via Netlify function
  const sendPendingApprovalEmail = async (email: string, firstName?: string, lastName?: string) => {
    if (emailSentRef.current) return; // Only send once
    emailSentRef.current = true;
    
    try {
      const resp = await fetch("/api/send-pending-approval-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName }),
      });
      const data = await resp.json();
      if (!data.ok) {
        console.error("[PENDING] Failed to send approval email:", data.error);
      } else {
        console.log("[PENDING] Pending approval email sent");
      }
    } catch (err) {
      console.error("[PENDING] Error sending pending approval email:", err);
    }
  };

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 5;

    const checkStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Mobile browsers need extra time for session to persist
      if (!session?.user && attempts < maxAttempts) {
        attempts++;
        authDebug("PendingVerification no session", { attempt: attempts, maxAttempts });
        setTimeout(checkStatus, 500);
        return;
      }
      
      // After retries, if still no session, show the page anyway
      // User just completed signup - don't kick them back to login
      if (!session?.user) {
        authDebug("PendingVerification", { action: "no_session_showing_page" });
        setLoading(false);
        return;
      }

      const userId = session.user.id;
      const email = session.user.email || null;

      // Store the user's email for display
      setUserEmail(email);
      
      authDebug("PendingVerification checking status", { userId, email });

      // PRIORITY 1: Check if user is admin using has_role RPC - bypass pending screen entirely
      // This MUST happen before any agent status checks
      const adminResult = await checkIsAdmin(userId);
      authDebug("PendingVerification admin check", { userId, isAdmin: adminResult.isAdmin, error: adminResult.error });

      if (adminResult.isAdmin === true) {
        authDebug("PendingVerification", { action: "admin_redirect" });
        // Clear polling immediately for admins
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (!didNavigate.current) {
          didNavigate.current = true;
          navigate("/admin/approvals", { replace: true });
        }
        return; // HARD STOP - never continue to agent logic for admins
      }

      // PRIORITY 2: Check agent status (only for non-admins)
      const agentResult = await getAgentStatus(userId);
      authDebug("PendingVerification agent status", { userId, status: agentResult.status, error: agentResult.error });
      
      const status = agentResult.status || 'unverified';

      if (status === 'verified') {
        // Show approval message briefly, then redirect
        authDebug("PendingVerification", { action: "verified_redirect" });
        setIsApproved(true);
        setLoading(false);
        
        // Clear polling
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        
        // Redirect after brief delay to show the approval message
        setTimeout(() => {
          if (!didNavigate.current) {
            didNavigate.current = true;
            navigate("/agent-dashboard", { replace: true });
          }
        }, 2000);
        return;
      }

      // If pending/unverified, send the pending approval email (once)
      if (email && (status === 'pending' || status === 'unverified')) {
        let firstName: string | undefined;
        let lastName: string | undefined;
        
        try {
          const { data: profile } = await supabase
            .from('agent_profiles')
            .select('first_name, last_name')
            .eq('id', userId)
            .maybeSingle();
          firstName = profile?.first_name ?? undefined;
          lastName = profile?.last_name ?? undefined;
        } catch (err) {
          authDebug("PendingVerification profile fetch error", { error: err instanceof Error ? err.message : "Unknown" });
        }
        
        sendPendingApprovalEmail(email, firstName, lastName);
      }

      setLoading(false);
    };

    // Initial check
    checkStatus();

    // Set up polling for status changes
    pollIntervalRef.current = setInterval(checkStatus, POLL_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Show approval message before redirect
  if (isApproved) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-xl">
            <div className="rounded-2xl p-8 md:p-10 text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-9 w-9 text-emerald-600" />
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-3">
                You're approved.
              </h1>
              <p className="text-slate-600 text-base mb-6">
                Taking you in…
              </p>
              <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          <div className="rounded-2xl p-8 md:p-10">
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-3">
                Almost there.
              </h1>
              <p className="text-slate-600 text-base leading-relaxed">
                Thanks for your request. We'll email you as soon as your license verification is complete.
              </p>
              {userEmail && (
                <p className="text-slate-500 text-sm mt-4 font-medium">
                  Signed in as: {userEmail}
                </p>
              )}
            </div>

            <Button 
              onClick={handleLogout} 
              className="w-full bg-slate-900 text-white hover:bg-slate-800 h-11"
            >
              Done for now
            </Button>

            <p className="text-center text-slate-500 text-xs mt-6">
              Questions? Email us at hello@allagentconnect.com
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PendingVerification;

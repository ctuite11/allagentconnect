import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { authDebug, getAgentStatus } from "@/lib/authDebug";
import NetworkGlobe from "@/components/home/NetworkGlobe";

const POLL_INTERVAL_MS = 5000;

const PendingVerification = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
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

      // ═══════════════════════════════════════════════════════════════════════
      // PRIORITY 1 (HARD GATE): Admin check using has_role RPC
      // Admin users MUST NEVER see /pending-verification under ANY condition.
      // If admin, immediately redirect and TERMINATE - no polling, no agent logic.
      // ═══════════════════════════════════════════════════════════════════════
      const { data: isAdmin, error: adminError } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });

      authDebug("PendingVerification has_role(admin)", {
        email,
        userId,
        isAdmin,
        adminError: adminError?.message ?? null,
      });

      if (isAdmin === true) {
        authDebug("PendingVerification ADMIN_REDIRECT", { action: "terminal_redirect" });
        // IMMEDIATELY clear polling and redirect - no further logic
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (!didNavigate.current) {
          didNavigate.current = true;
          navigate("/admin/approvals", { replace: true });
        }
        return; // ═══ HARD STOP ═══ Admin NEVER touches agent logic
      }
      // ═══════════════════════════════════════════════════════════════════════

      // PRIORITY 2: Check agent status (only for non-admins)
      const agentResult = await getAgentStatus(userId);
      authDebug("PendingVerification agent status", { userId, status: agentResult.status, error: agentResult.error });
      
      // Handle fatal errors: 404 = table not exposed / wrong backend (NOT RLS)
      // Check error.status first if available, then fallback to message patterns
      if (agentResult.error) {
        // Try to parse structured error info from the error string
        const errStr = agentResult.error;
        const is404 = 
          errStr.includes('404') || 
          errStr.toLowerCase().includes('not found') || 
          errStr.toLowerCase().includes('relation') || 
          errStr.toLowerCase().includes('does not exist');
        
        if (is404) {
          authDebug("PendingVerification FATAL 404", { error: agentResult.error });
          setFatalError("Configuration error: agent_settings table not found in API. Contact support.");
          setLoading(false);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          return;
        }
      }
      
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

  const handleAcknowledge = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  // Show fatal error screen - stops all polling
  if (fatalError) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-xl">
            <div className="rounded-2xl p-8 md:p-10 text-center bg-white">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-red-600 text-2xl">⚠</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 mb-3">
                Configuration Error
              </h1>
              <p className="text-zinc-600 text-base mb-4">
                {fatalError}
              </p>
              <p className="text-zinc-500 text-sm mb-6">
                Please contact support at hello@allagentconnect.com
              </p>
              <Button 
                onClick={handleAcknowledge} 
                className="w-full bg-zinc-900 text-white hover:bg-zinc-800 h-11"
              >
                Log Out
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Show approval message before redirect
  if (isApproved) {
    return (
      <div className="min-h-screen flex flex-col relative bg-white">
        {/* Ambient globe - desaturated */}
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ 
            opacity: 0.12,
            filter: 'saturate(0.5)',
          }}
        >
          <div className="w-[300px] h-[300px]">
            <NetworkGlobe />
          </div>
        </div>
        
        <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-xl">
            <div className="rounded-2xl p-8 md:p-10 text-center">
              <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 mb-3">
                You're approved.
              </h1>
              <p className="text-zinc-600 text-base mb-6">
                Taking you in…
              </p>
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400 mx-auto" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative bg-white">
      {/* Near-invisible background wash */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundColor: 'hsl(93 50% 96% / 0.3)',
        }}
      />
      
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          {/* Centered ambient globe - above headline */}
          <div className="mx-auto mb-8 w-[160px] h-[160px]">
            <NetworkGlobe variant="ambient" />
          </div>
          
          {/* Headline - strongest element */}
          <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 mb-3">
            Almost there.
          </h1>
          
          {/* Single email line */}
          {userEmail && (
            <p className="text-sm text-zinc-600">
              You'll receive a confirmation email at{" "}
              <span className="text-zinc-700">{userEmail}</span>{" "}
              once verification is complete.
            </p>
          )}

          {/* Disabled status button */}
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="mt-6 w-full max-w-md rounded-full bg-zinc-900 text-white py-3 text-sm font-medium opacity-90 cursor-default"
          >
            Verification in progress
          </button>

          {/* Support email */}
          <p className="text-zinc-400 text-xs mt-6">
            Questions? Reach us anytime at{" "}
            <a href="mailto:hello@allagentconnect.com" className="hover:text-zinc-500 transition-colors">
              hello@allagentconnect.com
            </a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default PendingVerification;

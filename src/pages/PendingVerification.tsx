import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";


const POLL_INTERVAL_MS = 5000;

const PendingVerification = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const didNavigate = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 5;

    const checkStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Mobile browsers need extra time for session to persist
      if (!session?.user && attempts < maxAttempts) {
        attempts++;
        console.log(`[PENDING] No session yet, retry ${attempts}/${maxAttempts}`);
        setTimeout(checkStatus, 500);
        return;
      }
      
      // After retries, if still no session, show the page anyway
      // User just completed signup - don't kick them back to login
      if (!session?.user) {
        console.log('[PENDING] No session after retries, showing pending page');
        setLoading(false);
        return;
      }

      // Check agent status
      const { data: settings } = await supabase
        .from('agent_settings')
        .select('agent_status')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const status = settings?.agent_status || 'unverified';
      console.log('[PENDING] Agent status:', status);

      if (status === 'verified') {
        // Show approval message briefly, then redirect
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

      // If unverified (no settings record yet), stay on this page
      // The registration creates settings with 'pending' status
      
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

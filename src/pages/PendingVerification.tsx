import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Logo } from "@/components/brand";

const POLL_INTERVAL_MS = 5000;

const PendingVerification = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const didNavigate = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        if (!didNavigate.current) {
          didNavigate.current = true;
          navigate("/auth", { replace: true });
        }
        return;
      }

      // Check agent status
      const { data: settings } = await supabase
        .from('agent_settings')
        .select('agent_status')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const status = settings?.agent_status || 'unverified';

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
        <header className="py-6 px-6 border-b border-slate-200/70 bg-white">
          <div className="max-w-xl mx-auto">
            <Logo size="md" />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-xl">
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-8 md:p-10 text-center">
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
      <header className="py-6 px-6 border-b border-slate-200/70 bg-white">
        <div className="max-w-xl mx-auto">
          <Logo size="md" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-8 md:p-10">
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-3">
                Almost there.
              </h1>
              <p className="text-slate-600 text-base leading-relaxed">
                We're verifying your license to keep our network trusted and agent-only.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-5 mb-8 border border-slate-100">
              <p className="text-slate-600 text-sm leading-relaxed text-center">
                Most verifications are completed quickly. We'll email you as soon as you're approved.
              </p>
            </div>

            <Button 
              onClick={handleLogout} 
              className="w-full bg-slate-900 text-white hover:bg-slate-800 h-11"
            >
              Done for now
            </Button>

            <p className="text-center text-slate-400 text-xs mt-4">
              This will log you out until verification is complete.
            </p>

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

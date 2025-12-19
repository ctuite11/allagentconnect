import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds

const PendingVerification = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [resending, setResending] = useState(false);
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

      if (status === 'unverified') {
        if (!didNavigate.current) {
          didNavigate.current = true;
          navigate("/onboarding/verify-license", { replace: true });
        }
        return;
      }

      // Get first name for personalization
      const { data: profile } = await supabase
        .from('agent_profiles')
        .select('first_name')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile?.first_name) {
        setFirstName(profile.first_name);
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

  const handleResendEmail = async () => {
    setResending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Session expired. Please sign in again.");
        navigate("/auth", { replace: true });
        return;
      }

      // Get agent profile and settings
      const [profileRes, settingsRes] = await Promise.all([
        supabase
          .from('agent_profiles')
          .select('first_name, last_name, email')
          .eq('id', session.user.id)
          .maybeSingle(),
        supabase
          .from('agent_settings')
          .select('license_state, license_number, license_last_name')
          .eq('user_id', session.user.id)
          .maybeSingle()
      ]);

      const profile = profileRes.data;
      const settings = settingsRes.data;

      if (!profile || !settings?.license_number) {
        toast.error("Could not find your verification details.");
        return;
      }

      const { error } = await supabase.functions.invoke('send-verification-submitted', {
        body: {
          email: profile.email,
          firstName: profile.first_name || 'Agent',
          lastName: settings.license_last_name || profile.last_name,
          licenseState: settings.license_state,
          licenseNumber: settings.license_number,
        }
      });

      if (error) throw error;

      toast.success("Verification email resent! Check your inbox.");
    } catch (error: any) {
      console.error("Failed to resend verification email:", error);
      toast.error("Failed to resend email. Please try again.");
    } finally {
      setResending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Show approval message before redirect
  if (isApproved) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        {/* Minimal header with logo only */}
        <header className="py-6 px-6 border-b border-slate-200/70 bg-white">
          <div className="max-w-xl mx-auto">
            <div className="text-xl font-semibold">
              <span className="text-slate-900">AllAgent</span>
              <span className="text-slate-400">Connect</span>
            </div>
          </div>
        </header>

        {/* Approval message */}
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Minimal header with logo only */}
      <header className="py-6 px-6 border-b border-slate-200/70 bg-white">
        <div className="max-w-xl mx-auto">
          <div className="text-xl font-semibold">
            <span className="text-slate-900">AllAgent</span>
            <span className="text-slate-400">Connect</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-8 md:p-10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-3">
                Almost there.
              </h1>
              <p className="text-slate-600 text-base leading-relaxed">
                We're reviewing your license and profile to keep AllAgentConnect trusted and agent-only.
              </p>
            </div>

            {/* Anticipation line */}
            <div className="bg-slate-50 rounded-xl p-5 mb-8 border border-slate-100">
              <p className="text-slate-600 text-sm leading-relaxed text-center">
                Most verifications are completed quickly. We'll email you as soon as you're approved.
              </p>
            </div>

            {/* What happens next */}
            <div className="mb-8">
              <h2 className="font-medium text-slate-900 mb-4 text-sm uppercase tracking-wide">
                What happens next
              </h2>
              <ul className="space-y-3.5">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm leading-relaxed">
                    We verify your license and brokerage details.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm leading-relaxed">
                    Once approved, you'll unlock the full network, off-market intel, and messaging.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm leading-relaxed">
                    You'll receive an email confirmation the moment you're cleared.
                  </span>
                </li>
              </ul>
            </div>

            {/* Confirmation message */}
            <p className="text-center text-slate-600 text-sm mb-8">
              You're all set. We'll email you as soon as your license is approved.
            </p>

            {/* Primary action */}
            <Button 
              onClick={handleLogout} 
              className="w-full bg-slate-900 text-white hover:bg-slate-800 h-11"
            >
              Done for now
            </Button>

            {/* Secondary logout text */}
            <p className="text-center text-slate-400 text-xs mt-4">
              This will log you out until verification is complete.
            </p>

            {/* Resend email option */}
            <div className="text-center mt-6 pt-4 border-t border-slate-100">
              <p className="text-slate-500 text-xs mb-2">
                Didn't receive a confirmation email?
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResendEmail}
                disabled={resending}
                className="text-slate-600 hover:text-slate-900"
              >
                {resending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1.5" />
                    Resend email
                  </>
                )}
              </Button>
            </div>

            {/* Support microcopy */}
            <p className="text-center text-slate-500 text-xs mt-4">
              Questions? Email us at hello@allagentconnect.com
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PendingVerification;

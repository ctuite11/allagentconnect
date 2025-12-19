import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, LogOut } from "lucide-react";

const PendingVerification = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState<string | null>(null);
  const didNavigate = useRef(false);

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
        if (!didNavigate.current) {
          didNavigate.current = true;
          navigate("/agent-dashboard", { replace: true });
        }
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

    checkStatus();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
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
                Thanks — you're in.
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

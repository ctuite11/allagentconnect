import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  ShieldCheck,
  LayoutDashboard,
  Share2,
  Users,
  UserCircle,
  AlertTriangle,
} from "lucide-react";
import { validatePassword } from "@/lib/passwordPolicy";
import AACMonogram from "@/components/ui/AACMonogram";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { cn } from "@/lib/utils";
import { getRouteForRole, resolveUserRole } from "@/lib/resolveUserRole";
import { clearRecoveryState } from "@/lib/authRecovery";

/**
 * Agent Account Setup — final step of the approved-agent "License Verified"
 * email flow. The agent arrives here from /auth/callback after a recovery
 * link has minted a session and the password-setup marker has been set.
 *
 * Mirrors the buyer invite acceptance layout (ClientInvitationSetup) with
 * AAC green branding aligned to the License Verified email.
 */

const AGENT_MONOGRAM_CLASS = "text-[#16A34A]";
const AGENT_BADGE_CLASS =
  "inline-flex items-center gap-1.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] px-3 py-1 text-[12px] font-medium";
const AGENT_PRIMARY_BTN_CLASS =
  "bg-[#16A34A] hover:bg-[#15803D] text-white font-medium";
const AGENT_ACCENT_CLASS = "text-[#16A34A]";

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function AgentSetupBrand({ monogramClassName = "w-7 h-7" }: { monogramClassName?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-zinc-900">
      <AACMonogram className={cn(monogramClassName, AGENT_MONOGRAM_CLASS)} />
      <div className="min-w-0">
        <div className="text-[15px] font-bold tracking-tight">All Agent Connect</div>
        <div className="mt-0.5 text-[11px] font-medium leading-none text-zinc-500">Agent Activation</div>
      </div>
    </div>
  );
}

const benefits: { icon: typeof LayoutDashboard; label: string; iconClass: string }[] = [
  { icon: LayoutDashboard, label: "Access your Success Hub", iconClass: "text-[#0E56F5]" },
  { icon: Share2, label: "Share listings and Hot Sheets", iconClass: "text-emerald-600" },
  { icon: Users, label: "Connect with verified agents", iconClass: "text-violet-600" },
  { icon: UserCircle, label: "Manage your profile and buyer activity", iconClass: "text-amber-600" },
];

const AgentAccountSetup = () => {
  const navigate = useNavigate();

  const [validating, setValidating] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const failSafe = setTimeout(() => {
      if (cancelled) return;
      console.warn("[AgentAccountSetup] diag", { branch: "failsafe_timeout" });
      const handoffEmail = sessionStorage.getItem("aac_agent_setup_email") || "";
      if (handoffEmail) {
        setEmail((current) => current || handoffEmail);
      } else {
        setSessionError("We couldn't verify your activation link. Please refresh this page or request a new verification email.");
      }
      setValidating(false);
    }, 5000);

    const init = async () => {
      try {
        const isSetup = sessionStorage.getItem("aac_password_setup_flow") === "1";
        const isRecovery = sessionStorage.getItem("aac_recovery_flow") === "1";
        const hasSetupHandoff = sessionStorage.getItem("aac_agent_setup_handoff") === "1";
        const handoffEmail = sessionStorage.getItem("aac_agent_setup_email") || "";
        const handoffUserId = sessionStorage.getItem("aac_agent_setup_user_id") || "";

        console.info("[AgentAccountSetup] diag", {
          branch: "init_start",
          setupFlag: isSetup,
          recoveryFlag: isRecovery,
          handoffPresent: hasSetupHandoff,
          handoffEmailPresent: !!handoffEmail,
          handoffUserIdPresent: !!handoffUserId,
        });

        if (handoffEmail) setEmail(handoffEmail);

        if (!isSetup && !isRecovery && !hasSetupHandoff) {
          console.warn("[AgentAccountSetup] diag", { branch: "no_setup_context" });
          if (!cancelled) {
            setSessionError("Your activation link is invalid or expired. Please request a new one from your verification email.");
          }
          return;
        }

        let sessionUserId = handoffUserId;
        let sessionResolved = false;
        try {
          const { data: { session } } = await withTimeout(
            supabase.auth.getSession(),
            3500,
            "Activation session check",
          );
          if (!session?.user) {
            console.warn("[AgentAccountSetup] diag", { branch: "no_session", handoffEmailPresent: !!handoffEmail });
            if (!cancelled && !handoffEmail) {
              setSessionError("Your activation link has expired. Please request a new one from your verification email.");
            }
            return;
          }

          sessionUserId = session.user.id;
          sessionResolved = true;
          if (!cancelled) setEmail(session.user.email ?? handoffEmail);
          console.info("[AgentAccountSetup] diag", { branch: "session_resolved" });
        } catch (sessionErr) {
          console.warn("[AgentAccountSetup] diag", {
            branch: "session_timeout",
            hasHandoff: !!handoffEmail,
          });
          if (!handoffEmail) {
            setSessionError("Your activation link has expired. Please request a new one from your verification email.");
            return;
          }
        }

        if (cancelled) return;

        if (sessionUserId) setUserId(sessionUserId);

        if (sessionResolved && sessionUserId) try {
          const { data: profile, error: profileError } = await withTimeout(
            supabase
              .from("agent_profiles")
              .select("first_name, last_name, company")
              .eq("id", sessionUserId)
              .maybeSingle(),
            2500,
            "Agent profile lookup",
          );
          if (profileError) {
            console.warn("[AgentAccountSetup] profile prefill skipped:", profileError.message);
          }
          if (!cancelled) {
            if (profile?.first_name) setFirstName(profile.first_name);
            if (profile?.last_name) setLastName(profile.last_name);
            if (profile?.company) setCompany(profile.company);

            // If the account was already activated and we're NOT inside an
            // active recovery / password-setup handoff, route straight to the
            // agent's role home instead of re-showing the password form.
            const { data: settings } = await supabase
              .from("agent_settings")
              .select("account_activated_at")
              .eq("user_id", sessionUserId)
              .maybeSingle();
            const isSetup = sessionStorage.getItem("aac_password_setup_flow") === "1";
            const isRecovery = sessionStorage.getItem("aac_recovery_flow") === "1";
            if (settings?.account_activated_at && !isSetup && !isRecovery) {
              const resolved = await resolveUserRole(sessionUserId);
              navigate(getRouteForRole(resolved), { replace: true });
              return;
            }
          }
        } catch (profileErr) {
          console.warn("[AgentAccountSetup] profile prefill failed (non-fatal):", profileErr);
        }
        console.info("[AgentAccountSetup] diag", { branch: "ready" });
      } catch (err) {
        console.error("[AgentAccountSetup] diag", { branch: "init_exception" });
        if (!cancelled) {
          setSessionError("We couldn't verify your activation link. Please refresh this page or request a new verification email.");
        }
      } finally {
        if (!cancelled) {
          clearTimeout(failSafe);
          setValidating(false);
        }
      }
    };
    void init();

    return () => {
      cancelled = true;
      clearTimeout(failSafe);
    };
  }, [navigate]);

  const passwordResults = useMemo(() => validatePassword(password).results, [password]);
  const compactRules = useMemo(() => {
    const map: Record<string, string> = {
      length: "8+ characters",
      uppercase: "Uppercase",
      lowercase: "Lowercase",
      number: "Number",
      symbol: "Symbol",
    };
    return passwordResults.map((r) => ({ ...r, short: map[r.id] || r.label }));
  }, [passwordResults]);

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  const handleActivate = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Please enter your first and last name.");
      return;
    }
    if (!company.trim()) {
      toast.error("Please enter your brokerage.");
      return;
    }
    const { allPass } = validatePassword(password);
    if (!allPass) {
      toast.error("Password does not meet all requirements.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      if (!userId) {
        toast.error("We couldn't verify your activation session. Please refresh and try again.");
        return;
      }

      // Save required profile fields before changing the password. This keeps
      // setup retryable if the profile write fails and avoids completing auth
      // setup without the required brokerage value.
      const { data: savedProfile, error: profileError } = await supabase
        .from("agent_profiles")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          company: company.trim(),
        })
        .eq("id", userId)
        .select("id")
        .maybeSingle();
      if (profileError || !savedProfile) {
        console.error("[AgentAccountSetup] required profile save failed:", profileError);
        toast.error("We couldn't save your profile details. Please try again.");
        return;
      }

      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) {
        const authError = error as { code?: string; error_code?: string };
        const errCode = authError.code || authError.error_code || "";
        const msg = (error.message || "").toLowerCase();
        if (
          errCode === "same_password" ||
          msg.includes("same_password") ||
          msg.includes("different from the old password")
        ) {
          toast.error("Please choose a password different from your current one.");
          return;
        }
        if (msg.includes("token") || msg.includes("expired") || msg.includes("invalid")) {
          toast.error("Your activation link has expired. Please request a new one.");
          return;
        }
        toast.error(error.message);
        return;
      }
      if (!data.user) {
        toast.error("Activation failed. Please try again.");
        return;
      }

      // Canonical activation write. Idempotent: mark_agent_activated only
      // stamps account_activated_at on the first successful account setup,
      // regardless of which email/link brought the agent here. It also flips
      // invited → verified for admin-created agents.
      try {
        const { error: rpcErr } = await supabase.rpc("mark_agent_activated", {
          _user_id: data.user.id,
        });
        if (rpcErr) {
          console.warn("[AgentAccountSetup] mark_agent_activated warn:", rpcErr);
        }
      } catch (e) {
        console.warn("[AgentAccountSetup] activation marker write failed (non-fatal):", e);
      }

      clearRecoveryState();
      window.history.replaceState(null, "", "/agent-setup");

      // Default Communications Center channels ON for newly activated agents
      // (best-effort; respects preferences_set and never overwrites explicit choices).
      try {
        await ensureDefaultCommsChannels(data.user.id);
      } catch (e) {
        console.warn("[AgentAccountSetup] default comms channels skipped:", e);
      }

      toast.success("You're all set — welcome to All Agent Connect.");
      setUserId(data.user.id);
      const resolved = await resolveUserRole(data.user.id);
      navigate(getRouteForRole(resolved), { replace: true });
    } catch (err: unknown) {
      console.error("[AgentAccountSetup] error:", err);
      toast.error(err instanceof Error ? err.message : "Activation failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) {
    return <AacMonogramLoader variant="fullscreen" message="Verifying your activation link…" />;
  }

  if (sessionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <AACMonogram className={cn("w-10 h-10 mx-auto", AGENT_MONOGRAM_CLASS)} />
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Activation Link Unavailable
              </h1>
            </div>
            <p className="text-sm text-zinc-500">{sessionError}</p>
            <p className="text-xs text-zinc-400">
              Need help? Email{" "}
              <a href="mailto:support@allagentconnect.com" className="underline hover:text-zinc-600">
                support@allagentconnect.com
              </a>{" "}
              or request a new setup link.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button onClick={() => navigate("/auth")} variant="outline" className="rounded-xl">
              Go to Sign In
            </Button>
            <Button
              onClick={() => { window.location.href = "mailto:support@allagentconnect.com?subject=Activation%20link%20help"; }}
              className={cn("rounded-xl", AGENT_PRIMARY_BTN_CLASS)}
            >
              Contact Support
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <AgentSetupBrand />
          <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-zinc-500">
            <ShieldCheck className={cn("w-3.5 h-3.5", AGENT_ACCENT_CLASS)} />
            <span>Secure activation</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <div className="space-y-8 lg:pt-4">
            <div className="space-y-4">
              <span className={AGENT_BADGE_CLASS}>
                <ShieldCheck className="w-3.5 h-3.5" />
                License verified
              </span>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 leading-[1.15]">
                Welcome to All Agent Connect
              </h1>
              <p className="text-[15px] sm:text-base text-zinc-500 leading-relaxed max-w-md">
                Your license has been verified. Create your password to activate your agent account and access your Success Hub.
              </p>
            </div>

            <ul className="space-y-3">
              {benefits.map(({ icon: Icon, label, iconClass }) => (
                <li key={label} className="flex items-center gap-3 text-[14px] text-zinc-700">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-50 border border-zinc-100">
                    <Icon className={`w-4 h-4 ${iconClass}`} />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:pl-4 lg:-mt-7">
            <div className="max-w-md mx-auto lg:mx-0 lg:ml-auto rounded-3xl border border-zinc-200 bg-white shadow-sm p-7 sm:p-8">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleActivate();
                }}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[13px] text-zinc-600">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    readOnly
                    disabled
                    className="h-11 rounded-xl bg-zinc-50 text-zinc-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-[13px] text-zinc-600">First name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First"
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-[13px] text-zinc-600">Last name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last"
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company" className="text-[13px] text-zinc-600">Brokerage</Label>
                  <Input
                    id="company"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Brokerage name"
                    className="h-11 rounded-xl"
                    autoComplete="organization"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-[13px] text-zinc-600">Create a password</Label>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    className="h-11 rounded-xl"
                    required
                  />
                  <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                    {compactRules.map((rule) => (
                      <span
                        key={rule.id}
                        className={`inline-flex items-center gap-1 text-[11.5px] ${
                          rule.valid ? "text-emerald-600" : "text-zinc-400"
                        }`}
                      >
                        <Check className="w-3 h-3" strokeWidth={rule.valid ? 3 : 2} />
                        {rule.short}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-[13px] text-zinc-600">Confirm your password</Label>
                  <PasswordInput
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="h-11 rounded-xl"
                    required
                  />
                  {confirmPassword.length > 0 && (
                    <p className={`text-[11.5px] pt-0.5 ${passwordsMatch ? "text-emerald-600" : "text-rose-500"}`}>
                      {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className={cn("w-full h-11 rounded-xl", AGENT_PRIMARY_BTN_CLASS)}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Activating…
                    </>
                  ) : (
                    "Activate My Account"
                  )}
                </Button>

                <p className="text-[11.5px] text-zinc-400 text-center leading-relaxed">
                  By activating your account, you agree to our{" "}
                  <a href="/terms" className="underline hover:text-zinc-600">Terms</a> and{" "}
                  <a href="/privacy" className="underline hover:text-zinc-600">Privacy Policy</a>.
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AgentAccountSetup;
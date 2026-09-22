import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  LayoutDashboard,
  Share2,
  ShieldAlert,
  ShieldCheck,
  UserCircle,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validatePassword } from "@/lib/passwordPolicy";
import AACMonogram from "@/components/ui/AACMonogram";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { cn } from "@/lib/utils";
import { getRouteForRole, resolveUserRole } from "@/lib/resolveUserRole";
import { clearRecoveryState } from "@/lib/authRecovery";
import { consumePostAuthRedirect, setPostAuthRedirect } from "@/lib/sharedListingGuest";

/**
 * AAC-owned activation landing page — now the setup screen itself.
 *
 * The activation token arrives in the URL **fragment** (`/activate#t=...`),
 * which browsers never send to a server — so it stays out of access logs,
 * Referer headers and CDN logs. We read it once, immediately strip it from
 * the address bar, and hold it only in memory.
 *
 * Nothing is redeemed on load. The page makes one POST-only, read-only
 * preview call (which a non-JS mail scanner never performs and which mutates
 * nothing) to prefill the agent's known details, then waits for the single
 * explicit "Activate My Account" submission. Only that submission sets the
 * password, stamps activation and consumes the token.
 */

type ActivationState =
  | "loading"
  | "ready"
  | "missing"
  | "expired"
  | "in_progress"
  | "used"
  | "ineligible"
  | "invalid"
  | "resent"
  | "resend_unavailable"
  | "rate_limited"
  | "error";

const COPY: Record<
  Exclude<ActivationState, "ready" | "loading">,
  { title: string; body: string; tone: "warn" | "info" }
> = {
  missing: {
    title: "Activation link incomplete",
    body: "This page needs the full activation link from your email. Open the link again directly from the message, or request a new one below.",
    tone: "warn",
  },
  expired: {
    title: "This activation link has expired",
    body: "Activation links are valid for 30 days. Request a new one and we'll email it to the address on your account.",
    tone: "warn",
  },
  in_progress: {
    title: "This link is already being used",
    body: "Another activation attempt is still finishing. Wait a moment and try again, or request a fresh link.",
    tone: "info",
  },
  used: {
    title: "This link has already been used",
    body: "Your account is already activated. Head to the login page and sign in — use \u201cForgot password\u201d if you need to set a new one.",
    tone: "info",
  },
  ineligible: {
    title: "We can't activate this account",
    body: "This account isn't eligible for activation right now. Please contact All Agent Connect and we'll help you get set up.",
    tone: "warn",
  },
  invalid: {
    title: "That activation link isn't valid",
    body: "The link may have been altered by your email client. Open it again from the original message, or request a new one.",
    tone: "warn",
  },
  resent: {
    title: "Check your inbox",
    body: "If that activation request was still valid, a new link is on its way to the email address on your account.",
    tone: "info",
  },
  resend_unavailable: {
    title: "We couldn't send a new link",
    body: "This request has expired. Open your original account setup email and try the link again.",
    tone: "warn",
  },
  rate_limited: {
    title: "Too many attempts",
    body: "We've had a lot of attempts on this page in a short time. Please wait a few minutes and open your activation link again.",
    tone: "info",
  },
  error: {
    title: "Something went wrong",
    body: "We hit an unexpected problem activating your account. Please try again in a moment.",
    tone: "warn",
  },
};

const RESEND_STATES: ActivationState[] = ["expired", "in_progress", "invalid", "error", "missing"];

const AGENT_MONOGRAM_CLASS = "text-[#16A34A]";
const AGENT_BADGE_CLASS =
  "inline-flex items-center gap-1.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] px-3 py-1 text-[12px] font-medium";
const AGENT_PRIMARY_BTN_CLASS = "bg-[#16A34A] hover:bg-[#15803D] text-white font-medium";
const AGENT_ACCENT_CLASS = "text-[#16A34A]";

const benefits: { icon: typeof LayoutDashboard; label: string; iconClass: string }[] = [
  { icon: LayoutDashboard, label: "Access your Success Hub", iconClass: "text-[#0E56F5]" },
  { icon: Share2, label: "Share listings and Hot Sheets", iconClass: "text-emerald-600" },
  { icon: Users, label: "Connect with verified agents", iconClass: "text-violet-600" },
  { icon: UserCircle, label: "Manage your profile and buyer activity", iconClass: "text-amber-600" },
];

function AgentSetupBrand() {
  return (
    <div className="flex items-center gap-2.5 text-zinc-900">
      <AACMonogram className={cn("w-7 h-7", AGENT_MONOGRAM_CLASS)} />
      <div className="min-w-0">
        <div className="text-[15px] font-bold tracking-tight">All Agent Connect</div>
        <div className="mt-0.5 text-[11px] font-medium leading-none text-zinc-500">
          Agent Activation
        </div>
      </div>
    </div>
  );
}

export default function ActivateAccount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tokenRef = useRef<string | null>(null);
  const [state, setState] = useState<ActivationState>("loading");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const urlState = (searchParams.get("state") ?? "") as ActivationState;

  useEffect(() => {
    let cancelled = false;

    // A state carried in the query string (resend outcomes, legacy redirects)
    // always wins over reading the fragment again.
    if (urlState && urlState in COPY) {
      setState(urlState);
      return;
    }

    // Read the fragment once, then scrub it from the address bar and history
    // so the token is not left behind in a shared screen or back-button state.
    const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(raw);
    const found = params.get("t");
    // Optional internal destination carried by the link (e.g. a listing we
    // prepared). Sanitized to internal-only paths by setPostAuthRedirect.
    const returnTo = params.get("r");
    if (returnTo) setPostAuthRedirect(returnTo);

    if (!found) {
      setState("missing");
      return;
    }

    tokenRef.current = found;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

    // Read-only prefill. Never redeems, never mutates, never signs anyone in.
    void (async () => {
      try {
        const res = await fetch("/api/activation-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: found }),
        });
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (payload?.status === "ok") {
          setEmail(typeof payload.email === "string" ? payload.email : "");
          setFirstName(typeof payload.firstName === "string" ? payload.firstName : "");
          setLastName(typeof payload.lastName === "string" ? payload.lastName : "");
          setCompany(typeof payload.company === "string" ? payload.company : "");
          setState("ready");
          return;
        }
        const mapped = payload?.status === "revoked" ? "expired" : payload?.status;
        setState(mapped && mapped in COPY ? (mapped as ActivationState) : "error");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [urlState]);

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

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const finishSignIn = async (signInEmail: string, signInPassword: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password: signInPassword,
    });
    if (error || !data.user) {
      toast.success("Your account is activated. Please sign in.");
      navigate("/auth", { replace: true });
      return;
    }
    clearRecoveryState();
    toast.success("You're all set — welcome to All Agent Connect.");
    const stashed = consumePostAuthRedirect();
    if (stashed) {
      navigate(stashed, { replace: true });
      return;
    }
    const resolved = await resolveUserRole(data.user.id);
    navigate(getRouteForRole(resolved), { replace: true });
  };

  const handleActivate = async () => {
    const token = tokenRef.current;
    if (!token) {
      setState("missing");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Please enter your first and last name.");
      return;
    }
    if (!company.trim()) {
      toast.error("Please enter your brokerage.");
      return;
    }
    if (!validatePassword(password).allPass) {
      toast.error("Password does not meet all requirements.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/activation-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          company: company.trim(),
          password,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      const status = typeof payload?.status === "string" ? payload.status : "error";

      if (status === "ok") {
        await finishSignIn(typeof payload.email === "string" ? payload.email : email, password);
        return;
      }

      // A lost success response looks like "used" / "ineligible" on retry.
      // If the password we just submitted works, the activation did complete.
      if ((status === "used" || status === "ineligible") && email) {
        const { data } = await supabase.auth.signInWithPassword({ email, password });
        if (data?.user) {
          await finishSignIn(email, password);
          return;
        }
      }

      if (status === "validation" || status === "retry") {
        toast.error(
          typeof payload.message === "string"
            ? payload.message
            : "Please check your details and try again.",
        );
        return;
      }

      const mapped = status === "revoked" ? "expired" : status;
      setState(mapped in COPY ? (mapped as ActivationState) : "error");
    } catch {
      toast.error("We couldn't reach the activation service. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (state === "loading") {
    return <AacMonogramLoader variant="fullscreen" message="Opening your account setup…" />;
  }

  if (state !== "ready") {
    const copy = COPY[state];
    const showResend = RESEND_STATES.includes(state);
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
        <Helmet>
          <title>Activate your account | All Agent Connect</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div
            className={`mb-5 flex h-11 w-11 items-center justify-center rounded-full ${
              copy.tone === "warn" ? "bg-destructive/10" : "bg-primary/10"
            }`}
          >
            <ShieldAlert
              className={`h-6 w-6 ${copy.tone === "warn" ? "text-destructive" : "text-primary"}`}
              aria-hidden
            />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{copy.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{copy.body}</p>

          {showResend && (
            <form method="POST" action="/api/activate-resend" className="mt-6">
              <Button type="submit" size="lg" className="w-full">
                Email me a new activation link
              </Button>
            </form>
          )}

          <div className="mt-4 text-center">
            <a
              href="/auth"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Go to login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Set your password | All Agent Connect</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

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
                Your license has been verified. Create your password to activate your agent account
                and access your Success Hub.
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
                  <Label htmlFor="email" className="text-[13px] text-zinc-600">
                    Email
                  </Label>
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
                    <Label htmlFor="firstName" className="text-[13px] text-zinc-600">
                      First name
                    </Label>
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
                    <Label htmlFor="lastName" className="text-[13px] text-zinc-600">
                      Last name
                    </Label>
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
                  <Label htmlFor="company" className="text-[13px] text-zinc-600">
                    Brokerage
                  </Label>
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
                  <Label htmlFor="password" className="text-[13px] text-zinc-600">
                    Create a password
                  </Label>
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
                  <Label htmlFor="confirmPassword" className="text-[13px] text-zinc-600">
                    Confirm your password
                  </Label>
                  <PasswordInput
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="h-11 rounded-xl"
                    required
                  />
                  {confirmPassword.length > 0 && (
                    <p
                      className={`text-[11.5px] pt-0.5 ${
                        passwordsMatch ? "text-emerald-600" : "text-rose-500"
                      }`}
                    >
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
                  <a href="/terms" className="underline hover:text-zinc-600">
                    Terms
                  </a>{" "}
                  and{" "}
                  <a href="/privacy" className="underline hover:text-zinc-600">
                    Privacy Policy
                  </a>
                  .
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

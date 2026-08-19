import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, ShieldAlert } from "lucide-react";

/**
 * AAC-owned activation landing page.
 *
 * The activation token arrives in the URL **fragment** (`/activate#t=...`),
 * which browsers never send to a server — so it stays out of access logs,
 * Referer headers and CDN logs. We read it once, immediately strip it from
 * the address bar, and hold it only in memory until the agent presses
 * "Activate My Account", which performs a real form POST (token in the body).
 *
 * No automatic redemption: link prefetchers, mail scanners and preview bots
 * cannot consume the token because nothing happens without the explicit POST.
 */

type ActivationState =
  | "ready"
  | "missing"
  | "expired"
  | "in_progress"
  | "used"
  | "ineligible"
  | "invalid"
  | "resent"
  | "resend_unavailable"
  | "error";

const COPY: Record<
  Exclude<ActivationState, "ready">,
  { title: string; body: string; tone: "warn" | "info" }
> = {
  missing: {
    title: "Activation link incomplete",
    body: "This page needs the full activation link from your email. Open the link again directly from the message, or request a new one below.",
    tone: "warn",
  },
  expired: {
    title: "This activation link has expired",
    body: "Activation links are valid for 7 days. Request a new one and we'll email it to the address on your account.",
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
  error: {
    title: "Something went wrong",
    body: "We hit an unexpected problem activating your account. Please try again in a moment.",
    tone: "warn",
  },
};

const RESEND_STATES: ActivationState[] = ["expired", "in_progress", "invalid", "error", "missing"];

export default function ActivateAccount() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const urlState = (searchParams.get("state") ?? "") as ActivationState;

  useEffect(() => {
    // Read the fragment once, then scrub it from the address bar and history
    // so the token is not left behind in a shared screen or back-button state.
    const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const found = new URLSearchParams(raw).get("t");
    if (found) {
      setToken(found);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  }, []);

  const state: ActivationState = useMemo(() => {
    if (urlState && urlState in COPY) return urlState;
    if (token) return "ready";
    return "missing";
  }, [urlState, token]);

  const showResend = RESEND_STATES.includes(state) && !token;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <Helmet>
        <title>Activate your account | All Agent Connect</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        {state === "ready" ? (
          <>
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" aria-hidden />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Activate your account
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Your All Agent Connect account is ready. Continue below to activate your account and
              choose your password.
            </p>

            {/* Real form POST — the token travels in the request body only. */}
            <form
              ref={formRef}
              method="POST"
              action="/api/activate-redeem"
              onSubmit={() => setSubmitting(true)}
              className="mt-6"
            >
              <input type="hidden" name="t" value={token ?? ""} />
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? "Activating\u2026" : "Activate My Account"}
              </Button>
            </form>

            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              This link is valid for 7 days and can be used once.
            </p>
          </>
        ) : (
          <>
            <div
              className={`mb-5 flex h-11 w-11 items-center justify-center rounded-full ${
                COPY[state].tone === "warn" ? "bg-destructive/10" : "bg-primary/10"
              }`}
            >
              <ShieldAlert
                className={`h-6 w-6 ${
                  COPY[state].tone === "warn" ? "text-destructive" : "text-primary"
                }`}
                aria-hidden
              />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {COPY[state].title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {COPY[state].body}
            </p>

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
          </>
        )}
      </div>
    </div>
  );
}

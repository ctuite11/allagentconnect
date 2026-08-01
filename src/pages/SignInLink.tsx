import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Clock, LogIn, ShieldAlert } from "lucide-react";

/**
 * AAC-owned sign-in link landing page.
 *
 * The login token arrives in the URL **fragment** (`/signin-link#t=...`), which
 * browsers never send to a server — keeping it out of access logs, Referer
 * headers and CDN logs. We read it once, strip it from the address bar, and
 * hold it in memory only until the agent presses "Sign In", which performs a
 * real form POST (token in the body).
 *
 * Nothing is redeemed automatically, so mail scanners and link prefetchers
 * cannot burn the single-use token.
 */

type LinkState =
  | "ready"
  | "missing"
  | "expired"
  | "in_progress"
  | "used"
  | "revoked"
  | "ineligible"
  | "invalid"
  | "error";

const COPY: Record<Exclude<LinkState, "ready">, { title: string; body: string; tone: "warn" | "info" }> = {
  missing: {
    title: "Sign-in link incomplete",
    body: "This page needs the full link from your email. Open the link again directly from the message.",
    tone: "warn",
  },
  expired: {
    title: "This sign-in link has expired",
    body: "Sign-in links are valid for 7 days. Head to the login page to sign in, or ask us for a fresh link.",
    tone: "warn",
  },
  in_progress: {
    title: "This link is already being used",
    body: "Another sign-in attempt is still finishing. Wait a moment and try again.",
    tone: "info",
  },
  used: {
    title: "This link has already been used",
    body: "Sign-in links work once. Go to the login page and sign in with your email and password.",
    tone: "info",
  },
  revoked: {
    title: "This link is no longer active",
    body: "A newer sign-in link was issued for your account. Use the most recent email we sent you.",
    tone: "info",
  },
  ineligible: {
    title: "We can't sign you in with this link",
    body: "This account isn't eligible to sign in right now. Reply to the email we sent and we'll sort it out.",
    tone: "warn",
  },
  invalid: {
    title: "That sign-in link isn't valid",
    body: "The link may have been altered by your email client. Open it again from the original message.",
    tone: "warn",
  },
  error: {
    title: "Something went wrong",
    body: "We hit an unexpected problem signing you in. Please try again in a moment.",
    tone: "warn",
  },
};

export default function SignInLink() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const urlState = (searchParams.get("state") ?? "") as LinkState;

  useEffect(() => {
    const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const found = new URLSearchParams(raw).get("t");
    if (found) {
      setToken(found);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  const state: LinkState = useMemo(() => {
    if (urlState && urlState in COPY) return urlState;
    if (token) return "ready";
    return "missing";
  }, [urlState, token]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <Helmet>
        <title>Sign in | All Agent Connect</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        {state === "ready" ? (
          <>
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-success/10">
              <LogIn className="h-6 w-6 text-success" aria-hidden />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Sign in to All Agent Connect
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Press the button below to sign in. You can set or change your password once you're in.
            </p>

            {/* Real form POST — the token travels in the request body only. */}
            <form
              method="POST"
              action="/api/login-redeem"
              onSubmit={() => setSubmitting(true)}
              className="mt-6"
            >
              <input type="hidden" name="t" value={token ?? ""} />
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? "Signing in\u2026" : "Sign In"}
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
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{COPY[state].body}</p>

            <div className="mt-6 text-center">
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

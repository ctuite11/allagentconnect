import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Seo } from "@/components/Seo";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { clearRecoveryState } from "@/lib/authRecovery";
import { getRouteForRole, resolveUserRole } from "@/lib/resolveUserRole";
import {
  clearGuestListing,
  resolvePostAuthRedirectWithMeta,
} from "@/lib/sharedListingGuest";

const emailSchema = z.string().trim().email("Please enter a valid email address");

const authCardSurface = "rounded-2xl border border-zinc-100 bg-white p-8 shadow-sm";

/**
 * Dedicated developer portal login. Uses the same Supabase email/password auth
 * as /auth, then routes via getRouteForRole() — developers → /developer,
 * everyone else → their own product home (no Developer access granted).
 */
export default function DeveloperLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const didNavigate = useRef(false);

  useEffect(() => {
    let mounted = true;
    didNavigate.current = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const user = data.session?.user;
      if (!user) {
        setCheckingSession(false);
        return;
      }
      const resolved = await resolveUserRole(user.id);
      if (!mounted || didNavigate.current) return;
      const returnToMeta = resolvePostAuthRedirectWithMeta(searchParams);
      const target = returnToMeta.value ?? getRouteForRole(resolved);
      didNavigate.current = true;
      clearGuestListing();
      navigate(target, { replace: true });
    })();

    return () => {
      mounted = false;
    };
  }, [navigate, searchParams]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const validatedEmail = emailSchema.parse(email);
      clearRecoveryState();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validatedEmail,
        password,
      });

      if (error) {
        toast.error(
          error.message.includes("Invalid login credentials")
            ? "Invalid email or password. Please try again."
            : error.message,
        );
        return;
      }

      if (!data.user) {
        toast.error("Sign in did not return an account. Please try again.");
        return;
      }

      const resolved = await resolveUserRole(data.user.id);
      const returnToMeta = resolvePostAuthRedirectWithMeta(searchParams);
      // Only honor returnTo into the developer portal when the account is developer/admin.
      const safeReturnTo =
        returnToMeta.value &&
        returnToMeta.value.startsWith("/developer") &&
        (resolved.role === "developer" || resolved.role === "admin")
          ? returnToMeta.value
          : null;
      const target = safeReturnTo ?? getRouteForRole(resolved);
      clearGuestListing();
      didNavigate.current = true;
      navigate(target, { replace: true });
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.errors[0].message);
      else toast.error(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return <AacMonogramLoader variant="fullscreen" message="Checking your session…" />;
  }

  return (
    <>
      <Seo title="Developer sign in | All Agent Connect" noindex />
      <AuthShell>
        <div className={authCardSurface}>
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold text-zinc-900">Developer portal</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Sign in to manage development projects. Agents should use the main AAC login.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="developer-email">Email address</Label>
              <Input
                id="developer-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="developer-password">Password</Label>
              <PasswordInput
                id="developer-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Agent or admin?{" "}
            <Link to="/auth" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
              Sign in at AAC
            </Link>
          </p>
        </div>
      </AuthShell>
    </>
  );
}

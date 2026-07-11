import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  previewDelegateInvite,
  setupDelegateInvite,
  type DelegateInvitePreview,
} from "@/lib/agentDelegatesApi";
import { resolveUserRole } from "@/lib/resolveUserRole";
import { useAuthRole } from "@/hooks/useAuthRole";
import { validatePassword } from "@/lib/passwordPolicy";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import AACMonogram from "@/components/ui/AACMonogram";
import { cn } from "@/lib/utils";
import { Check, LayoutDashboard, Loader2, ShieldCheck, Users } from "lucide-react";

const PRIMARY_BTN = "bg-[#0E56F5] hover:bg-[#0C4AD4] text-white font-medium";

function ownerDisplayName(preview: DelegateInvitePreview) {
  return [preview.owner_first_name, preview.owner_last_name].filter(Boolean).join(" ").trim() || "Your agent";
}

function SetupBrand() {
  return (
    <div className="flex items-center gap-2.5 text-zinc-900">
      <AACMonogram className="h-7 w-7 text-[#0E56F5]" />
      <div>
        <div className="text-[15px] font-bold tracking-tight">All Agent Connect</div>
        <div className="mt-0.5 text-[11px] font-medium leading-none text-zinc-500">Delegate Access</div>
      </div>
    </div>
  );
}

export default function AcceptDelegateInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshRole } = useAuthRole();
  const token = searchParams.get("token") ?? "";

  const [loadingPreview, setLoadingPreview] = useState(true);
  const [preview, setPreview] = useState<DelegateInvitePreview | null>(null);
  const [phase, setPhase] = useState<"setup" | "signin">("setup");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadingPreview(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const result = await previewDelegateInvite(token);
      if (cancelled) return;

      setPreview(result);
      if (result.valid && result.invite_email) {
        setEmail(result.invite_email);
        if (result.display_name) {
          const parts = result.display_name.trim().split(/\s+/);
          setFirstName(parts[0] ?? "");
          setLastName(parts.slice(1).join(" "));
        }
        if (result.account_exists) {
          setPhase("signin");
        }
      }
      setLoadingPreview(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const passwordValidation = validatePassword(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const finalize = async (plainPassword: string, existingAccount: boolean) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!token) throw new Error("Invitation token is missing.");

    const result = await setupDelegateInvite({
      token,
      email: normalizedEmail,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password: plainPassword,
      existingAccount,
    });

    if (result.ok !== true) {
      if (result.code === "existing_account") {
        setPhase("signin");
        return;
      }
      throw new Error(result.error);
    }

    if (result.session) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });

      if (sessionError) {
        throw new Error(
          sessionError.message ||
            "Your account is ready, but we could not sign you in automatically. Try signing in from the login page.",
        );
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: plainPassword,
      });

      if (signInError) {
        throw new Error(
          signInError.message ||
            "Your account is ready, but we could not sign you in automatically. Try signing in from the login page.",
        );
      }
    }

    const { data: sessionCheck } = await supabase.auth.getSession();
    if (!sessionCheck.session?.user) {
      throw new Error(
        "Your account is ready, but we could not sign you in automatically. Try signing in from the login page.",
      );
    }

    await refreshRole();

    for (let attempt = 0; attempt < 12; attempt++) {
      const resolved = await resolveUserRole(sessionCheck.session.user.id);
      const isDelegate = String(resolved.role) === "delegate" || resolved.is_delegate === true;
      if (isDelegate) break;
      if (attempt === 11 && !isDelegate) {
        throw new Error(
          "Your account is ready, but delegate access is still activating. Refresh the page or sign in again.",
        );
      }
      await refreshRole();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    toast.success(`You're now working in ${result.ownerDisplayName}'s account.`);
    navigate("/agent-dashboard", { replace: true });
  };

  const handleSetup = async () => {
    if (!passwordValidation.allPass) {
      toast.error("Password does not meet requirements");
      return;
    }
    if (!passwordsMatch) {
      toast.error("Passwords do not match");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Please enter your first and last name");
      return;
    }

    setSubmitting(true);
    try {
      await finalize(password, false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set up your account");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignIn = async () => {
    if (!signinPassword) {
      toast.error("Please enter your password");
      return;
    }
    setSubmitting(true);
    try {
      await finalize(signinPassword, true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const ownerName = preview ? ownerDisplayName(preview) : "Your agent";
  const roleLine = preview?.role_label?.trim();

  const inviteHeadline = useMemo(() => {
    if (!preview?.valid) return "Invitation unavailable";
    if (roleLine) {
      return `${ownerName} invited you to help manage their All Agent Connect account as ${roleLine}.`;
    }
    return `${ownerName} invited you to help manage their All Agent Connect account.`;
  }, [preview?.valid, ownerName, roleLine]);

  if (loadingPreview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <AacMonogramLoader variant="section" className="min-h-[40vh]" message="Loading invitation…" />
      </div>
    );
  }

  if (!token || !preview?.valid) {
    const message =
      preview?.error === "superseded"
        ? "This invitation has been replaced by a newer one. Please use the most recent email invitation."
        : preview?.error === "expired"
        ? "This invitation has expired. Ask the account owner to send a new invite."
        : preview?.error === "revoked"
          ? "This invitation is no longer valid."
          : "Missing or invalid invite token.";

    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <SetupBrand />
          <h1 className="text-2xl font-semibold text-zinc-900">Invite unavailable</h1>
          <p className="text-sm text-zinc-500">{message}</p>
        </div>
      </div>
    );
  }

  if (preview.blocked || preview.is_licensed_agent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <SetupBrand />
          <h1 className="text-2xl font-semibold text-zinc-900">Unable to accept</h1>
          <p className="text-sm text-zinc-500">
            {preview.blocked_message ||
              "This email already belongs to a licensed AAC agent. Delegate access for existing agents is coming soon."}
          </p>
        </div>
      </div>
    );
  }

  if (phase === "signin") {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-zinc-100">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <SetupBrand />
            <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-zinc-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure invitation
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-md px-6 py-16">
          <OwnerInviteHero preview={preview} headline={inviteHeadline} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSignIn();
            }}
            className="mt-8 space-y-5 rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm"
          >
            <div className="space-y-1.5">
              <Label htmlFor="signin-email">Email</Label>
              <Input id="signin-email" type="email" value={email} readOnly className="bg-zinc-50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signin-password">Password</Label>
              <PasswordInput
                id="signin-password"
                value={signinPassword}
                onChange={(e) => setSigninPassword(e.target.value)}
                autoFocus
                required
              />
            </div>
            <Button type="submit" disabled={submitting} className={cn("w-full", PRIMARY_BTN)}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in & accept invitation"
              )}
            </Button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <SetupBrand />
          <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure invitation
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-12 px-6 py-12 lg:grid-cols-2 lg:gap-16 lg:py-20">
        <div className="space-y-8 lg:pt-4">
          <OwnerInviteHero preview={preview} headline={inviteHeadline} />
          <ul className="space-y-3">
            {[
              { icon: LayoutDashboard, label: "Access the owner's Success Hub" },
              { icon: Users, label: "Help manage clients, listings, and hot sheets" },
              { icon: ShieldCheck, label: "You're joining their account — not creating your own agent profile" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-[14px] text-zinc-700">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-100 bg-zinc-50">
                  <Icon className="h-4 w-4 text-[#0E56F5]" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:pl-4">
          <div className="mx-auto max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm lg:mx-0 lg:ml-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSetup();
              }}
              className="space-y-5"
            >
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} readOnly className="bg-zinc-50" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Create a password</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {password && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                    {passwordValidation.results.map((rule) => (
                      <span
                        key={rule.id}
                        className={cn(
                          "inline-flex items-center gap-1 text-[11.5px]",
                          rule.valid ? "text-emerald-600" : "text-zinc-400",
                        )}
                      >
                        <Check className="h-3 w-3" strokeWidth={rule.valid ? 3 : 2} />
                        {rule.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={submitting || !passwordValidation.allPass || !passwordsMatch}
                className={cn("w-full", PRIMARY_BTN)}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up…
                  </>
                ) : (
                  "Set password & join account"
                )}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

function OwnerInviteHero({
  preview,
  headline,
}: {
  preview: DelegateInvitePreview;
  headline: string;
}) {
  const ownerName = ownerDisplayName(preview);
  const initials = ownerName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        {preview.owner_headshot_url ? (
          <img
            src={preview.owner_headshot_url}
            alt={ownerName}
            className="h-16 w-16 rounded-full object-cover border border-zinc-100"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0E56F5]/10 text-lg font-semibold text-[#0E56F5]">
            {initials}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-zinc-900">{ownerName}</p>
          {preview.owner_company && (
            <p className="text-sm text-zinc-500">{preview.owner_company}</p>
          )}
        </div>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 leading-tight">{headline}</h1>
      <p className="text-[15px] text-zinc-500 leading-relaxed">
        Set a password to access {ownerName}&apos;s Success Hub. You&apos;re helping manage their account — not
        creating a licensed agent profile.
      </p>
    </div>
  );
}

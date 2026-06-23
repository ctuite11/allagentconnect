import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Check, ShieldCheck, Heart, Flame, MessageSquare, Eye } from "lucide-react";
import { setPrimaryAgentId } from "@/utils/agentTracking";
import { validatePassword } from "@/lib/passwordPolicy";
import AACMonogram from "@/components/ui/AACMonogram";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { acceptClientHotSheetInvite } from "@/lib/acceptClientHotSheetInvite";
import { markInviteAcceptance } from "@/lib/inviteAcceptanceHandoff";
import { cn } from "@/lib/utils";

/** Buyer portal brand tokens — match `BuyerShell` / `BuyerPortalHeader`. */
const BUYER_MONOGRAM_CLASS = "text-[#16A34A]";
const BUYER_BADGE_CLASS =
  "inline-flex items-center gap-1.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] px-3 py-1 text-[12px] font-medium";
const BUYER_PRIMARY_BTN_CLASS =
  "bg-[#16A34A] hover:bg-[#15803D] text-white font-medium";

function InviteSignupBrand({ monogramClassName = "w-7 h-7" }: { monogramClassName?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-zinc-900">
      <AACMonogram className={cn(monogramClassName, BUYER_MONOGRAM_CLASS)} />
      <div className="min-w-0">
        <div className="text-[15px] font-bold tracking-tight">All Agent Connect</div>
        <div className="mt-0.5 text-[11px] font-medium leading-none text-zinc-500">Buyer Portal</div>
      </div>
    </div>
  );
}

/** Authoritative invite context from `share_tokens` (token string alone is not enough — query params can be tampered). */
type InviteAnchor = {
  agentId: string;
  crmClientId: string | null;
  clientEmail: string | null;
  hotSheetId: string | null;
  seedFirstName?: string | null;
  seedLastName?: string | null;
  seedPhone?: string | null;
};

const ClientInvitationSetup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token: pathToken } = useParams<{ token?: string }>();

  // Prefer clean path-based token (`/invite/:token`). Fall back to legacy
  // `/client-invite?invitation_token=...` for older email links.
  const invitationToken = (pathToken || searchParams.get("invitation_token") || "").trim();
  const initialEmail = searchParams.get("email") || "";
  const initialFirstName = searchParams.get("first_name") || "";
  const initialLastName = searchParams.get("last_name") || "";

  const [phase, setPhase] = useState<"form" | "signin" | "confirmation_required">("form");
  const [email, setEmail] = useState(initialEmail);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [inviteAnchor, setInviteAnchor] = useState<InviteAnchor | null>(null);
  const [agentFirstName, setAgentFirstName] = useState<string>("");
  /** Lock email when present on the URL or on the invite token payload (buyer must accept with invited email). */
  const isEmailLocked =
    Boolean(initialEmail.trim()) || Boolean(inviteAnchor?.clientEmail?.trim());
  const postAcceptPath = "/client/dashboard";

  const markInviteHandoff = (hotSheetId?: string | null) => {
    markInviteAcceptance(hotSheetId ?? inviteAnchor?.hotSheetId ?? null);
  };

  const finalizeInviteAndSignIn = async (
    plainPassword: string,
    opts: { existingAccount: boolean },
  ) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (inviteAnchor?.clientEmail && normalizedEmail !== inviteAnchor.clientEmail) {
      throw new Error("Use the same email address your agent sent this invitation to.");
    }
    if (!invitationToken) {
      throw new Error("Invitation token is missing. Open the link from your invitation email.");
    }
    if (!firstName.trim() || !lastName.trim()) {
      throw new Error("Please enter your first and last name.");
    }

    await supabase.auth.signOut();

    const result = await acceptClientHotSheetInvite({
      token: invitationToken,
      email: normalizedEmail,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password: plainPassword,
      existingAccount: opts.existingAccount,
    });

    if (!result.ok) {
      const failure = result as { ok: false; error: string; code?: string };
      if (failure.code === "existing_account") {
        setPhase("signin");
        return;
      }
      throw new Error(failure.error);
    }

    if (result.agentId) setPrimaryAgentId(result.agentId);

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: plainPassword,
    });

    if (signInError || !signInData.user) {
      const msg = signInError?.message?.toLowerCase() ?? "";
      if (msg.includes("email not confirmed") || msg.includes("confirm")) {
        setPhase("confirmation_required");
        return;
      }
      throw new Error(
        signInError?.message ||
          "Your account is ready, but we could not sign you in automatically. Try signing in from the login page.",
      );
    }

    markInviteHandoff();
    navigate(postAcceptPath, { replace: true });
  };

  useEffect(() => {
    const validateToken = async () => {
      if (!invitationToken) {
        toast.error("Invalid invitation link");
        setIsValidatingToken(false);
        return;
      }
      try {
        setInviteAnchor(null);
        const { data: rpcData, error } = await supabase
          .rpc("resolve_share_token", { _token: invitationToken });
        const data = (rpcData ?? null) as any;

        if (error || !data) {
          toast.error("This link is no longer available. Please contact your agent.");
          setTokenValid(false);
        } else if ((data as any).revoked_at) {
          toast.error("This link is no longer available. Please contact your agent.");
          setTokenValid(false);
        } else if (data.accepted_at) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && (data as any).accepted_by_user_id === user.id) {
            navigate(postAcceptPath, { replace: true });
            return;
          }
          toast.info("This invitation has already been used");
          setTokenValid(false);
        } else {
          const payload = (data.payload ?? null) as Record<string, unknown> | null;
          if (payload?.type !== "client_hotsheet_invite") {
            toast.error("This link is not a valid buyer invitation.");
            setTokenValid(false);
            return;
          }

          const tokenAgentId = String(data.agent_id ?? "").trim();
          if (!tokenAgentId) {
            toast.error("This invitation is missing agent information. Please contact your agent.");
            setTokenValid(false);
            return;
          }

          const crmFromPayload = typeof payload.client_id === "string" ? payload.client_id : null;
          const emailFromPayload =
            typeof payload.client_email === "string"
              ? String(payload.client_email).trim().toLowerCase()
              : null;
          const seedFirstName =
            typeof payload.client_first_name === "string" ? String(payload.client_first_name).trim() : "";
          const seedLastName =
            typeof payload.client_last_name === "string" ? String(payload.client_last_name).trim() : "";
          const seedPhone =
            typeof payload.client_phone === "string" ? String(payload.client_phone).trim() : "";

          const emailFromUrl = initialEmail.trim().toLowerCase();
          if (emailFromPayload && emailFromUrl && emailFromUrl !== emailFromPayload) {
            toast.error(
              "This link does not match the email on your invitation. Open the link from your invitation email.",
            );
            setTokenValid(false);
            return;
          }

          setInviteAnchor({
            agentId: tokenAgentId,
            crmClientId: crmFromPayload,
            clientEmail: emailFromPayload,
            hotSheetId:
              typeof payload.hot_sheet_id === "string" && payload.hot_sheet_id.trim()
                ? String(payload.hot_sheet_id).trim()
                : null,
            seedFirstName: seedFirstName || null,
            seedLastName: seedLastName || null,
            seedPhone: seedPhone || null,
          });

          if (emailFromPayload && !emailFromUrl) {
            setEmail(emailFromPayload);
          }
          if (seedFirstName && !initialFirstName.trim()) {
            setFirstName(seedFirstName);
          }
          if (seedLastName && !initialLastName.trim()) {
            setLastName(seedLastName);
          }

          const { data: agentData } = await supabase
            .from("agent_profiles")
            .select("first_name")
            .eq("id", tokenAgentId)
            .maybeSingle();
          if (agentData?.first_name) setAgentFirstName(agentData.first_name);

          setTokenValid(true);
        }
      } catch (error) {
        console.error("Token validation error:", error);
        toast.error("Unable to validate invitation");
        setTokenValid(false);
      } finally {
        setIsValidatingToken(false);
      }
    };
    validateToken();
  }, [invitationToken, initialEmail, navigate, postAcceptPath]);

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

  const handleActivation = async () => {
    if (!email || !email.trim()) {
      toast.error("Please enter your email to continue.");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Please enter your first and last name.");
      return;
    }
    const { allPass } = validatePassword(password);
    if (!allPass) {
      toast.error("Password does not meet all requirements");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      await finalizeInviteAndSignIn(password, { existingAccount: false });
    } catch (error: any) {
      console.error("Activation error:", error);
      toast.error(error.message || "Failed to activate account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async () => {
    if (!signinPassword) {
      toast.error("Please enter your password.");
      return;
    }
    setIsSubmitting(true);
    try {
      await finalizeInviteAndSignIn(signinPassword, { existingAccount: true });
    } catch (error: any) {
      console.error("Sign-in error:", error);
      toast.error(error.message || "Sign in failed. Please check your password and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidatingToken) {
    return <AacMonogramLoader variant="fullscreen" message="Validating invitation…" />;
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <AACMonogram className={cn("w-10 h-10 mx-auto", BUYER_MONOGRAM_CLASS)} />
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Invitation Unavailable
            </h1>
            <p className="text-sm text-zinc-500">
              This invitation link is invalid, has expired, or has already been used.
              {agentFirstName ? ` Please contact ${agentFirstName} for a new invitation.` : " Please contact your agent for a new invitation."}
            </p>
          </div>
          <Button onClick={() => navigate("/")} variant="outline" className="rounded-xl">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "signin") {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-zinc-100">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <InviteSignupBrand />
            <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-zinc-500">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Secure invitation</span>
            </div>
          </div>
        </header>
        <main className="max-w-md mx-auto px-6 py-20">
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <span className={BUYER_BADGE_CLASS}>
                <ShieldCheck className="w-3.5 h-3.5" />
                Account found
              </span>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Sign In to Accept Invitation</h1>
              <p className="text-[14px] text-zinc-500 leading-relaxed">
                An account already exists for <strong className="text-zinc-700">{email}</strong>.
                Sign in with your password to accept this invitation and access your workspace.
              </p>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); handleSignIn(); }}
              className="rounded-3xl border border-zinc-200 bg-white shadow-sm p-7 space-y-5"
            >
              <div className="space-y-1.5">
                <Label htmlFor="signin-email" className="text-[13px] text-zinc-600">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  value={email}
                  readOnly
                  className="h-11 rounded-xl bg-zinc-50 text-zinc-700"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signin-password" className="text-[13px] text-zinc-600">Password</Label>
                <PasswordInput
                  id="signin-password"
                  value={signinPassword}
                  onChange={(e) => setSigninPassword(e.target.value)}
                  placeholder="Your password"
                  className="h-11 rounded-xl"
                  autoFocus
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className={cn("w-full h-11 rounded-xl", BUYER_PRIMARY_BTN_CLASS)}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign In & Accept Invitation"
                )}
              </Button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "confirmation_required") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <AACMonogram className={cn("w-10 h-10 mx-auto", BUYER_MONOGRAM_CLASS)} />
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Confirm Your Email
            </h1>
            <p className="text-sm text-zinc-500">
              Your buyer account was created, but email confirmation is still required before you can sign in.
              Check <strong className="text-zinc-700">{email}</strong> for a confirmation link, then return here to sign in.
            </p>
          </div>
          <Button onClick={() => navigate("/auth")} variant="outline" className="rounded-xl">
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  const benefits: { icon: typeof Eye; label: string; iconClass: string }[] = [
    { icon: Eye, label: "View curated listings", iconClass: "text-violet-600" },
    { icon: Heart, label: "Save favorite homes", iconClass: "text-rose-600" },
    { icon: Flame, label: "Receive new listings that match your search", iconClass: "text-red-600" },
    { icon: MessageSquare, label: "Private communication with your agent", iconClass: "text-blue-600" },
  ];

  const inviterName = agentFirstName || "Your agent";
  const inviteHeadline = agentFirstName
    ? `${agentFirstName} shared a private home search with you`
    : "Your private home search is ready";
  const inviteReassurance = agentFirstName
    ? `You're receiving this invitation because ${agentFirstName} shared a private home search with you.`
    : "You're receiving this invitation because your agent shared a private home search with you.";

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <InviteSignupBrand />
          <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure invitation</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <div className="space-y-8 lg:pt-4">
            <div className="space-y-4">
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 leading-[1.15]">
                {inviteHeadline}
              </h1>
              <p className="text-[14px] sm:text-[15px] text-zinc-600 leading-relaxed max-w-md">
                {inviteReassurance}
              </p>
              <p className="text-[15px] sm:text-base text-zinc-500 leading-relaxed max-w-md">
                {inviterName} shared a private home search with you. Create your free All Agent Connect
                account to view homes, save favorites, receive new matching listings, and message your agent.
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

          <div className="lg:pl-4">
            <div className="max-w-md mx-auto lg:mx-0 lg:ml-auto rounded-3xl border border-zinc-200 bg-white shadow-sm p-7 sm:p-8">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleActivation();
                }}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[13px] text-zinc-600">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    readOnly={isEmailLocked}
                    className={isEmailLocked ? "h-11 rounded-xl bg-zinc-50 text-zinc-700" : "h-11 rounded-xl"}
                    onChange={(e) => setEmail(e.target.value)}
                    required
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
                <p className="text-[11.5px] text-zinc-500 leading-relaxed -mt-2">
                  You can use the name you prefer on your All Agent Connect profile. Your agent&apos;s contact
                  record may still show the name they have on file; that does not affect your access.
                </p>

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
                  disabled={isSubmitting}
                  className={cn("w-full h-11 rounded-xl", BUYER_PRIMARY_BTN_CLASS)}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Activating…
                    </>
                  ) : (
                    "View My Home Search"
                  )}
                </Button>

                <p className="text-[11.5px] text-zinc-400 text-center leading-relaxed">
                  By joining, you agree to our{" "}
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

export default ClientInvitationSetup;

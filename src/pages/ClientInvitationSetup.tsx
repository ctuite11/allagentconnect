import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Check, ShieldCheck, Heart, Flame, MessageSquare, Eye } from "lucide-react";
import { setPrimaryAgentId } from "@/utils/agentTracking";
import { validatePassword } from "@/lib/passwordPolicy";
import AACMonogram from "@/components/ui/AACMonogram";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";

/** Authoritative invite context from `share_tokens` (token string alone is not enough — query params can be tampered). */
type InviteAnchor = {
  agentId: string;
  crmClientId: string | null;
  clientEmail: string | null;
  seedFirstName?: string | null;
  seedLastName?: string | null;
  seedPhone?: string | null;
};

const ClientInvitationSetup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const invitationToken = searchParams.get("invitation_token") || "";
  const initialEmail = searchParams.get("email") || "";
  const agentId = searchParams.get("agent_id") || "";
  const clientId = searchParams.get("client_id") || "";
  const initialFirstName = searchParams.get("first_name") || "";
  const initialLastName = searchParams.get("last_name") || "";

  const [phase, setPhase] = useState<
    "form" | "signin" | "success" | "confirm_email"
  >("form");
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

  const effectiveAgentId = inviteAnchor?.agentId || agentId;
  const effectiveCrmClientId = (inviteAnchor?.crmClientId || clientId || "").trim() || undefined;

  const markInviteHandoff = () => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem("aac_invite_acceptance_handoff", String(Date.now()));
  };

  /** Calls the single trusted backend RPC that finalizes invite acceptance atomically. */
  const finalizeAcceptance = async (): Promise<void> => {
    const { error } = await supabase.rpc("accept_client_hot_sheet_invite", {
      _token: invitationToken,
    });
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("email_mismatch")) {
        throw new Error("Sign in with the email address your invitation was sent to.");
      }
      if (msg.includes("token_already_accepted")) {
        throw new Error("This invitation has already been accepted by another account.");
      }
      if (msg.includes("token_revoked") || msg.includes("token_not_found") || msg.includes("wrong_token_type")) {
        throw new Error("This invitation link is no longer available. Please contact your agent.");
      }
      console.error("[client-invite] finalize error:", error);
      throw new Error("We could not finalize your invitation. Please try again.");
    }
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
        const { data, error } = await supabase
          .from("share_tokens")
          .select("*")
          .eq("token", invitationToken)
          .maybeSingle();

        if (error || !data) {
          toast.error("This link is no longer available. Please contact your agent.");
          setTokenValid(false);
        } else if ((data as any).revoked_at) {
          toast.error("This link is no longer available. Please contact your agent.");
          setTokenValid(false);
        } else if (data.accepted_at) {
          // Idempotent: if the current signed-in user is the one who accepted it, route them home.
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
  }, [invitationToken, initialEmail]);

  const passwordResults = useMemo(() => validatePassword(password).results, [password]);
  const compactRules = useMemo(() => {
    // Map full rules → compact labels
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
      // Always clear any existing session before buyer sign-up.
      // This prevents an agent/admin session from contaminating the buyer activation flow.
      await supabase.auth.signOut();

      const normalizedEmail = email.trim().toLowerCase();
      if (inviteAnchor?.clientEmail && normalizedEmail !== inviteAnchor.clientEmail) {
        toast.error("Use the same email address your agent sent this invitation to.");
        return;
      }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${postAcceptPath}`,
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("already")) {
          // Account exists — stay on buyer-branded page, switch to sign-in phase
          setPhase("signin");
          return;
        }
        throw signUpError;
      }

      // Supabase returns a user with empty identities when email already exists.
      if (authData?.user && authData.user.identities?.length === 0) {
        // Account exists — stay on buyer-branded page, switch to sign-in phase
        setPhase("signin");
        return;
      }

      if (!authData.user) throw new Error("Account creation failed");

      // If signup did not auto-confirm/return a session, try password sign-in; if that
      // still has no session, the project requires email confirmation — surface clearly.
      let session = authData.session;
      if (!session) {
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        session = signInData.session ?? null;
      }

      if (!session?.user) {
        setPhase("confirm_email");
        return;
      }

      await finalizeAcceptance();

      if (effectiveAgentId) setPrimaryAgentId(effectiveAgentId);
      setPhase("success");
    } catch (error: any) {
      console.error("Activation error:", error);
      toast.error(error.message || "Failed to activate account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Called when an existing-account buyer signs in to accept their invitation
  const handleSignIn = async () => {
    if (!signinPassword) {
      toast.error("Please enter your password.");
      return;
    }
    setIsSubmitting(true);
    try {
      // Ensure clean slate — clear any admin/agent session
      await supabase.auth.signOut();

      const normalizedEmail = email.trim().toLowerCase();
      if (inviteAnchor?.clientEmail && normalizedEmail !== inviteAnchor.clientEmail) {
        toast.error("Sign in with the email address your invitation was sent to.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: signinPassword,
      });
      if (error) throw error;
      if (!data.user) throw new Error("Sign in failed — please try again.");

      await finalizeAcceptance();

      if (effectiveAgentId) setPrimaryAgentId(effectiveAgentId);
      setPhase("success");
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
          <AACMonogram className="w-10 h-10 mx-auto text-[#0E56F5]" />
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
            <div className="flex items-center gap-2 text-zinc-900">
              <AACMonogram className="w-7 h-7 text-[#0E56F5]" />
              <span className="text-[15px] font-semibold tracking-tight">All Agent Connect</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-zinc-500">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Secure invitation</span>
            </div>
          </div>
        </header>
        <main className="max-w-md mx-auto px-6 py-20">
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0E56F5]/8 text-[#0E56F5] px-3 py-1 text-[12px] font-medium">
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
                className="w-full h-11 rounded-xl bg-[#0E56F5] hover:bg-[#0B47CC] text-white font-medium"
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

  if (phase === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-emerald-50 p-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">You're In</h1>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto">
              Your All Agent Connect account is active and connected to your inviting agent.
            </p>
          </div>
          <Button
            onClick={() => {
              markInviteHandoff();
              navigate(postAcceptPath, { replace: true });
            }}
            className="h-11 px-6 rounded-xl bg-[#0E56F5] hover:bg-[#0B47CC]"
          >
            Go to My Workspace
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "confirm_email") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-amber-50 p-4">
              <ShieldCheck className="h-10 w-10 text-amber-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Confirm your email to continue
            </h1>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto">
              We sent a confirmation link to <strong className="text-zinc-700">{email}</strong>.
              Open it to verify your email, then return to your invitation link to finish activating
              your account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const benefits: { icon: typeof Eye; label: string; iconClass: string }[] = [
    { icon: Eye, label: "View curated listings", iconClass: "text-violet-600" },
    { icon: Heart, label: "Save favorite homes", iconClass: "text-rose-600" },
    { icon: Flame, label: "Receive Hot Sheets instantly", iconClass: "text-red-600" },
    { icon: MessageSquare, label: "Private communication with your agent", iconClass: "text-blue-600" },
  ];

  const inviterName = agentFirstName || "Your agent";

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal top bar */}
      <header className="border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-900">
            <AACMonogram className="w-7 h-7 text-[#0E56F5]" />
            <span className="text-[15px] font-semibold tracking-tight">All Agent Connect</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure invitation</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left — narrative + benefits */}
          <div className="space-y-8 lg:pt-4">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0E56F5]/8 text-[#0E56F5] px-3 py-1 text-[12px] font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Private invitation
              </span>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 leading-[1.15]">
                You've Been Invited to All Agent Connect
              </h1>
              <p className="text-[15px] sm:text-base text-zinc-500 leading-relaxed max-w-md">
                {inviterName} invited you to view listings, save favorites, receive Hot Sheets,
                and communicate privately. Create a password to activate your account.
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

          {/* Right — activation card */}
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
                  {/* Compact inline password rules */}
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
                  className="w-full h-11 rounded-xl bg-[#0E56F5] hover:bg-[#0B47CC] text-white font-medium"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Activating…
                    </>
                  ) : (
                    "Join All Agent Connect"
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

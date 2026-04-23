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

const ClientInvitationSetup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const invitationToken = searchParams.get("invitation_token") || "";
  const initialEmail = searchParams.get("email") || "";
  const agentId = searchParams.get("agent_id") || "";
  const clientId = searchParams.get("client_id") || "";
  const initialFirstName = searchParams.get("first_name") || "";
  const initialLastName = searchParams.get("last_name") || "";

  const [phase, setPhase] = useState<"form" | "signin" | "success">("form");
  const [email, setEmail] = useState(initialEmail);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [agentFirstName, setAgentFirstName] = useState<string>("");
  const isEmailLocked = !!initialEmail;
  const hasNameFromInvite = !!(initialFirstName && initialLastName);
  const postAcceptPath = "/client/dashboard";

  const markInviteHandoff = () => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem("aac_invite_acceptance_handoff", String(Date.now()));
  };

  const ensureBuyerSession = async (normalizedEmail: string, plainPassword: string, expectedUserId?: string) => {
    let { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: plainPassword,
      });
      if (signInError || !signInData.user) {
        throw new Error("Your account was created, but we could not sign you in automatically. Please sign in to complete invite acceptance.");
      }
      session = signInData.session;
    }

    if (!session?.user) {
      throw new Error("We could not establish your buyer session. Please try again.");
    }

    if (expectedUserId && session.user.id !== expectedUserId) {
      throw new Error("Session mismatch detected. Please sign out and retry your invitation link.");
    }

    return session.user.id;
  };

  const ensureActiveRelationship = async (userId: string, invitingAgentId: string, crmClientId?: string) => {
    const { data: rpcResult, error: relationshipError } = await supabase.rpc("activate_agent_relationship", {
      _agent_id: invitingAgentId,
      _crm_client_id: crmClientId || null,
    });
    if (relationshipError) {
      console.error("Relationship activation error:", relationshipError);
      const backendError = [
        relationshipError.code,
        relationshipError.message,
        relationshipError.details,
        relationshipError.hint,
      ]
        .filter(Boolean)
        .join(" | ");
      if (import.meta.env.DEV && backendError) {
        throw new Error(`We could not attach your inviting agent to this account. (${backendError})`);
      }
      throw new Error("We could not attach your inviting agent to this account. Please try again.");
    }

    const { data: relationshipCheck, error: relationshipCheckError } = await supabase
      .from("client_agent_relationships")
      .select("id")
      .eq("client_id", userId)
      .eq("agent_id", invitingAgentId)
      .eq("status", "active")
      .maybeSingle();

    if (relationshipCheckError) {
      console.error("Relationship verification error:", relationshipCheckError);
      const verificationError = [
        relationshipCheckError.code,
        relationshipCheckError.message,
        relationshipCheckError.details,
        relationshipCheckError.hint,
      ]
        .filter(Boolean)
        .join(" | ");
      if (import.meta.env.DEV && verificationError) {
        throw new Error(`Invite accepted, but we could not verify your agent relationship. (${verificationError})`);
      }
      throw new Error("Invite accepted, but we could not verify your agent relationship. Please retry this invite link.");
    }
    if (!relationshipCheck) {
      if (!rpcResult) {
        throw new Error("Invite accepted, but your agent relationship was not activated. Please retry this invite link.");
      }
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
          toast.info("This invitation has already been used");
          setTokenValid(false);
        } else {
          setTokenValid(true);
          if (agentId) {
            const { data: agentData } = await supabase
              .from("agent_profiles")
              .select("first_name")
              .eq("id", agentId)
              .maybeSingle();
            if (agentData) setAgentFirstName(agentData.first_name);
          }
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
  }, [invitationToken, agentId]);

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

      const userId = await ensureBuyerSession(normalizedEmail, password, authData.user.id);
      const nameFields = { first_name: firstName.trim(), last_name: lastName.trim() };

      const { error: updateError, count } = await supabase
        .from("profiles")
        .update(nameFields)
        .eq("id", userId);

      if (!updateError && count === 0) {
        const { error: insertError } = await supabase
          .from("profiles")
          .insert([{ id: userId, email: normalizedEmail, ...nameFields }]);
        if (insertError) throw insertError;
      } else if (updateError) {
        throw updateError;
      }

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "buyer" });
      if (roleError) console.error("Error assigning buyer role:", roleError);

      if (!agentId) {
        throw new Error("Invitation is missing agent context. Please request a new invitation link.");
      }
      await ensureActiveRelationship(userId, agentId, clientId || undefined);

      const { error: tokenUpdateError } = await supabase
        .from("share_tokens")
        .update({
          accepted_at: new Date().toISOString(),
          accepted_by_user_id: userId,
        })
        .eq("token", invitationToken);
      if (tokenUpdateError) {
        throw new Error("Your account is ready, but we could not finalize the invite token. Please retry from your invitation email.");
      }

      if (agentId) setPrimaryAgentId(agentId);

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: signinPassword,
      });
      if (error) throw error;
      if (!data.user) throw new Error("Sign in failed — please try again.");

      const userId = data.user.id;

      if (!agentId) {
        throw new Error("Invitation is missing agent context. Please request a new invitation link.");
      }
      await ensureActiveRelationship(userId, agentId, clientId || undefined);

      const { error: tokenErr } = await supabase
        .from("share_tokens")
        .update({
          accepted_at: new Date().toISOString(),
          accepted_by_user_id: userId,
        })
        .eq("token", invitationToken);
      if (tokenErr) {
        throw new Error("Signed in, but we could not finalize the invite token. Please retry from your invitation email.");
      }

      if (agentId) setPrimaryAgentId(agentId);

      setPhase("success");
    } catch (error: any) {
      console.error("Sign-in error:", error);
      toast.error(error.message || "Sign in failed. Please check your password and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <Loader2 className="h-7 w-7 animate-spin mx-auto text-zinc-400" />
          <p className="text-sm text-zinc-500">Validating invitation…</p>
        </div>
      </div>
    );
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

  const benefits = [
    { icon: Eye, label: "View curated listings" },
    { icon: Heart, label: "Save favorite homes" },
    { icon: Flame, label: "Receive Hot Sheets instantly" },
    { icon: MessageSquare, label: "Private communication with your agent" },
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
                and communicate privately. Create your password to activate your account.
              </p>
            </div>

            <ul className="space-y-3">
              {benefits.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-[14px] text-zinc-700">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-50 border border-zinc-100">
                    <Icon className="w-4 h-4 text-zinc-600" />
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

                {!hasNameFromInvite && (
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
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-[13px] text-zinc-600">Password</Label>
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
                  <Label htmlFor="confirmPassword" className="text-[13px] text-zinc-600">Confirm password</Label>
                  <PasswordInput
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
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

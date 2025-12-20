import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import { Mail, ArrowLeft, Loader2, LogIn, UserPlus, LogOut, Eye, EyeOff, CheckCircle2, Circle, RefreshCw } from "lucide-react";

const emailSchema = z.string().trim().email("Please enter a valid email address");

// Password rules - same as PasswordReset
const passwordRules = [
  { id: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { id: 'symbol', label: 'One symbol (!@#$%^&*)', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

type AuthMode = "signin" | "register" | "forgot-password";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingSession, setExistingSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [signupEmailSent, setSignupEmailSent] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const emailInputRef = useRef<HTMLInputElement>(null);
  const didNavigate = useRef(false);

  // Password validation for register mode
  const passwordValidation = useMemo(() => {
    return passwordRules.map(rule => ({
      ...rule,
      valid: rule.test(password)
    }));
  }, [password]);

  const allPasswordRulesPass = passwordValidation.every(r => r.valid);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  // Check for logout param, reset success, or existing session
  useEffect(() => {
    let mounted = true;

    const handleSession = async () => {
      // Check for ?reset=success to show password reset success message
      if (searchParams.get("reset") === "success") {
        toast.success("Password updated successfully! Please sign in with your new password.");
        // Clear the URL param without triggering navigation
        window.history.replaceState(null, "", "/auth");
      }

      // Check for ?logout=1 param to force sign out
      if (searchParams.get("logout") === "1") {
        await supabase.auth.signOut();
        if (mounted) {
          setCheckingSession(false);
          setExistingSession(false);
        }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!mounted) return;
      
      if (session?.user) {
        setExistingSession(true);
      }
      setCheckingSession(false);
    };

    handleSession();

    return () => {
      mounted = false;
    };
  }, [searchParams]);

  // Listen for auth state changes (for sign in success)
  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        if (event === 'SIGNED_IN' && session?.user && !didNavigate.current) {
          console.log('[Analytics] auth_login_success', { user_id: session.user.id });
          didNavigate.current = true;
          navigate('/auth/callback', { replace: true });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedEmail = emailSchema.parse(email);

      const { error } = await supabase.auth.signInWithPassword({
        email: validatedEmail,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password. Please try again.");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("Please check your email and confirm your account first.");
        } else {
          toast.error(error.message);
        }
      }
      // Success is handled by onAuthStateChange
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to sign in");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedEmail = emailSchema.parse(email);

      if (!allPasswordRulesPass) {
        toast.error("Password does not meet all requirements");
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        setLoading(false);
        return;
      }

      const redirectUrl = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signUp({
        email: validatedEmail,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("This email is already registered. Please sign in instead.");
        } else {
          toast.error(error.message);
        }
      } else {
        // Show the "Check your email" confirmation screen
        setSignupEmail(validatedEmail);
        setSignupEmailSent(true);
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to create account");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: signupEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Confirmation email resent!");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to resend email");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedEmail = emailSchema.parse(email);

      const { error } = await supabase.auth.resetPasswordForEmail(validatedEmail, {
        redirectTo: `${window.location.origin}/password-reset`,
      });

      if (error) throw error;

      setResetEmailSent(true);
      toast.success("Password reset link sent to your email");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to send reset link");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setExistingSession(false);
    setLoading(false);
    toast.success("Signed out successfully");
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setPassword("");
    setConfirmPassword("");
    setResetEmailSent(false);
    setSignupEmailSent(false);
    setSignupEmail("");
  };

  // Loading state while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Already signed in state
  if (existingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl shadow-lg p-8 border border-border text-center">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogIn className="h-6 w-6 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              You're already signed in
            </h1>
            <p className="text-muted-foreground text-sm mb-6">
              You have an active session. Sign out to use a different account.
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => navigate('/auth/callback', { replace: true })}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white"
              >
                Continue to App
              </Button>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" />
                )}
                Sign out and switch account
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Email confirmation sent screen (after successful signup)
  if (signupEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl shadow-lg p-8 border border-border text-center">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="h-6 w-6 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Check Your Email
            </h1>
            <p className="text-muted-foreground text-sm mb-2">
              We sent a confirmation link to
            </p>
            <p className="font-medium text-foreground mb-4">
              {signupEmail}
            </p>
            <p className="text-muted-foreground text-xs mb-6">
              Confirming your email keeps the network agent-only and trusted.
            </p>
            <div className="space-y-3">
              <Button
                onClick={handleResendConfirmation}
                variant="outline"
                className="w-full border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Resend Email
              </Button>
              <Button
                onClick={() => switchMode("signin")}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg p-8 border border-border relative">
          {(mode === "forgot-password" || mode === "register") && (
            <button
              onClick={() => switchMode("signin")}
              className="absolute left-6 top-6 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="h-6 w-6 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              {mode === "signin" && "Welcome Back"}
              {mode === "register" && "Create Your Account"}
              {mode === "forgot-password" && "Reset Password"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {mode === "signin" && "Sign in to your AllAgentConnect account"}
              {mode === "register" && "Join the agent-to-agent network"}
              {mode === "forgot-password" && (resetEmailSent 
                ? "Check your email for the reset link" 
                : "Enter your email to receive a reset link")}
            </p>
          </div>

          {mode === "forgot-password" && resetEmailSent ? (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                We sent a password reset link to <span className="font-medium text-foreground">{email}</span>
              </p>
              <Button
                onClick={() => switchMode("signin")}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white"
              >
                Back to Sign In
              </Button>
            </div>
          ) : (
            <form 
              onSubmit={
                mode === "signin" ? handleSignIn : 
                mode === "register" ? handleRegister : 
                handleForgotPassword
              } 
              className="space-y-4"
            >
              <div>
                <Label htmlFor="email" className="text-sm font-medium">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  autoFocus
                  ref={emailInputRef}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              {mode !== "forgot-password" && (
                <div>
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Password rules checklist - only for register mode */}
              {mode === "register" && password.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                  {passwordValidation.map((rule) => (
                    <div key={rule.id} className="flex items-center gap-2 text-sm">
                      {rule.valid ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={rule.valid ? "text-emerald-700" : "text-muted-foreground"}>
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {mode === "register" && (
                <div>
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1.5"
                  />
                  {confirmPassword.length > 0 && (
                    <div className="flex items-center gap-2 text-sm mt-2">
                      {passwordsMatch ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span className="text-emerald-700">Passwords match</span>
                        </>
                      ) : (
                        <>
                          <Circle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Passwords do not match</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Forgot password link - ONLY on signin mode */}
              {mode === "signin" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => switchMode("forgot-password")}
                    className="text-sm text-emerald-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-slate-900 hover:bg-slate-800 text-white" 
                disabled={loading || (mode === "register" && (!allPasswordRulesPass || !passwordsMatch))}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mode === "signin" && "Signing in..."}
                    {mode === "register" && "Creating account..."}
                    {mode === "forgot-password" && "Sending..."}
                  </>
                ) : (
                  <>
                    {mode === "signin" && (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        Sign In
                      </>
                    )}
                    {mode === "register" && (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Create Account
                      </>
                    )}
                    {mode === "forgot-password" && "Send Reset Link"}
                  </>
                )}
              </Button>
            </form>
          )}

          {mode !== "forgot-password" && !resetEmailSent && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="text-emerald-600 hover:underline font-medium"
                  >
                    Create one
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="text-emerald-600 hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Loader2, Eye, EyeOff, CheckCircle2, Circle, LogOut, Clock } from "lucide-react";
import { Logo } from "@/components/brand";

const emailSchema = z.string().trim().email("Please enter a valid email address");

// Password rules
const passwordRules = [
  { id: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { id: 'symbol', label: 'One symbol (!@#$%^&*)', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

// US States for license dropdown
const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' }, { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' }, { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' }, { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' }, { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' }, { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' }, { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' }, { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' }, { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' }, { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' }, { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' }, { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' }, { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' }, { value: 'DC', label: 'District of Columbia' },
];

type AuthMode = "signin" | "register" | "forgot-password";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("signin");
  
  // Common fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Registration fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseState, setLicenseState] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [existingSession, setExistingSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
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

  // Sync mode state from URL parameter
  useEffect(() => {
    const modeParam = searchParams.get("mode");
    if (modeParam === "register") {
      setMode("register");
    } else if (modeParam === "forgot-password") {
      setMode("forgot-password");
    }
    // Don't reset to signin on empty param - let manual switching work
  }, [searchParams]);

  // Check for logout param, reset success, or existing session
  useEffect(() => {
    let mounted = true;

    const handleSession = async () => {
      // Check for ?reset=success to show password reset success message
      if (searchParams.get("reset") === "success") {
        toast.success("Password updated successfully! Please sign in with your new password.");
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

      // If user wants to register, sign out any existing session first
      const modeParam = searchParams.get("mode");
      if (modeParam === "register") {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await supabase.auth.signOut();
        }
        if (mounted) {
          setCheckingSession(false);
          setExistingSession(false);
        }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!mounted) return;
      
      if (session?.user) {
        // Check for admin role first - admins should go straight to admin panel
        const { data: adminRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (adminRole) {
          // Admin user - redirect directly to admin panel
          if (mounted) {
            didNavigate.current = true;
            navigate('/admin/approvals', { replace: true });
          }
          return;
        }

        setExistingSession(true);
        
        // Fetch agent status to determine UI for non-admin users
        const { data: settings } = await supabase
          .from('agent_settings')
          .select('agent_status')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (mounted && settings) {
          setAgentStatus(settings.agent_status);
        }
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
      // Validate all fields
      const validatedEmail = emailSchema.parse(email);

      if (!firstName.trim() || !lastName.trim()) {
        toast.error("Please enter your first and last name");
        setLoading(false);
        return;
      }

      if (!licenseState || !licenseNumber.trim()) {
        toast.error("Please enter your license information");
        setLoading(false);
        return;
      }

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

      // 1. Create auth user (email confirmation is DISABLED in Supabase settings)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: validatedEmail,
        password,
        options: {
          data: {
            intended_role: 'agent',
          },
        },
      });

      // Check for "fake success" - user exists but identities is empty
      if (authData?.user && authData.user.identities?.length === 0) {
        toast.error("This email is already registered. Please sign in instead.");
        setLoading(false);
        return;
      }

      if (authError) {
        if (authError.message.includes("already registered")) {
          toast.error("This email is already registered. Please sign in instead.");
        } else {
          toast.error(authError.message);
        }
        setLoading(false);
        return;
      }

      const userId = authData.user?.id;
      if (!userId) {
        toast.error("Failed to create account. Please try again.");
        setLoading(false);
        return;
      }

      // 2. Insert agent_profiles
      const { error: profileError } = await supabase
        .from('agent_profiles')
        .insert({
          id: userId,
          email: validatedEmail,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || null,
        });

      if (profileError) {
        console.error("Profile creation error:", profileError);
      }

      // 3. Insert agent_settings with license info and pending status
      const { error: settingsError } = await supabase
        .from('agent_settings')
        .insert({
          user_id: userId,
          license_state: licenseState,
          license_number: licenseNumber.trim(),
          license_last_name: lastName.trim(),
          agent_status: 'pending',
        });

      if (settingsError) {
        console.error("Settings creation error:", settingsError);
      }

      // 4. Insert user_roles with role='agent'
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: 'agent'
        }, {
          onConflict: 'user_id,role'
        });

      if (roleError) {
        console.error("Role assignment error:", roleError);
      }

      // 5. Notify admin of new license for verification (non-blocking)
      try {
        await supabase.functions.invoke('send-verification-submitted', {
          body: {
            email: validatedEmail,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            licenseState: licenseState,
            licenseNumber: licenseNumber.trim(),
          },
        });
        console.log('Admin notification sent for license verification');
      } catch (emailError) {
        console.error('Failed to send admin notification:', emailError);
        // Don't block registration if email fails
      }

      // 6. Redirect to pending-verification
      didNavigate.current = true;
      navigate('/pending-verification', { replace: true });

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedEmail = emailSchema.parse(email);

      // Call edge function to send password reset email via Resend
      const { error: fnError } = await supabase.functions.invoke('send-password-reset', {
        body: { 
          email: validatedEmail,
          redirectUrl: `${window.location.origin}/password-reset`
        }
      });

      if (fnError) throw fnError;

      setResetEmailSent(true);
      toast.success("Password reset link sent to your email");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error("Password reset error:", error);
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
    if (newMode !== "register") {
      setFirstName("");
      setLastName("");
      setPhone("");
      setLicenseState("");
      setLicenseNumber("");
    }
  };

  // Loading state while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-900" />
      </div>
    );
  }

  // Already signed in state - only block signin, not registration
  if (existingSession && mode !== "register") {
    const isPending = agentStatus === 'pending_verification' || agentStatus === 'pending_approval';
    const isVerified = agentStatus === 'verified';
    
    // Still loading agent status
    if (agentStatus === null) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white px-4">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-900" />
        </div>
      );
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-[420px]">
          <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-[0_8px_24px_rgba(0,0,0,0.06)] text-center">
            {isPending ? (
              <>
                <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mx-auto mb-5">
                  <Clock className="w-7 h-7 text-amber-600" />
                </div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-2">
                  Access Request Pending
                </h2>
                <p className="text-neutral-500 text-sm mb-6 leading-relaxed">
                  Your license verification is in progress. We'll notify you once approved.
                </p>
                <div className="space-y-3">
                  <Button
                    onClick={() => navigate('/pending-verification', { replace: true })}
                    className="w-full h-11 bg-aac hover:bg-aac-hover active:bg-aac-active text-white font-medium rounded-xl no-touch-hover focus:outline-none focus-visible:outline-none"
                  >
                    View Request Status
                  </Button>
                  <Button
                    onClick={handleLogout}
                    variant="ghost"
                    className="w-full h-11 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 font-medium rounded-xl"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                    Sign out
                  </Button>
                </div>
              </>
            ) : isVerified ? (
              <>
                <div className="w-14 h-14 bg-aac/10 border border-aac/30 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 className="w-7 h-7 text-aac" />
                </div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-2">
                  Welcome Back
                </h2>
                <p className="text-neutral-500 text-sm mb-6">
                  You're already signed in. Continue to your dashboard.
                </p>
                <div className="space-y-3">
                  <Button
                    onClick={() => navigate('/auth/callback', { replace: true })}
                    className="w-full h-11 bg-aac hover:bg-aac-hover active:bg-aac-active text-white font-medium rounded-xl no-touch-hover focus:outline-none focus-visible:outline-none"
                  >
                    Continue to App
                  </Button>
                  <Button
                    onClick={handleLogout}
                    variant="ghost"
                    className="w-full h-11 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 font-medium rounded-xl"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                    Use Different Account
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 bg-neutral-100 border border-neutral-200 rounded-full flex items-center justify-center mx-auto mb-5">
                  <LogOut className="w-7 h-7 text-neutral-500" />
                </div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-2">
                  Account Already Exists
                </h2>
                <p className="text-neutral-500 text-sm mb-6">
                  You're signed in but your access status is unclear. Sign out to request access with a different account.
                </p>
                <Button
                  onClick={handleLogout}
                  className="w-full h-11 bg-aac hover:bg-aac-hover active:bg-aac-active text-white font-medium rounded-xl no-touch-hover focus:outline-none focus-visible:outline-none"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                  Sign Out
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4 py-8">
      <div className="w-full max-w-[420px]">
        {/* Logo Only */}
        <div className="flex justify-center mb-8">
          <Logo variant="primary" size="lg" />
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-[0_8px_24px_rgba(0,0,0,0.06)] relative">
          {(mode === "forgot-password" || mode === "register") && (
            <button
              onClick={() => switchMode("signin")}
              className="absolute left-6 top-6 text-neutral-400 hover:text-neutral-900 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          {/* Form Header */}
          <div className="text-center mb-6">
            {mode === "forgot-password" && (
              <h2 className="text-xl font-semibold text-neutral-900 mb-1">
                Reset Password
              </h2>
            )}
            {mode === "forgot-password" && (
              <p className="text-sm text-neutral-600">
                {resetEmailSent 
                  ? "Check your email for the reset link" 
                  : "Enter your email to receive a reset link"}
              </p>
            )}
          </div>

          {mode === "forgot-password" && resetEmailSent ? (
            <div className="space-y-4">
              <p className="text-center text-sm text-neutral-600">
                We sent a password reset link to <span className="font-medium text-neutral-900">{email}</span>
              </p>
              <Button
                onClick={() => switchMode("signin")}
                className="w-full h-11 bg-aac hover:bg-aac-hover active:bg-aac-active text-white font-medium rounded-xl no-touch-hover focus:outline-none focus-visible:outline-none"
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
              {/* Registration: Name fields */}
              {mode === "register" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="firstName" className="text-[13px] font-medium text-neutral-700">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="John"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="mt-1.5 h-11 border-neutral-300 rounded-[10px] bg-white placeholder:text-neutral-400 focus:ring-0 focus:border-accent focus-visible:ring-0 focus-visible:border-accent"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-[13px] font-medium text-neutral-700">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Smith"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="mt-1.5 h-11 border-neutral-300 rounded-[10px] bg-white placeholder:text-neutral-400 focus:ring-0 focus:border-accent focus-visible:ring-0 focus-visible:border-accent"
                    />
                  </div>
                </div>
              )}

              {/* Email field */}
              <div>
                <Label htmlFor="email" className="text-[13px] font-medium text-neutral-700">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  autoFocus={mode !== "register"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 h-11 border-neutral-300 rounded-[10px] bg-white placeholder:text-neutral-400 focus:ring-0 focus:border-accent focus-visible:ring-0 focus-visible:border-accent"
                />
              </div>

              {/* Registration: Phone field */}
              {mode === "register" && (
                <div>
                  <Label htmlFor="phone" className="text-[13px] font-medium text-neutral-700">
                    Phone <span className="text-neutral-400 font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => {
                      // Format phone as user types
                      const input = e.target.value;
                      const digits = input.replace(/\D/g, "").slice(0, 10);
                      let formatted = "";
                      if (digits.length > 0) {
                        formatted = "(" + digits.slice(0, 3);
                        if (digits.length >= 3) {
                          formatted += ") " + digits.slice(3, 6);
                          if (digits.length >= 6) {
                            formatted += "-" + digits.slice(6);
                          }
                        }
                      }
                      setPhone(formatted);
                    }}
                    className="mt-1.5 h-11 border-neutral-300 rounded-[10px] bg-white placeholder:text-neutral-400 focus:ring-0 focus:border-accent focus-visible:ring-0 focus-visible:border-accent"
                  />
                </div>
              )}

              {/* Registration: License fields */}
              {mode === "register" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="licenseState" className="text-[13px] font-medium text-neutral-700">
                      License State
                    </Label>
                    <Select value={licenseState} onValueChange={setLicenseState}>
                      <SelectTrigger className="mt-1.5 h-11 border-neutral-300 rounded-[10px] bg-white focus:ring-0 focus:border-accent">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="licenseNumber" className="text-[13px] font-medium text-neutral-700">
                      License Number
                    </Label>
                    <Input
                      id="licenseNumber"
                      type="text"
                      placeholder="12345678"
                      required
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className="mt-1.5 h-11 border-neutral-300 rounded-[10px] bg-white placeholder:text-neutral-400 focus:ring-0 focus:border-accent focus-visible:ring-0 focus-visible:border-accent"
                    />
                  </div>
                </div>
              )}

              {/* Password field (not for forgot-password) */}
              {mode !== "forgot-password" && (
                <div>
                  <Label htmlFor="password" className="text-[13px] font-medium text-neutral-700">
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
                      className="h-11 border-neutral-300 rounded-[10px] bg-white placeholder:text-neutral-400 pr-10 focus:ring-0 focus:border-accent focus-visible:ring-0 focus-visible:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-900"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Password rules checklist - only for register mode */}
              {mode === "register" && password.length > 0 && (
                <div className="bg-neutral-50 rounded-lg p-3 space-y-1.5">
                  {passwordValidation.map((rule) => (
                    <div key={rule.id} className="flex items-center gap-2 text-sm">
                      {rule.valid ? (
                        <CheckCircle2 className="h-4 w-4 text-accent" />
                      ) : (
                        <Circle className="h-4 w-4 text-neutral-400" />
                      )}
                      <span className={rule.valid ? "text-accent" : "text-neutral-500"}>
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Confirm password - only for register mode */}
              {mode === "register" && (
                <div>
                  <Label htmlFor="confirmPassword" className="text-[13px] font-medium text-neutral-700">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1.5 h-11 border-neutral-300 rounded-[10px] bg-white placeholder:text-neutral-400 focus:ring-0 focus:border-accent focus-visible:ring-0 focus-visible:border-accent"
                  />
                  {confirmPassword.length > 0 && (
                    <div className="flex items-center gap-2 text-sm mt-2">
                      {passwordsMatch ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-accent" />
                          <span className="text-accent">Passwords match</span>
                        </>
                      ) : (
                        <>
                          <Circle className="h-4 w-4 text-neutral-400" />
                          <span className="text-neutral-500">Passwords do not match</span>
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
                    className="text-[13px] text-aac hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-11 bg-aac hover:bg-aac-hover active:bg-aac-active text-white font-medium rounded-xl focus-visible:ring-2 focus-visible:ring-aac-ring no-touch-hover" 
                disabled={loading || (mode === "register" && (!allPasswordRulesPass || !passwordsMatch || !licenseState || !licenseNumber.trim()))}
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
                    {mode === "signin" && "Sign In"}
                    {mode === "register" && "Create Account"}
                    {mode === "forgot-password" && "Send Reset Link"}
                  </>
                )}
              </Button>
            </form>
          )}

          {mode !== "forgot-password" && !resetEmailSent && (
            <div className="mt-8 pt-6 border-t border-neutral-200 text-center">
              {mode === "signin" ? (
                <div className="space-y-2">
                  <p className="text-neutral-500 text-sm">New to AllAgentConnect?</p>
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl border border-neutral-200 text-neutral-700 font-semibold bg-white hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900 active:bg-neutral-100 transition-colors no-touch-hover-outline focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
                  >
                    Create an Account
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-neutral-500 text-sm">Already have an account?</p>
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl border border-neutral-200 text-neutral-700 font-semibold bg-white hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900 active:bg-neutral-100 transition-colors no-touch-hover-outline focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
                  >
                    Sign In
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;

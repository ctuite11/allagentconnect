import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { z } from "zod";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useAuthRole } from "@/hooks/useAuthRole";
import { LoadingScreen } from "@/components/LoadingScreen";

const signupSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password too long"),
  firstName: z.string().trim().min(1, "First name is required").max(100, "First name too long"),
  lastName: z.string().trim().min(1, "Last name is required").max(100, "Last name too long"),
  phone: z.string().trim().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(1, "Password is required").max(100, "Password too long"),
});

const passwordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password too long"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const ConsumerAuth = () => {
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuthRole();
  const [formLoading, setFormLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  
  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Signup form
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    // Check URL hash for password recovery
    const checkRecoveryFlow = () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      return hashParams.get('type') === 'recovery';
    };

    const isRecovery = checkRecoveryFlow();
    
    if (isRecovery && user) {
      // User clicked reset link - show password reset form, don't redirect
      setIsResettingPassword(true);
      setShowForgotPassword(false);
      setActiveTab("login");
      return;
    }

    // AFTER loading is done and we have user + role, redirect
    if (authLoading) return; // DO NOTHING WHILE LOADING

    if (user && role) {
      if (role === "agent") {
        navigate("/agent-dashboard", { replace: true });
      } else if (role === "buyer") {
        navigate("/client/dashboard", { replace: true });
      }
    }
  }, [authLoading, user, role, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      // Validate input
      const validated = loginSchema.parse({
        email: loginEmail,
        password: loginPassword,
      });

      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password");
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("Successfully logged in!");
      
      // Do NOT navigate here. The auth state listener in useAuthRole
      // will re-run and then the useEffect above will redirect once
      // we know the role.
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("An error occurred during login");
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      const emailValidation = z.string().trim().email("Invalid email address");
      const validated = emailValidation.parse(resetEmail);

      // Call same-origin endpoint (no CORS, no functions/v1)
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: validated,
          redirectUrl: `${window.location.origin}/consumer/auth`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send reset link');
      }

      toast.success("If an account exists with that email, you'll receive a reset link shortly.");
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error("Password reset error:", error);
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      const validated = passwordSchema.parse({
        password: signupPassword,
        confirmPassword: loginPassword,
      });

      const { error } = await supabase.auth.updateUser({
        password: validated.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Password updated successfully!");
      setIsResettingPassword(false);
      setSignupPassword("");
      setLoginPassword("");
      
      // Clear the hash from URL
      window.history.replaceState(null, "", window.location.pathname);
      navigate("/consumer/dashboard");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("An error occurred updating your password");
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      // Validate input
      const validated = signupSchema.parse({
        email: signupEmail,
        password: signupPassword,
        firstName,
        lastName,
        phone,
      });

      const redirectUrl = `${window.location.origin}/auth/callback`;

      const { data, error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: validated.firstName,
            last_name: validated.lastName,
            phone: validated.phone || null,
            intended_role: 'buyer', // Store intended role for callback routing
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("This email is already registered. Please login instead.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Check for "fake success" - user exists but identities is empty
      if (data.user && data.user.identities?.length === 0) {
        toast.error("This email is already registered. Please login instead.");
        return;
      }

      if (data.user) {
        toast.success("Account created! You can now sign in.");
        
        // Send welcome email
        try {
          await supabase.functions.invoke('send-welcome-email', {
            body: {
              email: validated.email,
              firstName: validated.firstName,
              lastName: validated.lastName,
            },
          });
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
        }
        
        setActiveTab("login");
        setLoginEmail(validated.email);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("An error occurred during signup");
      }
    } finally {
      setFormLoading(false);
    }
  };

  // If we have a user but role not yet loaded, show loading
  if (user && (authLoading || !role)) {
    return <LoadingScreen message="Loading your account..." />;
  }

  // If we have user + role, the effect above should be redirecting
  if (user && role && !authLoading) {
    return <LoadingScreen message="Redirecting to your dashboard..." />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <div className="flex-1 container mx-auto px-4 py-24 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome to All Agent Connect</CardTitle>
            <CardDescription>
              {isResettingPassword 
                ? "Enter your new password" 
                : showForgotPassword 
                ? "Reset your password" 
                : "Login or create an account to start finding your dream home"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isResettingPassword ? (
              <div className="space-y-4">
                <button
                  onClick={() => {
                    setIsResettingPassword(false);
                    window.history.replaceState(null, "", window.location.pathname);
                  }}
                  className="p-1.5 -ml-1.5 mb-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      disabled={formLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Password must be at least 6 characters
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      disabled={formLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={formLoading}>
                    {formLoading ? "Updating password..." : "Update Password"}
                  </Button>
                </form>
              </div>
            ) : showForgotPassword ? (
              <div className="space-y-4">
                <button
                  onClick={() => setShowForgotPassword(false)}
                  className="p-1.5 -ml-1.5 mb-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Reset Password</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                </div>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="you@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      disabled={formLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={formLoading}>
                    {formLoading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </form>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      disabled={formLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      disabled={formLoading}
                    />
                  </div>
                    <Button type="submit" className="w-full" disabled={formLoading}>
                      {formLoading ? "Logging in..." : "Login"}
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      className="w-full"
                      onClick={() => setShowForgotPassword(true)}
                      disabled={formLoading}
                    >
                      Forgot password?
                    </Button>
                  </form>
                </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        disabled={formLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        disabled={formLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      disabled={formLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone (Optional)</Label>
                    <FormattedInput
                      id="phone"
                      format="phone"
                      placeholder="1234567890"
                      value={phone}
                      onChange={(value) => setPhone(value)}
                      disabled={formLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      disabled={formLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Password must be at least 6 characters
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={formLoading}>
                    {formLoading ? "Creating account..." : "Create Account"}
                  </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Footer />
    </div>
  );
};

export default ConsumerAuth;

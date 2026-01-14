import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
// Navigation removed - rendered globally in App.tsx
import Footer from "@/components/Footer";
import { Check, X, AlertTriangle } from "lucide-react";

// Password validation rules
const passwordRules = [
  { id: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { id: 'symbol', label: 'One symbol (!@#$%^&*)', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

const PasswordReset = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isValidSession, setIsValidSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      // CRITICAL: Require recovery flow marker from AuthCallback
      const isRecoveryFlow = sessionStorage.getItem("aac_recovery_flow") === "1";
      
      if (!isRecoveryFlow) {
        console.log("[PasswordReset] No recovery flow marker found");
        setSessionError("Invalid or expired reset link. Please request a new password reset.");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        console.log("[PasswordReset] Valid session found for recovery");
        setIsValidSession(true);
      } else {
        console.log("[PasswordReset] No session found");
        setSessionError("Your reset link has expired. Please request a new password reset.");
      }
    };
    
    checkSession();
  }, []);

  // Live validation state
  const validationResults = useMemo(() => {
    return passwordRules.map(rule => ({
      ...rule,
      valid: rule.test(password)
    }));
  }, [password]);

  const allRulesPass = validationResults.every(r => r.valid);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = allRulesPass && passwordsMatch && !loading;

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canSubmit) {
      toast.error("Please ensure all password requirements are met");
      return;
    }
    
    setLoading(true);

    try {
      // Get user email before updating (for confirmation email)
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email;

      const { data, error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        // Check for specific token-related errors
        if (error.message.includes("token") || error.message.includes("expired") || error.message.includes("invalid")) {
          toast.error("Your reset link has expired. Please request a new one.");
          sessionStorage.removeItem("aac_recovery_flow");
          navigate("/auth?mode=forgot-password", { replace: true });
          return;
        }
        toast.error(error.message);
        return;
      }

      // Verify the update actually happened
      if (!data.user) {
        toast.error("Password update failed. Please request a new reset link.");
        sessionStorage.removeItem("aac_recovery_flow");
        navigate("/auth?mode=forgot-password", { replace: true });
        return;
      }

      console.log("[PasswordReset] Password updated successfully");

      // Send password changed confirmation email
      if (userEmail) {
        try {
          await fetch("/api/send-password-changed-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: userEmail }),
          });
        } catch (emailErr) {
          console.error("[PasswordReset] Failed to send confirmation email:", emailErr);
          // Don't block success flow for email failure
        }
      }

      // Clear recovery state
      sessionStorage.removeItem("aac_recovery_flow");
      
      // Clear recovery URL state before redirecting
      window.history.replaceState(null, "", "/password-reset");
      
      // CRITICAL: Sign out immediately to prevent recovery session from touching onboarding
      await supabase.auth.signOut();
      
      toast.success("Password updated successfully! Please sign in with your new password.");
      
      // Redirect to auth with success flag - NO auto-login, NO onboarding
      navigate("/auth?reset=success", { replace: true });
    } catch (error) {
      console.error("[PasswordReset] Error:", error);
      toast.error("An error occurred while resetting your password");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNewLink = () => {
    sessionStorage.removeItem("aac_recovery_flow");
    navigate("/auth?mode=forgot-password", { replace: true });
  };

  // Show error state if session is invalid
  if (sessionError) {
    return (
      <div className="min-h-screen flex flex-col bg-background pt-24">
        <div className="flex-1 container mx-auto px-4 py-12 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive mb-2">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle>Link Expired</CardTitle>
              </div>
              <CardDescription>
                {sessionError}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleRequestNewLink}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white"
              >
                Request New Reset Link
              </Button>
            </CardContent>
          </Card>
        </div>
        
        <Footer />
      </div>
    );
  }

  if (!isValidSession) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background pt-24">
      <div className="flex-1 container mx-auto px-4 py-12 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Reset Your Password</CardTitle>
            <CardDescription>
              Create a strong new password for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* One-time link warning */}
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Important:</strong> This link works once. If you've already opened it or refreshed this page, you may need to request a new reset link.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                
                {/* Password rules checklist */}
                <div className="mt-3 space-y-1.5">
                  {validationResults.map((rule) => (
                    <div 
                      key={rule.id} 
                      className={`flex items-center gap-2 text-xs ${
                        rule.valid ? 'text-green-600' : 'text-muted-foreground'
                      }`}
                    >
                      {rule.valid ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      <span>{rule.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                {confirmPassword.length > 0 && (
                  <div className={`flex items-center gap-2 text-xs ${
                    passwordsMatch ? 'text-green-600' : 'text-destructive'
                  }`}>
                    {passwordsMatch ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                    <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                  </div>
                )}
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-slate-900 hover:bg-slate-800 text-white" 
                disabled={!canSubmit}
              >
                {loading ? "Updating password..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      
      <Footer />
    </div>
  );
};

export default PasswordReset;
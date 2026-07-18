import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { validatePassword } from "@/lib/passwordPolicy";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { AuthShell } from "@/components/auth/AuthShell";
import { clearRecoveryState } from "@/lib/authRecovery";

const authCardSurface =
  "rounded-2xl border border-zinc-100 bg-white p-8 shadow-sm";

const PasswordReset = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isValidSession, setIsValidSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [samePasswordError, setSamePasswordError] = useState(false);
  const [isSetupFlow, setIsSetupFlow] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const setup = sessionStorage.getItem("aac_password_setup_flow") === "1";
      setIsSetupFlow(setup);
      // Agent License-Verified setup must use /agent-setup, not this page.
      if (setup) {
        navigate("/agent-setup", { replace: true });
      }
    }
  }, [navigate]);

  useEffect(() => {
    const checkSession = async () => {
      const isRecoveryFlow = sessionStorage.getItem("aac_recovery_flow") === "1";
      const isSetup = sessionStorage.getItem("aac_password_setup_flow") === "1";

      // Setup flow belongs on /agent-setup — bounce immediately.
      if (isSetup) {
        navigate("/agent-setup", { replace: true });
        return;
      }

      if (!isRecoveryFlow) {
        console.log("[PasswordReset] No recovery/setup flow marker found");
        setSessionError("Invalid or expired reset link. Please request a new password reset.");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        console.log("[PasswordReset] Valid session found for", isSetup ? "setup" : "recovery");
        setIsValidSession(true);
      } else {
        console.log("[PasswordReset] No session found");
        setSessionError("Your reset link has expired. Please request a new password reset.");
      }
    };
    
    checkSession();
  }, []);

  // Live validation state
  const { results: validationResults, allPass: allRulesPass } = useMemo(
    () => validatePassword(password),
    [password]
  );
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
        // Handle same_password error gracefully — resilient detection
        const errCode = (error as any)?.code || (error as any)?.error_code || "";
        const errMsg = (error.message || "").toLowerCase();
        if (errCode === "same_password" || errMsg.includes("same_password") || errMsg.includes("different from the old password")) {
          setSamePasswordError(true);
          setLoading(false);
          return;
        }
        // Check for specific token-related errors
        if (error.message.includes("token") || error.message.includes("expired") || error.message.includes("invalid")) {
          toast.error("Your reset link has expired. Please request a new one.");
          clearRecoveryState();
          navigate("/auth?mode=forgot-password", { replace: true });
          return;
        }
        toast.error(error.message);
        return;
      }

      // Verify the update actually happened
      if (!data.user) {
        toast.error("Password update failed. Please request a new reset link.");
        clearRecoveryState();
        navigate("/auth?mode=forgot-password", { replace: true });
        return;
      }

      console.log("[PasswordReset] Password updated successfully");

      // Canonical activation write. No-op for non-agents; idempotent for
      // agents whose account_activated_at is already set. Ensures that any
      // legitimate password-setup path activates the agent.
      if (data.user?.id) {
        try {
          await supabase.rpc("mark_agent_activated", { _user_id: data.user.id });
        } catch (e) {
          console.warn("[PasswordReset] mark_agent_activated warn:", e);
        }
      }

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
      const wasSetupFlow = isSetupFlow;
      clearRecoveryState();

      // Clear recovery URL state before redirecting
      window.history.replaceState(null, "", "/password-reset");

      if (wasSetupFlow) {
        // Setup flow should never reach this page — guarded above. If it
        // somehow does, route to /agent-setup so activation happens through
        // the one canonical surface (and sets account_activated_at).
        navigate("/agent-setup", { replace: true });
      } else {
        // Normal reset: sign out so they re-authenticate with the new password.
        await supabase.auth.signOut();
        toast.success("Password updated successfully! Please sign in with your new password.");
        navigate("/auth?reset=success", { replace: true });
      }
    } catch (error) {
      console.error("[PasswordReset] Error:", error);
      toast.error("An error occurred while resetting your password");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNewLink = () => {
    clearRecoveryState();
    navigate("/auth?mode=forgot-password", { replace: true });
  };

  const handleGoToSignIn = () => {
    clearRecoveryState();
    navigate("/auth", { replace: true });
  };

  // Show error state if session is invalid
  if (sessionError) {
    return (
      <AuthShell>
        <div className={authCardSurface}>
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Link Expired
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mb-6">{sessionError}</p>
          <Button onClick={handleRequestNewLink} className="w-full" size="lg">
            Request New Reset Link
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (!isValidSession) {
    return null;
  }

  return (
    <AuthShell>
      <div className={authCardSurface}>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {isSetupFlow ? "Set Your Password" : "Reset Your Password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSetupFlow
              ? "Choose a password to finish activating your agent account."
              : "Create a strong new password for your account"}
          </p>
        </div>

        {samePasswordError ? (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md border">
              <p className="text-sm text-foreground font-medium mb-1">
                That's already your current password.
              </p>
              <p className="text-xs text-muted-foreground">
                You set this password during registration. You can sign in directly, or choose a different password below.
              </p>
            </div>
            <Button onClick={handleGoToSignIn} className="w-full" size="lg">
              Sign In →
            </Button>
            <Button
              variant="outline"
              onClick={() => { setSamePasswordError(false); setPassword(""); setConfirmPassword(""); }}
              className="w-full"
              size="lg"
            >
              Choose a Different Password
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Important:</strong> This link works once. If you've already opened it or refreshed this page, you may need to request a new reset link.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <PasswordInput
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <div className="mt-3">
                  <PasswordChecklist password={password} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <PasswordInput
                  id="confirmPassword"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                {confirmPassword.length > 0 && (
                  <PasswordChecklist password={password} confirmPassword={confirmPassword} showMatch />
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={!canSubmit}>
                {loading ? "Updating password..." : isSetupFlow ? "Set Password & Activate" : "Update Password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  );
};

export default PasswordReset;
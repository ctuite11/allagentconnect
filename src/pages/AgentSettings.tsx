import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { validatePassword } from "@/lib/passwordPolicy";
import { toast } from "@/hooks/use-toast";
import { Check, X, Lock, CreditCard } from "lucide-react";
import { Seo } from "@/components/Seo";

export default function AgentSettings() {
  // Password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(() => setLoading(false));
  }, []);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    const { allPass } = validatePassword(newPassword);
    if (!allPass) {
      toast({ title: "Password doesn't meet requirements", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        if (error.message?.includes("same_password")) {
          toast({ title: "New password must be different from current password", variant: "destructive" });
        } else {
          throw error;
        }
        return;
      }
      toast({ title: "Password updated" });
      setShowPasswordForm(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Password change failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  const passwordValidation = validatePassword(newPassword);

  if (loading) {
    return (
      <div className="p-8">
        <Seo
          title="Settings | All Agent Connect"
          description="Manage account preferences, platform settings, and configuration inside All Agent Connect."
          canonical="https://allagentconnect.com/settings"
          noindex
        />
        <div className="h-8 w-48 bg-zinc-100 rounded animate-pulse mb-4" />
        <div className="h-4 w-72 bg-zinc-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <Seo
        title="Settings | All Agent Connect"
        description="Manage account preferences, platform settings, and configuration inside All Agent Connect."
        canonical="https://allagentconnect.com/settings"
        noindex
      />
      <PageHeader
        title="Settings"
        subtitle="Manage your subscription and account security."
      />

      <div className="space-y-10">
        {/* ─── Subscription ─── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Subscription</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Your current plan and billing.</p>
          </div>

          <div className="rounded-xl border border-border bg-zinc-50/50 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">Agent Plan</p>
                <p className="text-xs text-zinc-500">You're on the Agent plan.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Status</p>
                <p className="text-sm text-zinc-700 mt-0.5">Active</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Renewal</p>
                <p className="text-sm text-zinc-700 mt-0.5">—</p>
              </div>
            </div>

            <div className="pt-2">
              <Button variant="outline" size="sm" disabled>
                Upgrade Plan
              </Button>
              <p className="text-xs text-zinc-400 mt-1.5">Subscription plans coming soon.</p>
            </div>
          </div>
        </section>

        {/* ─── Password ─── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Password</h2>
              <p className="text-sm text-zinc-500 mt-0.5">Update your account password.</p>
            </div>
            {!showPasswordForm && (
              <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(true)}>
                Change Password
              </Button>
            )}
          </div>

          {showPasswordForm && (
            <div className="space-y-4 max-w-sm">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New password</Label>
                <PasswordInput
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              {newPassword && (
                <ul className="space-y-1">
                  {passwordValidation.results.map((r) => (
                    <li key={r.id} className="flex items-center gap-1.5 text-xs">
                      {r.valid ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-zinc-300" />
                      )}
                      <span className={r.valid ? "text-emerald-600" : "text-zinc-500"}>{r.label}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-500">Passwords don't match</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleChangePassword}
                  disabled={savingPassword || !passwordValidation.allPass || newPassword !== confirmPassword}
                >
                  {savingPassword ? "Updating..." : "Update Password"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setShowPasswordForm(false); setNewPassword(""); setConfirmPassword(""); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Security placeholder */}
          <div className="border-t border-zinc-100 pt-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <Lock className="h-4 w-4" />
              <span className="text-sm">Security settings coming soon</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

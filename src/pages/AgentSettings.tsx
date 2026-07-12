import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { validatePassword } from "@/lib/passwordPolicy";
import { toast } from "@/hooks/use-toast";
import { Check, X, Lock, CreditCard, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { AgentPageHeader } from "@/components/layout/AgentPageHeader";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";
import { AccountDelegatesCard } from "@/components/AccountDelegatesCard";
import { agentSectionDesc, agentSectionTitle } from "@/lib/agentUi";

export default function AgentSettings() {
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Password change failed", description: message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  const passwordValidation = validatePassword(newPassword);

  if (loading) {
    return (
      <>
        <Seo
          title="Settings | All Agent Connect"
          description="Manage account preferences, platform settings, and configuration inside All Agent Connect."
          canonical="https://allagentconnect.com/settings"
          noindex
        />
        <AgentAacPage className="max-w-2xl pb-12">
          <div aria-hidden className="space-y-3">
            <div className="mb-6 h-7 w-48 animate-pulse rounded-md border border-zinc-100 bg-white" />
            <div className="h-4 w-72 animate-pulse rounded-md border border-zinc-100 bg-white" />
          </div>
        </AgentAacPage>
      </>
    );
  }

  return (
    <>
      <Seo
        title="Settings | All Agent Connect"
        description="Manage account preferences, platform settings, and configuration inside All Agent Connect."
        canonical="https://allagentconnect.com/settings"
        noindex
      />
      <AgentAacPage className="max-w-2xl pb-12">
        <AgentPageHeader
          withTopPadding
          title="Settings"
          subtitle="Manage your subscription and account security."
        />

        <div className="space-y-8">
          <AgentSectionCard className="space-y-4 p-5 md:p-6">
            <div>
              <h2 className={agentSectionTitle}>Subscription</h2>
              <p className={`mt-0.5 ${agentSectionDesc}`}>Your current plan and billing.</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-100 bg-white">
                <CreditCard className="h-4 w-4 text-[#0E56F5]" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900">Agent Plan</p>
                <p className="text-xs text-neutral-500">You&apos;re on the Agent plan.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Status</p>
                <p className="mt-0.5 text-sm text-neutral-700">Active</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Renewal</p>
                <p className="mt-0.5 text-sm text-neutral-700">—</p>
              </div>
            </div>

            <div className="pt-2">
              <Button variant="outline" size="sm" disabled>
                Upgrade Plan
              </Button>
              <p className="mt-1.5 text-xs text-neutral-400">Subscription plans coming soon.</p>
            </div>
          </AgentSectionCard>

          <AgentSectionCard className="space-y-4 p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className={agentSectionTitle}>Password</h2>
                <p className={`mt-0.5 ${agentSectionDesc}`}>Update your account password.</p>
              </div>
              {!showPasswordForm && (
                <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(true)}>
                  Change Password
                </Button>
              )}
            </div>

            {showPasswordForm && (
              <div className="max-w-sm space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">New password</Label>
                  <PasswordInput id="newPassword" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>

                {newPassword && (
                  <ul className="space-y-1">
                    {passwordValidation.results.map((r) => (
                      <li key={r.id} className="flex items-center gap-1.5 text-xs">
                        {r.valid ? (
                          <Check className="h-3.5 w-3.5 text-[#50C878]" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-neutral-300" />
                        )}
                        <span className={r.valid ? "text-[#50C878]" : "text-neutral-500"}>{r.label}</span>
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
                    <p className="text-xs text-red-500">Passwords don&apos;t match</p>
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
                    onClick={() => {
                      setShowPasswordForm(false);
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="border-t border-zinc-100 pt-4">
              <div className="flex items-center gap-2 text-neutral-400">
                <Lock className="h-4 w-4" />
                <span className="text-sm">Security settings coming soon</span>
              </div>
            </div>
          </AgentSectionCard>

          <AccountDelegatesCard />

          <AgentSectionCard className="space-y-3 p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className={agentSectionTitle}>Team Account</h2>
                <p className={agentSectionDesc}>
                  Request a shared public Team Profile. Team Accounts require admin approval before becoming public.
                </p>
              </div>
              <Users className="h-5 w-5 text-neutral-400" />
            </div>
            <div className="flex gap-2">
              <Button asChild size="sm">
                <Link to="/team/request">Create a Team Account</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/manage-team">Manage my team</Link>
              </Button>
            </div>
          </AgentSectionCard>
        </div>
      </AgentAacPage>
    </>
  );
}

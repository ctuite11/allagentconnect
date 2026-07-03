import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";
import { agentSectionDesc, agentSectionTitle } from "@/lib/agentUi";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useAuthRole } from "@/hooks/useAuthRole";
import {
  delegateInviteActivityLabel,
  inviteAccountDelegate,
  listAccountDelegatesForOwner,
  listDelegateInviteActivity,
  revokeAccountDelegate,
  type AccountDelegateRow,
  type DelegateInviteActivityRow,
} from "@/lib/agentDelegatesApi";
import { toast } from "sonner";
import { Clock, Users, UserPlus } from "lucide-react";

export function AccountDelegatesCard() {
  const { enabled: delegatesEnabled, loading: flagLoading } = useFeatureFlag("agent_account_delegates");
  const { isLicensedOwner } = useAuthRole();
  const [delegates, setDelegates] = useState<AccountDelegateRow[]>([]);
  const [activity, setActivity] = useState<DelegateInviteActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [inviting, setInviting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadDelegates = useCallback(async () => {
    setLoading(true);
    const [rows, activityRows] = await Promise.all([
      listAccountDelegatesForOwner(),
      listDelegateInviteActivity(),
    ]);
    setDelegates(rows);
    setActivity(activityRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!delegatesEnabled || !isLicensedOwner) {
      setLoading(false);
      return;
    }
    void loadDelegates();
  }, [delegatesEnabled, isLicensedOwner, loadDelegates]);

  if (flagLoading || !delegatesEnabled || !isLicensedOwner) return null;

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Email is required");
      return;
    }

    setInviting(true);
    const pendingRow = delegates.find(
      (row) => row.status === "invited" && row.invite_email === email,
    );
    const result = await inviteAccountDelegate({
      invite_email: email,
      ...(pendingRow ? { member_id: pendingRow.member_id } : {}),
      display_name: displayName.trim() || undefined,
      role_label: roleLabel.trim() || undefined,
    });
    setInviting(false);

    if (!result.ok) {
      toast.error(result.error || "Failed to send invite");
      return;
    }

    toast.success(result.resent ? "Invitation resent" : "Delegate invite sent");
    setInviteEmail("");
    setDisplayName("");
    setRoleLabel("");
    await loadDelegates();
  };

  const handleResend = async (row: AccountDelegateRow) => {
    setResendingId(row.member_id);
    const result = await inviteAccountDelegate({
      member_id: row.member_id,
      invite_email: row.invite_email,
      ...(row.display_name ? { display_name: row.display_name } : {}),
      ...(row.role_label ? { role_label: row.role_label } : {}),
    });
    setResendingId(null);

    if (!result.ok) {
      toast.error(result.error || "Failed to resend invite");
      return;
    }

    toast.success("Invitation resent");
    await loadDelegates();
  };

  const handleRevoke = async (memberId: string) => {
    setRevokingId(memberId);
    const result = await revokeAccountDelegate(memberId);
    setRevokingId(null);

    if (!result.ok) {
      toast.error(result.error || "Failed to revoke delegate");
      return;
    }

    toast.success("Delegate access revoked");
    await loadDelegates();
  };

  const statusBadge = (row: AccountDelegateRow) => {
    if (row.status === "accepted") {
      return <Badge variant="secondary">Active</Badge>;
    }
    if (row.status === "invited") {
      return <Badge variant="outline">Invited</Badge>;
    }
    return <Badge variant="outline">Revoked</Badge>;
  };

  return (
    <AgentSectionCard className="space-y-4 p-5 md:p-6">
      <div>
        <h2 className={agentSectionTitle}>Account Delegates</h2>
        <p className={`mt-0.5 ${agentSectionDesc}`}>
          Invite team members to manage your clients, listings, and hot sheets on your behalf.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
          <UserPlus className="h-4 w-4 text-[#0E56F5]" />
          Invite a delegate
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="delegate-email">Email</Label>
            <Input
              id="delegate-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="delegate@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="delegate-display-name">Display name (optional)</Label>
            <Input
              id="delegate-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jamie Smith"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="delegate-role-label">Role label (optional)</Label>
            <Input
              id="delegate-role-label"
              value={roleLabel}
              onChange={(e) => setRoleLabel(e.target.value)}
              placeholder="Transaction coordinator"
            />
          </div>
        </div>
        <Button size="sm" onClick={() => void handleInvite()} disabled={inviting}>
          {inviting ? "Sending..." : "Send Invite"}
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
          <Users className="h-4 w-4 text-[#0E56F5]" />
          Delegates &amp; invites
        </div>

        {loading ? (
          <p className="text-sm text-neutral-500">Loading...</p>
        ) : delegates.length === 0 ? (
          <p className="text-sm text-neutral-500">No delegates yet.</p>
        ) : (
          <div className="space-y-2">
            {delegates.map((row) => (
              <div
                key={row.member_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-white px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {row.display_name || row.invite_email}
                  </p>
                  <p className="truncate text-xs text-neutral-500">{row.invite_email}</p>
                  {row.role_label && (
                    <p className="text-xs text-neutral-500">{row.role_label}</p>
                  )}
                  {row.status === "accepted" && row.last_active_at && (
                    <p className="text-xs text-neutral-400">
                      Last active {new Date(row.last_active_at).toLocaleString()}
                      {row.is_online ? " · online" : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(row)}
                  {row.status === "invited" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resendingId === row.member_id}
                      onClick={() => void handleResend(row)}
                    >
                      {resendingId === row.member_id ? "Resending..." : "Resend"}
                    </Button>
                  )}
                  {row.status !== "revoked" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={revokingId === row.member_id}
                      onClick={() => void handleRevoke(row.member_id)}
                    >
                      {revokingId === row.member_id ? "Revoking..." : "Revoke"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activity.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
            <Clock className="h-4 w-4 text-[#0E56F5]" />
            Recent activity
          </div>
          <div className="space-y-2">
            {activity.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-white px-3 py-2 text-sm"
              >
                <span className="text-neutral-700">{delegateInviteActivityLabel(event.action)}</span>
                <span className="shrink-0 text-xs text-neutral-400">
                  {new Date(event.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AgentSectionCard>
  );
}

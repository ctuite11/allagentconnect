import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";
import { agentSectionDesc, agentSectionTitle } from "@/lib/agentUi";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useAuthRole } from "@/hooks/useAuthRole";
import {
  inviteAccountDelegate,
  listAccountDelegatesForOwner,
  listDelegateInviteActivity,
  revokeAccountDelegate,
  type AccountDelegateRow,
  type AssistantScope,
  type DelegateInviteActivityRow,
  delegateInviteActivityLabel,
} from "@/lib/agentDelegatesApi";
import { toast } from "sonner";
import { Clock, UserPlus, Users } from "lucide-react";

export type AssistantSectionProps = {
  scope?: AssistantScope;
  /** When false, skip licensed-owner gate (team managers). Default true for personal. */
  requireLicensedOwner?: boolean;
  /** Extra gate for team managers / leads. */
  canManage?: boolean;
  className?: string;
};

export function AssistantSection({
  scope = { kind: "agent" },
  requireLicensedOwner = scope.kind === "agent",
  canManage = true,
  className,
}: AssistantSectionProps) {
  const { enabled: delegatesEnabled, loading: flagLoading } = useFeatureFlag("agent_account_delegates");
  const { isLicensedOwner, isAdmin } = useAuthRole();
  const [delegates, setDelegates] = useState<AccountDelegateRow[]>([]);
  const [activity, setActivity] = useState<DelegateInviteActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [inviting, setInviting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editRoleLabel, setEditRoleLabel] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const isTeam = scope.kind === "team";
  const licensedOk = !requireLicensedOwner || isLicensedOwner || isAdmin;
  const allowed = delegatesEnabled && licensedOk && canManage;

  const loadDelegates = useCallback(async () => {
    setLoading(true);
    const [rows, activityRows] = await Promise.all([
      listAccountDelegatesForOwner(scope),
      listDelegateInviteActivity(scope),
    ]);
    setDelegates(rows);
    const memberIds = new Set(rows.map((r) => r.member_id));
    setActivity(activityRows.filter((a) => !a.record_id || memberIds.has(a.record_id)));
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    void loadDelegates();
  }, [allowed, loadDelegates]);

  if (flagLoading || !allowed) return null;

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
      role_label: roleLabel.trim() || (isTeam ? "Team assistant" : undefined),
      scope,
    });
    setInviting(false);

    if (!result.ok) {
      toast.error(result.error || "Failed to send invite");
      return;
    }

    toast.success(result.resent ? "Invitation resent" : "Assistant invite sent");
    setInviteEmail("");
    setDisplayName("");
    setRoleLabel("");
    setShowInviteForm(false);
    await loadDelegates();
  };

  const handleResend = async (row: AccountDelegateRow) => {
    setResendingId(row.member_id);
    const result = await inviteAccountDelegate({
      member_id: row.member_id,
      invite_email: row.invite_email,
      ...(row.display_name ? { display_name: row.display_name } : {}),
      ...(row.role_label ? { role_label: row.role_label } : {}),
      scope,
    });
    setResendingId(null);

    if (!result.ok) {
      toast.error(result.error || "Failed to resend invite");
      return;
    }

    toast.success("Invitation resent");
    await loadDelegates();
  };

  const openManage = (row: AccountDelegateRow) => {
    setManagingId(row.member_id);
    setEditDisplayName(row.display_name ?? "");
    setEditRoleLabel(row.role_label ?? "");
  };

  const handleSaveManage = async (row: AccountDelegateRow) => {
    setSavingEdit(true);
    const result = await inviteAccountDelegate({
      member_id: row.member_id,
      invite_email: row.invite_email,
      display_name: editDisplayName.trim() || undefined,
      role_label: editRoleLabel.trim() || undefined,
      scope,
      update_only: true,
    });
    setSavingEdit(false);

    if (!result.ok) {
      toast.error(result.error || "Failed to update assistant");
      return;
    }

    toast.success("Assistant updated");
    setManagingId(null);
    await loadDelegates();
  };

  const handleConfirmRemove = async () => {
    if (!pendingRemoveId) return;
    setRevokingId(pendingRemoveId);
    const result = await revokeAccountDelegate(pendingRemoveId, scope);
    setRevokingId(null);
    setPendingRemoveId(null);

    if (!result.ok) {
      toast.error(result.error || "Failed to remove assistant");
      return;
    }

    toast.success("Assistant removed");
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

  const title = "Assistant";
  const description = isTeam
    ? "Add an assistant to help manage this team and its activity."
    : "Add an assistant to help manage your account and activity.";

  return (
    <AgentSectionCard className={className ?? "space-y-4 p-5 md:p-6"}>
      <div>
        <h2 className={agentSectionTitle}>{title}</h2>
        <p className={`mt-0.5 ${agentSectionDesc}`}>{description}</p>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : delegates.length === 0 && !showInviteForm ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/40 px-4 py-6 text-center">
          <p className="mb-3 text-sm text-neutral-500">No assistant assigned yet.</p>
          <Button size="sm" onClick={() => setShowInviteForm(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Add Assistant
          </Button>
        </div>
      ) : null}

      {(showInviteForm || (delegates.length === 0 && showInviteForm)) && (
        <div className="grid gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
            <UserPlus className="h-4 w-4 text-[#0E56F5]" />
            Invite an assistant
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`assistant-email-${isTeam ? scope.teamId : "agent"}`}>Email</Label>
              <Input
                id={`assistant-email-${isTeam ? scope.teamId : "agent"}`}
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="assistant@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assistant-display-name">Display name (optional)</Label>
              <Input
                id="assistant-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jamie Smith"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assistant-role-label">Role label (optional)</Label>
              <Input
                id="assistant-role-label"
                value={roleLabel}
                onChange={(e) => setRoleLabel(e.target.value)}
                placeholder={isTeam ? "Team assistant" : "Transaction coordinator"}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void handleInvite()} disabled={inviting}>
              {inviting ? "Sending..." : "Send Invite"}
            </Button>
            {delegates.length === 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowInviteForm(false);
                  setInviteEmail("");
                  setDisplayName("");
                  setRoleLabel("");
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {delegates.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
              <Users className="h-4 w-4 text-[#0E56F5]" />
              Assigned assistants
            </div>
            {!showInviteForm ? (
              <Button size="sm" variant="outline" onClick={() => setShowInviteForm(true)}>
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Add Assistant
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            {delegates.map((row) => (
              <div
                key={row.member_id}
                className="rounded-lg border border-zinc-100 bg-white px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {row.display_name || row.invite_email}
                    </p>
                    <p className="truncate text-xs text-neutral-500">{row.invite_email}</p>
                    {row.role_label ? (
                      <p className="text-xs text-neutral-500">{row.role_label}</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-neutral-400">
                      Invited {new Date(row.invited_at).toLocaleDateString()}
                      {row.status === "accepted" && row.last_active_at
                        ? ` · Last active ${new Date(row.last_active_at).toLocaleString()}${
                            row.is_online ? " · online" : ""
                          }`
                        : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {statusBadge(row)}
                    {row.status === "invited" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resendingId === row.member_id}
                        onClick={() => void handleResend(row)}
                      >
                        {resendingId === row.member_id ? "Resending..." : "Resend"}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => openManage(row)}>
                      Manage Assistant
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-700 hover:text-red-800"
                      onClick={() => setPendingRemoveId(row.member_id)}
                    >
                      Remove Assistant
                    </Button>
                  </div>
                </div>

                {managingId === row.member_id ? (
                  <div className="mt-3 grid gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Display name</Label>
                      <Input
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Role label</Label>
                      <Input
                        value={editRoleLabel}
                        onChange={(e) => setEditRoleLabel(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <Button
                        size="sm"
                        disabled={savingEdit}
                        onClick={() => void handleSaveManage(row)}
                      >
                        {savingEdit ? "Saving..." : "Save"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setManagingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activity.length > 0 ? (
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
      ) : null}

      <AlertDialog
        open={Boolean(pendingRemoveId)}
        onOpenChange={(open) => {
          if (!open) setPendingRemoveId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove assistant?</AlertDialogTitle>
            <AlertDialogDescription>
              This revokes their access to{" "}
              {isTeam ? "this team" : "your account"}. They will no longer be able to manage
              activity on your behalf.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(revokingId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(revokingId)}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmRemove();
              }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {revokingId ? "Removing…" : "Remove Assistant"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AgentSectionCard>
  );
}

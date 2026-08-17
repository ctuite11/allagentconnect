import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeveloperEditor } from "@/components/developments/DeveloperDevelopmentLayout";
import {
  addAccountMember,
  removeAccountMember,
  updateAccountMemberRole,
} from "@/lib/developments/workspace";
import type { DevelopmentMemberRole } from "@/lib/developments/publishStatus";
import { toast } from "sonner";

const ROLES: DevelopmentMemberRole[] = ["owner", "editor", "sales", "viewer"];

export default function DeveloperTeamPage() {
  const { development, role, canEdit, bundle, reload } = useDeveloperEditor();
  const isOwner = role === "owner";
  const [userId, setUserId] = useState("");
  const [newRole, setNewRole] = useState<DevelopmentMemberRole>("editor");
  const [saving, setSaving] = useState(false);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !userId.trim()) return;
    setSaving(true);
    const { error } = await addAccountMember({
      account_id: development.account_id,
      user_id: userId.trim(),
      role: newRole,
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    setUserId("");
    toast.success("Member added.");
    await reload();
  };

  const onRoleChange = async (memberId: string, next: DevelopmentMemberRole) => {
    const { error } = await updateAccountMemberRole(memberId, next);
    if (error) toast.error(error);
    else {
      toast.success("Role updated.");
      await reload();
    }
  };

  const onRemove = async (memberId: string) => {
    const { error } = await removeAccountMember(memberId);
    if (error) toast.error(error);
    else {
      toast.success("Member removed.");
      await reload();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Team access</h2>
        <p className="text-sm text-zinc-500">
          Owners can add members by existing AAC user ID. Email invites are not available yet in the
          backend contract.
        </p>
      </div>

      {isOwner ? (
        <form onSubmit={onAdd} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <Label>User ID</Label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="UUID of an existing AAC user"
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as DevelopmentMemberRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding…" : "Add member"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-zinc-600">Only account owners can manage team membership.</p>
      )}

      <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
        {bundle.members.map((member) => (
          <li key={member.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-sm text-zinc-900">{member.user_id}</p>
              <p className="text-xs text-zinc-500">Accepted {new Date(member.accepted_at).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2">
              {isOwner ? (
                <>
                  <Select
                    value={member.role}
                    onValueChange={(v) => void onRoleChange(member.id, v as DevelopmentMemberRole)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void onRemove(member.id)}>
                    Remove
                  </Button>
                </>
              ) : (
                <span className="text-sm capitalize text-zinc-600">{member.role}</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!canEdit && !isOwner ? (
        <p className="text-sm text-zinc-500">You can view team membership for this account.</p>
      ) : null}
    </div>
  );
}

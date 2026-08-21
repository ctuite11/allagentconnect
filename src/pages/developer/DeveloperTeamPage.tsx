import { useState } from "react";
import { Link } from "react-router-dom";
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
  deleteSalesContact,
  removeAccountMember,
  updateAccountMemberRole,
  upsertSalesContact,
} from "@/lib/developments/workspace";
import type { DevelopmentMemberRole } from "@/lib/developments/publishStatus";
import { toast } from "sonner";

const ROLES: DevelopmentMemberRole[] = ["owner", "editor", "sales", "viewer"];

const CONTACT_ROLES = [
  { value: "sales_director", label: "Sales Director" },
  { value: "sales_associate", label: "Sales Associate" },
  { value: "onsite_concierge", label: "On-site Concierge" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Other" },
] as const;

function contactRoleLabel(role: string): string {
  return CONTACT_ROLES.find((r) => r.value === role)?.label ?? role;
}

export default function DeveloperTeamPage() {
  const { development, role, canEdit, bundle, reload } = useDeveloperEditor();
  const isOwner = role === "owner";

  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactRole, setContactRole] = useState<string>("sales_associate");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactPrimary, setContactPrimary] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  const [userId, setUserId] = useState("");
  const [newRole, setNewRole] = useState<DevelopmentMemberRole>("editor");
  const [savingMember, setSavingMember] = useState(false);

  const onAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !contactName.trim()) return;
    if (!contactEmail.trim() && !contactPhone.trim()) {
      toast.error("Add an email or phone so agents can reach this contact.");
      return;
    }
    setSavingContact(true);
    const { error } = await upsertSalesContact({
      development_id: development.id,
      account_id: development.account_id,
      name: contactName.trim(),
      title: contactTitle.trim() || null,
      role: contactRole,
      email: contactEmail.trim() || null,
      phone: contactPhone.trim() || null,
      is_primary: contactPrimary,
      is_active: true,
      receives_leads: true,
      receives_showing_requests: true,
      sort_order: bundle.salesContacts.length,
    });
    setSavingContact(false);
    if (error) {
      toast.error(error);
      return;
    }
    setContactName("");
    setContactTitle("");
    setContactEmail("");
    setContactPhone("");
    setContactPrimary(false);
    setContactRole("sales_associate");
    toast.success("Sales contact added.");
    await reload();
  };

  const onDeleteContact = async (id: string) => {
    const { error } = await deleteSalesContact(id);
    if (error) toast.error(error);
    else {
      toast.success("Sales contact removed.");
      await reload();
    }
  };

  const onAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !userId.trim()) return;
    setSavingMember(true);
    const { error } = await addAccountMember({
      account_id: development.account_id,
      user_id: userId.trim(),
      role: newRole,
    });
    setSavingMember(false);
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
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Sales / Contacts</h2>
        <p className="mt-1 text-sm text-zinc-500">
          People agents see on the mini-site, plus who can edit this project in AAC.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Sales contacts
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Shown on the public mini-site Sales section. At least one email or phone is required.
          </p>
        </div>

        {canEdit ? (
          <form
            onSubmit={onAddContact}
            className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-2"
          >
            <div className="space-y-1 sm:col-span-2">
              <Label>Name</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={contactRole} onValueChange={setContactRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={contactPrimary}
                onChange={(e) => setContactPrimary(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Primary contact
            </label>
            <div>
              <Button type="submit" disabled={savingContact}>
                {savingContact ? "Adding…" : "Add sales contact"}
              </Button>
            </div>
          </form>
        ) : null}

        <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
          {bundle.salesContacts.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-zinc-500">No sales contacts yet.</li>
          ) : (
            bundle.salesContacts.map((contact) => (
              <li
                key={contact.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-zinc-900">
                    {contact.name}
                    {contact.is_primary ? (
                      <span className="ml-2 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                        Primary
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {[contact.title, contactRoleLabel(contact.role)].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-sm text-zinc-600">
                    {[contact.email, contact.phone].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void onDeleteContact(contact.id)}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Workspace access
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Owners can add members by existing AAC user ID. Email invites are not available yet in the
            backend contract.
          </p>
        </div>

        {isOwner ? (
          <form
            onSubmit={onAddMember}
            className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-3"
          >
            <div className="space-y-1 sm:col-span-2">
              <Label>User ID</Label>
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select
                value={newRole}
                onValueChange={(v) => setNewRole(v as DevelopmentMemberRole)}
              >
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
              <Button type="submit" disabled={savingMember}>
                {savingMember ? "Adding…" : "Add member"}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-zinc-600">Only account owners can manage team membership.</p>
        )}

        <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
          {bundle.members.map((member) => (
            <li
              key={member.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-mono text-sm text-zinc-900">{member.user_id}</p>
                <p className="text-xs text-zinc-500">
                  Accepted {new Date(member.accepted_at).toLocaleDateString()}
                </p>
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void onRemove(member.id)}
                    >
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
      </section>

      <Button type="button" variant="outline" asChild>
        <Link to={`/developer/developments/${development.id}/review`}>Continue to Review</Link>
      </Button>
    </div>
  );
}

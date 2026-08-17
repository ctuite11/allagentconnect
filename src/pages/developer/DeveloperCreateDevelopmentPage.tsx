import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { PageHeader } from "@/components/ui/page-header";
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
import { DeveloperAccessGate } from "@/components/developments/DeveloperDevelopmentLayout";
import { Seo } from "@/components/Seo";
import { canMemberEditContent, slugifyDevelopmentName } from "@/lib/developments/publishStatus";
import {
  createDevelopment,
  fetchMyDevelopmentMemberships,
  type DeveloperMembership,
} from "@/lib/developments/workspace";
import { toast } from "sonner";

function CreateInner() {
  const navigate = useNavigate();
  const [memberships, setMemberships] = useState<DeveloperMembership[]>([]);
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [developerName, setDeveloperName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { memberships: rows } = await fetchMyDevelopmentMemberships();
      const editable = rows.filter((m) => canMemberEditContent(m.role));
      setMemberships(editable);
      if (editable[0]) setAccountId(editable[0].account_id);
    })();
  }, []);

  const accounts = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of memberships) {
      map.set(m.account_id, m.account?.name ?? m.account_id);
    }
    return [...map.entries()];
  }, [memberships]);

  const onNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugifyDevelopmentName(value));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !name.trim() || !slug.trim()) {
      toast.error("Account, name, and slug are required.");
      return;
    }
    setSaving(true);
    const { development, error } = await createDevelopment({
      accountId,
      name,
      slug,
      city: city || null,
      state: state || null,
      developerName: developerName || null,
    });
    setSaving(false);
    if (error || !development) {
      toast.error(error ?? "Could not create development.");
      return;
    }
    toast.success("Development created as draft.");
    navigate(`/developer/developments/${development.id}`, { replace: true });
  };

  return (
    <AgentAacPage>
      <Seo title="New development | All Agent Connect" noindex />
      <PageHeader title="Create development" subtitle="Starts as a draft until you submit for AAC review." backTo="/developer" />

      {accounts.length === 0 ? (
        <p className="text-sm text-zinc-600">
          You need owner or editor access on a development account to create projects.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="max-w-xl space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="space-y-2">
            <Label htmlFor="account">Development account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="account">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Project name</Label>
            <Input id="name" value={name} onChange={(e) => onNameChange(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">URL slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugifyDevelopmentName(e.target.value));
              }}
              required
            />
            <p className="text-xs text-zinc-500">Agents will open /developments/{slug || "…"}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="developer">Developer name</Label>
            <Input
              id="developer"
              value={developerName}
              onChange={(e) => setDeveloperName(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create draft"}
          </Button>
        </form>
      )}
    </AgentAacPage>
  );
}

export default function DeveloperCreateDevelopmentPage() {
  return (
    <DeveloperAccessGate>
      <CreateInner />
    </DeveloperAccessGate>
  );
}

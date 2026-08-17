import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeveloperEditor } from "@/components/developments/DeveloperDevelopmentLayout";
import { LIFECYCLE_STATUSES } from "@/lib/developments/publishStatus";
import { lifecycleLabel } from "@/lib/developments/format";
import { updateDevelopmentDetails } from "@/lib/developments/workspace";
import { toast } from "sonner";

function parseStringList(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function DeveloperDetailsPage() {
  const { development, canEdit, reload } = useDeveloperEditor();
  const [form, setForm] = useState({
    name: development.name,
    slug: development.slug,
    lifecycle_status: development.lifecycle_status,
    address: development.address ?? "",
    city: development.city ?? "",
    state: development.state ?? "",
    postal_code: development.postal_code ?? "",
    neighborhood: development.neighborhood ?? "",
    description: development.description ?? "",
    developer_name: development.developer_name ?? "",
    architect_name: development.architect_name ?? "",
    amenities: Array.isArray(development.amenities)
      ? (development.amenities as string[]).join("\n")
      : "",
    highlights: Array.isArray(development.highlights)
      ? (development.highlights as string[]).join("\n")
      : "",
    total_units: development.total_units?.toString() ?? "",
    stories: development.stories?.toString() ?? "",
    estimated_completion: development.estimated_completion ?? "",
    buyer_agent_compensation: development.buyer_agent_compensation ?? "",
    pet_policy: development.pet_policy ?? "",
    parking_description: development.parking_description ?? "",
  });
  const [saving, setSaving] = useState(false);
  const slugLocked = Boolean(development.slug_locked_at);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: development.name,
      slug: development.slug,
      lifecycle_status: development.lifecycle_status,
    }));
  }, [development.id, development.updated_at]);

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    const { error } = await updateDevelopmentDetails(development.id, {
      name: form.name.trim(),
      slug: slugLocked ? undefined : form.slug.trim(),
      lifecycle_status: form.lifecycle_status,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      postal_code: form.postal_code || null,
      neighborhood: form.neighborhood || null,
      description: form.description || null,
      developer_name: form.developer_name || null,
      architect_name: form.architect_name || null,
      amenities: parseStringList(form.amenities),
      highlights: parseStringList(form.highlights),
      total_units: form.total_units ? Number(form.total_units) : null,
      stories: form.stories ? Number(form.stories) : null,
      estimated_completion: form.estimated_completion || null,
      buyer_agent_compensation: form.buyer_agent_compensation || null,
      pet_policy: form.pet_policy || null,
      parking_description: form.parking_description || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Details saved.");
    await reload();
  };

  return (
    <form onSubmit={onSave} className="max-w-3xl space-y-6">
      {!canEdit ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your role is view-only for this account.
        </p>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Project</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={form.name} disabled={!canEdit} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={form.slug}
              disabled={!canEdit || slugLocked}
              onChange={(e) => set("slug", e.target.value)}
            />
            {slugLocked ? (
              <p className="text-xs text-zinc-500">Slug locked after first publish.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Lifecycle</Label>
            <Select
              value={form.lifecycle_status}
              disabled={!canEdit}
              onValueChange={(v) => set("lifecycle_status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIFECYCLE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {lifecycleLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Location</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={form.address} disabled={!canEdit} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" value={form.city} disabled={!canEdit} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" value={form.state} disabled={!canEdit} onChange={(e) => set("state", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal">Postal code</Label>
            <Input id="postal" value={form.postal_code} disabled={!canEdit} onChange={(e) => set("postal_code", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="neighborhood">Neighborhood</Label>
            <Input id="neighborhood" value={form.neighborhood} disabled={!canEdit} onChange={(e) => set("neighborhood", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Overview</h2>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={5}
            value={form.description}
            disabled={!canEdit}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="amenities">Amenities (one per line)</Label>
            <Textarea id="amenities" rows={4} value={form.amenities} disabled={!canEdit} onChange={(e) => set("amenities", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="highlights">Highlights (one per line)</Label>
            <Textarea id="highlights" rows={4} value={form.highlights} disabled={!canEdit} onChange={(e) => set("highlights", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Building & developer</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="developer_name">Developer</Label>
            <Input id="developer_name" value={form.developer_name} disabled={!canEdit} onChange={(e) => set("developer_name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="architect_name">Architect</Label>
            <Input id="architect_name" value={form.architect_name} disabled={!canEdit} onChange={(e) => set("architect_name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_units">Total units</Label>
            <Input id="total_units" value={form.total_units} disabled={!canEdit} onChange={(e) => set("total_units", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stories">Stories</Label>
            <Input id="stories" value={form.stories} disabled={!canEdit} onChange={(e) => set("stories", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimated_completion">Estimated completion</Label>
            <Input id="estimated_completion" value={form.estimated_completion} disabled={!canEdit} onChange={(e) => set("estimated_completion", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comp">Buyer-agent compensation</Label>
            <Input id="comp" value={form.buyer_agent_compensation} disabled={!canEdit} onChange={(e) => set("buyer_agent_compensation", e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="parking">Parking</Label>
            <Input id="parking" value={form.parking_description} disabled={!canEdit} onChange={(e) => set("parking_description", e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="pets">Pet policy</Label>
            <Input id="pets" value={form.pet_policy} disabled={!canEdit} onChange={(e) => set("pet_policy", e.target.value)} />
          </div>
        </div>
      </section>

      {canEdit ? (
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save details"}
        </Button>
      ) : null}
    </form>
  );
}

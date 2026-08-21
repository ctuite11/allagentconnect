import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeveloperEditor } from "@/components/developments/DeveloperDevelopmentLayout";
import {
  DEVELOPMENT_BUILDING_AMENITIES,
  DEVELOPMENT_BUILDING_TYPES,
  DEVELOPMENT_SALES_STATUSES,
  DEVELOPMENT_STAGES,
} from "@/lib/developments/publishStatus";
import {
  buildingAmenityLabel,
  buildingTypeLabel,
  salesStatusLabel,
  stageLabel,
} from "@/lib/developments/format";
import { updateDevelopmentDetails } from "@/lib/developments/workspace";
import { toast } from "sonner";

function parseStringList(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const NONE = "__none__";
const SEASONS = ["Winter", "Spring", "Summer", "Fall"];

function completionYears(current: number | null): number[] {
  const start = new Date().getFullYear();
  const years = new Set<number>();
  for (let y = start; y <= start + 10; y += 1) years.add(y);
  if (current) years.add(current);
  return Array.from(years).sort((a, b) => a - b);
}

export default function DeveloperDetailsPage() {
  const { development, canEdit, reload } = useDeveloperEditor();
  const [form, setForm] = useState({
    name: development.name,
    slug: development.slug,
    stage: development.stage,
    sales_status: development.sales_status ?? "",
    building_type: development.building_type ?? "",
    address: development.address ?? "",
    city: development.city ?? "",
    state: development.state ?? "",
    postal_code: development.postal_code ?? "",
    neighborhood: development.neighborhood ?? "",
    description: development.description ?? "",
    developer_name: development.developer_name ?? "",
    architect_name: development.architect_name ?? "",
    highlights: Array.isArray(development.highlights)
      ? (development.highlights as string[]).join("\n")
      : "",
    amenities_notes: Array.isArray(development.amenities)
      ? (development.amenities as string[]).join("\n")
      : "",
    total_units: development.total_units?.toString() ?? "",
    stories: development.stories?.toString() ?? "",
    expected_completion_year: development.expected_completion_year?.toString() ?? "",
    expected_completion_quarter: development.expected_completion_quarter?.toString() ?? "",
    expected_completion_month: development.expected_completion_month?.toString() ?? "",
    actual_completion_date: development.actual_completion_date ?? "",
    buyer_agent_compensation: development.buyer_agent_compensation ?? "",
    pet_policy: development.pet_policy ?? "",
    parking_description: development.parking_description ?? "",
  });
  const [buildingAmenities, setBuildingAmenities] = useState<string[]>(
    Array.isArray(development.building_amenities)
      ? (development.building_amenities as string[])
      : [],
  );
  const [saving, setSaving] = useState(false);
  const slugLocked = Boolean(development.slug_locked_at);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: development.name,
      slug: development.slug,
      stage: development.stage,
      sales_status: development.sales_status ?? "",
      building_type: development.building_type ?? "",
    }));
    setBuildingAmenities(
      Array.isArray(development.building_amenities)
        ? (development.building_amenities as string[])
        : [],
    );
  }, [development.id, development.updated_at]);

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleAmenity = (value: string, checked: boolean) =>
    setBuildingAmenities((prev) =>
      checked ? Array.from(new Set([...prev, value])) : prev.filter((v) => v !== value),
    );

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    const { error } = await updateDevelopmentDetails(development.id, {
      name: form.name.trim(),
      slug: slugLocked ? undefined : form.slug.trim(),
      stage: form.stage,
      sales_status: form.sales_status || null,
      building_type: form.building_type || null,
      building_amenities: buildingAmenities,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      postal_code: form.postal_code || null,
      neighborhood: form.neighborhood || null,
      description: form.description || null,
      developer_name: form.developer_name || null,
      architect_name: form.architect_name || null,
      amenities: parseStringList(form.amenities_notes),
      highlights: parseStringList(form.highlights),
      total_units: form.total_units ? Number(form.total_units) : null,
      stories: form.stories ? Number(form.stories) : null,
      expected_completion_year: form.expected_completion_year
        ? Number(form.expected_completion_year)
        : null,
      expected_completion_quarter: form.expected_completion_quarter
        ? Number(form.expected_completion_quarter)
        : null,
      expected_completion_month: form.expected_completion_month
        ? Number(form.expected_completion_month)
        : null,
      actual_completion_date:
        form.stage === "completed" ? form.actual_completion_date || null : null,
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
        <h2 className="text-base font-semibold text-zinc-900">Project basics</h2>
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
            <Label htmlFor="developer_name">Developer</Label>
            <Input id="developer_name" value={form.developer_name} disabled={!canEdit} onChange={(e) => set("developer_name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="architect_name">Architect</Label>
            <Input id="architect_name" value={form.architect_name} disabled={!canEdit} onChange={(e) => set("architect_name", e.target.value)} />
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
            {neighborhoodOptions.length > 0 ? (
              <Select
                value={form.neighborhood || NONE}
                disabled={!canEdit}
                onValueChange={(v) => set("neighborhood", v === NONE ? "" : v)}
              >
                <SelectTrigger id="neighborhood">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  {neighborhoodOptions.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input id="neighborhood" value={form.neighborhood} disabled={!canEdit} onChange={(e) => set("neighborhood", e.target.value)} />
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">About</h2>
        <div className="space-y-2">
          <Label htmlFor="description">About this project</Label>
          <Textarea
            id="description"
            rows={5}
            value={form.description}
            disabled={!canEdit}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
      </section>


      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Stage &amp; availability</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Stage describes construction. Sales status describes how the project is being marketed.
            Draft / review / published is controlled at the top of this page.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Stage</Label>
            <Select value={form.stage} disabled={!canEdit} onValueChange={(v) => set("stage", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEVELOPMENT_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {stageLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sales status</Label>
            <Select
              value={form.sales_status || NONE}
              disabled={!canEdit}
              onValueChange={(v) => set("sales_status", v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not set</SelectItem>
                {DEVELOPMENT_SALES_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {salesStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Expected completion — year</Label>
            <Select
              value={form.expected_completion_year || NONE}
              disabled={!canEdit}
              onValueChange={(v) => set("expected_completion_year", v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not set</SelectItem>
                {completionYears(development.expected_completion_year ?? null).map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Expected completion — season</Label>
            <Select
              value={form.expected_completion_quarter || NONE}
              disabled={!canEdit || !form.expected_completion_year}
              onValueChange={(v) => set("expected_completion_quarter", v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not set</SelectItem>
                {SEASONS.map((season, i) => (
                  <SelectItem key={season} value={String(i + 1)}>
                    {season}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.stage === "completed" ? (
            <div className="space-y-2">
              <Label htmlFor="actual_completion_date">Completion date</Label>
              <Input
                id="actual_completion_date"
                type="date"
                value={form.actual_completion_date}
                disabled={!canEdit}
                onChange={(e) => set("actual_completion_date", e.target.value)}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Building</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Building type</Label>
            <Select
              value={form.building_type || NONE}
              disabled={!canEdit}
              onValueChange={(v) => set("building_type", v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not set</SelectItem>
                {DEVELOPMENT_BUILDING_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {buildingTypeLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_units">Total units</Label>
            <Input id="total_units" value={form.total_units} disabled={!canEdit} onChange={(e) => set("total_units", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stories">Stories</Label>
            <Input id="stories" value={form.stories} disabled={!canEdit} onChange={(e) => set("stories", e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Building amenities</Label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {DEVELOPMENT_BUILDING_AMENITIES.map((amenity) => {
              const checked = buildingAmenities.includes(amenity);
              return (
                <label
                  key={amenity}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
                >
                  <Checkbox
                    checked={checked}
                    disabled={!canEdit}
                    onCheckedChange={(v) => toggleAmenity(amenity, v === true)}
                  />
                  {buildingAmenityLabel(amenity)}
                </label>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label htmlFor="amenities_notes">Additional amenities (one per line)</Label>
            <Textarea
              id="amenities_notes"
              rows={3}
              value={form.amenities_notes}
              disabled={!canEdit}
              onChange={(e) => set("amenities_notes", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Terms</h2>
        <div className="grid gap-4 sm:grid-cols-2">
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

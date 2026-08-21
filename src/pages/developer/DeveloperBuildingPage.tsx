import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDeveloperEditor } from "@/components/developments/DeveloperDevelopmentLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDevelopmentDetails } from "@/lib/developments/workspace";
import { toast } from "sonner";

type BuildingFormState = {
  stories: string;
  year_built: string;
  total_units: string;
  total_buildings: string;
  construction_type: string;
  architect_name: string;
  interior_designer_name: string;
};

function toForm(development: {
  stories: number | null;
  year_built: number | null;
  total_units: number | null;
  total_buildings: number | null;
  construction_type: string | null;
  architect_name: string | null;
  interior_designer_name: string | null;
}): BuildingFormState {
  return {
    stories: development.stories != null ? String(development.stories) : "",
    year_built: development.year_built != null ? String(development.year_built) : "",
    total_units: development.total_units != null ? String(development.total_units) : "",
    total_buildings: development.total_buildings != null ? String(development.total_buildings) : "",
    construction_type: development.construction_type ?? "",
    architect_name: development.architect_name ?? "",
    interior_designer_name: development.interior_designer_name ?? "",
  };
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function DeveloperBuildingPage() {
  const navigate = useNavigate();
  const { development, canEdit, reload } = useDeveloperEditor();
  const [form, setForm] = useState<BuildingFormState>(() => toForm(development));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(toForm(development));
  }, [development.id, development.updated_at]);

  const set = <K extends keyof BuildingFormState>(key: K, value: BuildingFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const saveBuilding = async (): Promise<boolean> => {
    if (!canEdit) return false;

    setSaving(true);
    const { error } = await updateDevelopmentDetails(development.id, {
      stories: parseOptionalInt(form.stories),
      year_built: parseOptionalInt(form.year_built),
      total_units: parseOptionalInt(form.total_units),
      total_buildings: parseOptionalInt(form.total_buildings),
      construction_type: form.construction_type.trim() || null,
      architect_name: form.architect_name.trim() || null,
      interior_designer_name: form.interior_designer_name.trim() || null,
    });
    setSaving(false);

    if (error) {
      toast.error(error);
      return false;
    }
    toast.success("Building details saved.");
    await reload();
    return true;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await saveBuilding();
  };

  const onSaveAndContinue = async () => {
    const ok = await saveBuilding();
    if (ok) navigate(`/developer/developments/${development.id}/amenities`);
  };

  return (
    <form className="max-w-3xl space-y-6" onSubmit={onSubmit}>
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Building</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Structural details for this development. Building type, stage, and sales status are set under
          Basics.
        </p>
      </div>

      {!canEdit ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your role is view-only for this account.
        </p>
      ) : null}

      <section className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="stories">Stories / floors</Label>
          <Input
            id="stories"
            inputMode="numeric"
            value={form.stories}
            disabled={!canEdit}
            onChange={(event) => set("stories", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="year_built">Year built</Label>
          <Input
            id="year_built"
            inputMode="numeric"
            value={form.year_built}
            disabled={!canEdit}
            onChange={(event) => set("year_built", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="total_units">Total units</Label>
          <Input
            id="total_units"
            inputMode="numeric"
            value={form.total_units}
            disabled={!canEdit}
            onChange={(event) => set("total_units", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="total_buildings">Total buildings</Label>
          <Input
            id="total_buildings"
            inputMode="numeric"
            value={form.total_buildings}
            disabled={!canEdit}
            onChange={(event) => set("total_buildings", event.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="construction_type">Construction type</Label>
          <Input
            id="construction_type"
            value={form.construction_type}
            disabled={!canEdit}
            onChange={(event) => set("construction_type", event.target.value)}
            placeholder="e.g. Concrete, Steel, Wood frame"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="architect_name">Architect</Label>
          <Input
            id="architect_name"
            value={form.architect_name}
            disabled={!canEdit}
            onChange={(event) => set("architect_name", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="interior_designer_name">Interior designer</Label>
          <Input
            id="interior_designer_name"
            value={form.interior_designer_name}
            disabled={!canEdit}
            onChange={(event) => set("interior_designer_name", event.target.value)}
          />
        </div>
      </section>

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={saving} onClick={() => void onSaveAndContinue()}>
            {saving ? "Saving…" : "Save & Continue"}
          </Button>
          <Button type="submit" variant="outline" disabled={saving}>
            Save
          </Button>
        </div>
      ) : null}
    </form>
  );
}

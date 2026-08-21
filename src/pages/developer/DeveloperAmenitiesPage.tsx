import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckboxOptionGrid } from "@/components/developments/CheckboxOptionGrid";
import { useDeveloperEditor } from "@/components/developments/DeveloperDevelopmentLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BUILDING_AMENITY_OPTIONS } from "@/lib/developments/contractLabels";
import { updateDevelopmentDetails } from "@/lib/developments/workspace";
import { toast } from "sonner";

export default function DeveloperAmenitiesPage() {
  const navigate = useNavigate();
  const { development, canEdit, reload } = useDeveloperEditor();
  const [amenities, setAmenities] = useState<string[]>(
    Array.isArray(development.building_amenities) ? development.building_amenities : [],
  );
  const [notes, setNotes] = useState(development.amenities_notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAmenities(Array.isArray(development.building_amenities) ? development.building_amenities : []);
    setNotes(development.amenities_notes ?? "");
  }, [development.id, development.updated_at]);

  const saveAmenities = async (): Promise<boolean> => {
    if (!canEdit) return false;
    setSaving(true);
    const { error } = await updateDevelopmentDetails(development.id, {
      building_amenities: amenities,
      amenities_notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return false;
    }
    toast.success("Amenities saved.");
    await reload();
    return true;
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveAmenities();
  };

  const onSaveAndContinue = async () => {
    const ok = await saveAmenities();
    if (ok) navigate(`/developer/developments/${development.id}/floor-plans`);
  };

  return (
    <form onSubmit={onSave} className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Amenities</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Select building amenities from the list. Use notes only for anything that doesn’t fit.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <CheckboxOptionGrid
          options={BUILDING_AMENITY_OPTIONS}
          value={amenities}
          onChange={setAmenities}
          disabled={!canEdit}
        />
      </section>

      <section className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-5">
        <Label htmlFor="amenities_notes">Additional notes (optional)</Label>
        <Textarea
          id="amenities_notes"
          rows={3}
          value={notes}
          disabled={!canEdit}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything else agents should know about amenities"
        />
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

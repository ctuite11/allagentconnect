import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckboxOptionGrid } from "@/components/developments/CheckboxOptionGrid";
import { useDeveloperEditor } from "@/components/developments/DeveloperDevelopmentLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BUILDING_AMENITY_OPTIONS } from "@/lib/developments/contractLabels";
import { updateDevelopmentDetails } from "@/lib/developments/workspace";
import { toast } from "sonner";

export default function DeveloperAmenitiesPage() {
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

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    const { error } = await updateDevelopmentDetails(development.id, {
      building_amenities: amenities,
      amenities_notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Amenities saved.");
    await reload();
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
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save amenities"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to={`/developer/developments/${development.id}/floor-plans`}>
              Continue to Floor Plans
            </Link>
          </Button>
        </div>
      ) : null}
    </form>
  );
}

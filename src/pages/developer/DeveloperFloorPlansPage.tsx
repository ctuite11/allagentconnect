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
import { UNIT_TYPE_OPTIONS, unitTypeLabel } from "@/lib/developments/contractLabels";
import { formatBedsBaths, formatUsd } from "@/lib/developments/format";
import { deleteFloorPlan, upsertFloorPlan } from "@/lib/developments/workspace";
import { toast } from "sonner";

export default function DeveloperFloorPlansPage() {
  const { development, canEdit, bundle, reload } = useDeveloperEditor();
  const [name, setName] = useState("");
  const [unitType, setUnitType] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqftMin, setSqftMin] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [saving, setSaving] = useState(false);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !name.trim()) return;
    setSaving(true);
    const { error } = await upsertFloorPlan({
      development_id: development.id,
      account_id: development.account_id,
      name: name.trim(),
      unit_type: unitType || null,
      beds: beds ? Number(beds) : null,
      baths: baths ? Number(baths) : null,
      sqft_min: sqftMin ? Number(sqftMin) : null,
      price_min: priceMin ? Number(priceMin) : null,
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    setName("");
    setUnitType("");
    setBeds("");
    setBaths("");
    setSqftMin("");
    setPriceMin("");
    toast.success("Floor plan added.");
    await reload();
  };

  const onDelete = async (id: string) => {
    const { error } = await deleteFloorPlan(id);
    if (error) toast.error(error);
    else {
      toast.success("Floor plan removed.");
      await reload();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Floor plans</h2>
        <p className="mt-1 text-sm text-zinc-500">Define plan types agents will browse on the mini-site.</p>
      </div>

      {canEdit ? (
        <form onSubmit={onCreate} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-6">
          <div className="space-y-1 sm:col-span-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Unit type</Label>
            <Select value={unitType || undefined} onValueChange={setUnitType}>
              <SelectTrigger>
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                {UNIT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Beds</Label>
            <Input value={beds} onChange={(e) => setBeds(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Baths</Label>
            <Input value={baths} onChange={(e) => setBaths(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Sqft from</Label>
            <Input value={sqftMin} onChange={(e) => setSqftMin(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Price from</Label>
            <Input value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
          </div>
          <div className="flex items-end sm:col-span-6">
            <Button type="submit" disabled={saving}>
              {saving ? "Adding…" : "Add floor plan"}
            </Button>
          </div>
        </form>
      ) : null}

      <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
        {bundle.floorPlans.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-zinc-500">No floor plans yet.</li>
        ) : (
          bundle.floorPlans.map((plan) => (
            <li key={plan.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-zinc-900">{plan.name}</p>
                <p className="text-sm text-zinc-500">
                  {plan.unit_type ? `${unitTypeLabel(plan.unit_type)} · ` : ""}
                  {formatBedsBaths(plan.beds, plan.baths)}
                  {plan.price_min != null ? ` · From ${formatUsd(plan.price_min)}` : ""}
                </p>
              </div>
              {canEdit ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => void onDelete(plan.id)}>
                  Remove
                </Button>
              ) : null}
            </li>
          ))
        )}
      </ul>

      <Button type="button" variant="outline" asChild>
        <Link to={`/developer/developments/${development.id}/units`}>Continue to Units</Link>
      </Button>
    </div>
  );
}

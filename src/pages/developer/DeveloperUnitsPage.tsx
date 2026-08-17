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
import { formatBedsBaths, formatUsd, unitStatusLabel } from "@/lib/developments/format";
import { deleteUnit, upsertUnit } from "@/lib/developments/workspace";
import { toast } from "sonner";

const UNIT_STATUSES = ["available", "reserved", "under_agreement", "sold", "coming_soon"] as const;

export default function DeveloperUnitsPage() {
  const { development, canEdit, bundle, reload } = useDeveloperEditor();
  const defaultPhaseId = bundle.phases[0]?.id ?? "";
  const [unitNumber, setUnitNumber] = useState("");
  const [phaseId, setPhaseId] = useState(defaultPhaseId);
  const [floorPlanId, setFloorPlanId] = useState<string>("none");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqft, setSqft] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<string>("available");
  const [saving, setSaving] = useState(false);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const buildingPhaseId = phaseId || bundle.phases[0]?.id;
    if (!buildingPhaseId || !unitNumber.trim()) {
      toast.error("Unit number and a building phase are required.");
      return;
    }
    setSaving(true);
    const { error } = await upsertUnit({
      development_id: development.id,
      account_id: development.account_id,
      building_phase_id: buildingPhaseId,
      unit_number: unitNumber.trim(),
      floor_plan_id: floorPlanId === "none" ? null : floorPlanId,
      beds: beds ? Number(beds) : null,
      baths: baths ? Number(baths) : null,
      sqft: sqft ? Number(sqft) : null,
      price: price ? Number(price) : null,
      status,
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    setUnitNumber("");
    toast.success("Unit added.");
    await reload();
  };

  const onDelete = async (id: string) => {
    const { error } = await deleteUnit(id);
    if (error) toast.error(error);
    else {
      toast.success("Unit removed.");
      await reload();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Units</h2>
        <p className="text-sm text-zinc-500">Inventory tied to floor plans and availability status.</p>
      </div>

      {canEdit ? (
        <form onSubmit={onCreate} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Unit number</Label>
            <Input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Phase</Label>
            <Select value={phaseId || defaultPhaseId} onValueChange={setPhaseId}>
              <SelectTrigger>
                <SelectValue placeholder="Phase" />
              </SelectTrigger>
              <SelectContent>
                {bundle.phases.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Floor plan</Label>
            <Select value={floorPlanId} onValueChange={setFloorPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {bundle.floorPlans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
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
            <Label>Sqft</Label>
            <Input value={sqft} onChange={(e) => setSqft(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Price</Label>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {unitStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Adding…" : "Add unit"}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Unit</th>
              <th className="px-4 py-3 font-semibold">Beds/Baths</th>
              <th className="px-4 py-3 font-semibold">Price</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {bundle.units.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No units yet.
                </td>
              </tr>
            ) : (
              bundle.units.map((unit) => (
                <tr key={unit.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{unit.unit_number}</td>
                  <td className="px-4 py-3 text-zinc-600">{formatBedsBaths(unit.beds, unit.baths)}</td>
                  <td className="px-4 py-3 text-zinc-600">{formatUsd(unit.price)}</td>
                  <td className="px-4 py-3 text-zinc-600">{unitStatusLabel(unit.status)}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => void onDelete(unit.id)}>
                        Remove
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

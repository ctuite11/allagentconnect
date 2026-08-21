import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckboxOptionGrid } from "@/components/developments/CheckboxOptionGrid";
import { useDeveloperEditor } from "@/components/developments/DeveloperDevelopmentLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  UNIT_FEATURE_OPTIONS,
  UNIT_STATUS_OPTIONS,
  UNIT_TYPE_OPTIONS,
  unitTypeLabel,
} from "@/lib/developments/contractLabels";
import { formatBedsBaths, formatUsd, unitStatusLabel } from "@/lib/developments/format";
import { deleteUnit, upsertUnit } from "@/lib/developments/workspace";
import type { DevelopmentUnitRow } from "@/lib/developments/types";
import { toast } from "sonner";

type UnitFormState = {
  id?: string;
  unit_number: string;
  building_phase_id: string;
  floor_plan_id: string;
  unit_type: string;
  beds: string;
  baths: string;
  sqft: string;
  floor: string;
  price: string;
  price_min: string;
  price_max: string;
  status: string;
  unit_features: string[];
  description: string;
};

function emptyForm(phaseId: string): UnitFormState {
  return {
    unit_number: "",
    building_phase_id: phaseId,
    floor_plan_id: "none",
    unit_type: "",
    beds: "",
    baths: "",
    sqft: "",
    floor: "",
    price: "",
    price_min: "",
    price_max: "",
    status: "available",
    unit_features: [],
    description: "",
  };
}

function fromUnit(unit: DevelopmentUnitRow, fallbackPhase: string): UnitFormState {
  return {
    id: unit.id,
    unit_number: unit.unit_number,
    building_phase_id: unit.building_phase_id || fallbackPhase,
    floor_plan_id: unit.floor_plan_id ?? "none",
    unit_type: unit.unit_type ?? "",
    beds: unit.beds != null ? String(unit.beds) : "",
    baths: unit.baths != null ? String(unit.baths) : "",
    sqft: unit.sqft != null ? String(unit.sqft) : "",
    floor: unit.floor ?? "",
    price: unit.price != null ? String(unit.price) : "",
    price_min: unit.price_min != null ? String(unit.price_min) : "",
    price_max: unit.price_max != null ? String(unit.price_max) : "",
    status: unit.status || "available",
    unit_features: Array.isArray(unit.unit_features) ? unit.unit_features : [],
    description: unit.description ?? "",
  };
}

export default function DeveloperUnitsPage() {
  const { development, canEdit, bundle, reload } = useDeveloperEditor();
  const defaultPhaseId = bundle.phases[0]?.id ?? "";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<UnitFormState>(() => emptyForm(defaultPhaseId));
  const [saving, setSaving] = useState(false);

  const planNameById = useMemo(
    () => new Map(bundle.floorPlans.map((p) => [p.id, p.name])),
    [bundle.floorPlans],
  );

  const set = <K extends keyof UnitFormState>(key: K, value: UnitFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const openCreate = () => {
    setForm(emptyForm(defaultPhaseId));
    setOpen(true);
  };

  const openEdit = (unit: DevelopmentUnitRow) => {
    setForm(fromUnit(unit, defaultPhaseId));
    setOpen(true);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!form.unit_number.trim() || !form.building_phase_id) {
      toast.error("Unit number and building phase are required.");
      return;
    }

    setSaving(true);
    const payload = {
      ...(form.id ? { id: form.id } : {}),
      development_id: development.id,
      account_id: development.account_id,
      building_phase_id: form.building_phase_id,
      unit_number: form.unit_number.trim(),
      floor_plan_id: form.floor_plan_id === "none" ? null : form.floor_plan_id,
      unit_type: form.unit_type || null,
      beds: form.beds ? Number(form.beds) : null,
      baths: form.baths ? Number(form.baths) : null,
      sqft: form.sqft ? Number(form.sqft) : null,
      floor: form.floor || null,
      price: form.price ? Number(form.price) : null,
      price_min: form.price_min ? Number(form.price_min) : null,
      price_max: form.price_max ? Number(form.price_max) : null,
      status: form.status,
      unit_features: form.unit_features,
      description: form.description || null,
    };
    const { error } = await upsertUnit(payload);
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(form.id ? "Unit updated." : "Unit added.");
    setOpen(false);
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Units & availability</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Add residences the same way you’d add a listing — structured fields, not database rows.
          </p>
        </div>
        {canEdit ? (
          <Button type="button" onClick={openCreate}>
            Add unit
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Unit</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Beds/Baths</th>
              <th className="px-4 py-3 font-semibold">Price</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {bundle.units.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  No units yet. Add your first residence to start inventory.
                </td>
              </tr>
            ) : (
              bundle.units.map((unit) => (
                <tr key={unit.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{unit.unit_number}</div>
                    <div className="text-xs text-zinc-500">
                      {unit.floor_plan_id ? planNameById.get(unit.floor_plan_id) : "No floor plan"}
                      {unit.floor ? ` · Floor ${unit.floor}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{unitTypeLabel(unit.unit_type)}</td>
                  <td className="px-4 py-3 text-zinc-600">{formatBedsBaths(unit.beds, unit.baths)}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {unit.price != null
                      ? formatUsd(unit.price)
                      : unit.price_min != null || unit.price_max != null
                        ? `${formatUsd(unit.price_min, { tbdLabel: "" })} – ${formatUsd(unit.price_max, { tbdLabel: "" })}`.trim()
                        : "Price TBD"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{unitStatusLabel(unit.status)}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit ? (
                      <div className="flex justify-end gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(unit)}>
                          Edit
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => void onDelete(unit.id)}>
                          Remove
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <Button type="button" variant="outline" asChild>
          <Link to={`/developer/developments/${development.id}/photos`}>Continue to Media</Link>
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit unit" : "Add unit"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Unit number / name</Label>
                <Input
                  value={form.unit_number}
                  onChange={(e) => set("unit_number", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit type</Label>
                <Select
                  value={form.unit_type || undefined}
                  onValueChange={(v) => set("unit_type", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
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
              <div className="space-y-1.5">
                <Label>Phase / building</Label>
                <Select
                  value={form.building_phase_id}
                  onValueChange={(v) => set("building_phase_id", v)}
                >
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
              <div className="space-y-1.5">
                <Label>Floor plan</Label>
                <Select value={form.floor_plan_id} onValueChange={(v) => set("floor_plan_id", v)}>
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
              <div className="space-y-1.5">
                <Label>Bedrooms</Label>
                <Input value={form.beds} onChange={(e) => set("beds", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Bathrooms</Label>
                <Input value={form.baths} onChange={(e) => set("baths", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Square feet</Label>
                <Input value={form.sqft} onChange={(e) => set("sqft", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Floor</Label>
                <Input value={form.floor} onChange={(e) => set("floor", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>List price</Label>
                <Input value={form.price} onChange={(e) => set("price", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Availability</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Price range min</Label>
                <Input value={form.price_min} onChange={(e) => set("price_min", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Price range max</Label>
                <Input value={form.price_max} onChange={(e) => set("price_max", e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Unit features</Label>
              <CheckboxOptionGrid
                options={UNIT_FEATURE_OPTIONS}
                value={form.unit_features}
                onChange={(next) => set("unit_features", next)}
                columnsClassName="sm:grid-cols-2"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>

            <p className="text-xs text-zinc-500">
              Attach unit photos from the Media step after saving. Floor-plan images are managed under Floor Plans.
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : form.id ? "Save unit" : "Add unit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

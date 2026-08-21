import { useState } from "react";
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
  UNIT_TYPE_OPTIONS,
  unitFeatureLabel,
  unitTypeLabel,
} from "@/lib/developments/contractLabels";
import { formatBedsBaths, formatUsd } from "@/lib/developments/format";
import { deleteFloorPlan, upsertFloorPlan } from "@/lib/developments/workspace";
import type { DevelopmentFloorPlanRow } from "@/lib/developments/types";
import { toast } from "sonner";

type FloorPlanFormState = {
  id?: string;
  name: string;
  unit_type: string;
  beds: string;
  baths: string;
  sqft_min: string;
  sqft_max: string;
  price_min: string;
  price_max: string;
  unit_features: string[];
  description: string;
};

function emptyForm(): FloorPlanFormState {
  return {
    name: "",
    unit_type: "",
    beds: "",
    baths: "",
    sqft_min: "",
    sqft_max: "",
    price_min: "",
    price_max: "",
    unit_features: [],
    description: "",
  };
}

function fromPlan(plan: DevelopmentFloorPlanRow): FloorPlanFormState {
  return {
    id: plan.id,
    name: plan.name,
    unit_type: plan.unit_type ?? "",
    beds: plan.beds != null ? String(plan.beds) : "",
    baths: plan.baths != null ? String(plan.baths) : "",
    sqft_min: plan.sqft_min != null ? String(plan.sqft_min) : "",
    sqft_max: plan.sqft_max != null ? String(plan.sqft_max) : "",
    price_min: plan.price_min != null ? String(plan.price_min) : "",
    price_max: plan.price_max != null ? String(plan.price_max) : "",
    unit_features: Array.isArray(plan.unit_features) ? plan.unit_features : [],
    description: plan.description ?? "",
  };
}

export default function DeveloperFloorPlansPage() {
  const { development, canEdit, bundle, reload } = useDeveloperEditor();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FloorPlanFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FloorPlanFormState>(key: K, value: FloorPlanFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const openCreate = () => {
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (plan: DevelopmentFloorPlanRow) => {
    setForm(fromPlan(plan));
    setOpen(true);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!form.name.trim()) {
      toast.error("Floor plan name is required.");
      return;
    }

    setSaving(true);
    const payload = {
      ...(form.id ? { id: form.id } : {}),
      development_id: development.id,
      account_id: development.account_id,
      name: form.name.trim(),
      unit_type: form.unit_type || null,
      beds: form.beds ? Number(form.beds) : null,
      baths: form.baths ? Number(form.baths) : null,
      sqft_min: form.sqft_min ? Number(form.sqft_min) : null,
      sqft_max: form.sqft_max ? Number(form.sqft_max) : null,
      price_min: form.price_min ? Number(form.price_min) : null,
      price_max: form.price_max ? Number(form.price_max) : null,
      unit_features: form.unit_features,
      description: form.description.trim() || null,
    };
    const { error } = await upsertFloorPlan(payload);
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(form.id ? "Floor plan updated." : "Floor plan added.");
    setOpen(false);
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Floor plans</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Define plan types agents will browse on the mini-site — including unit type and features.
          </p>
        </div>
        {canEdit ? (
          <Button type="button" onClick={openCreate}>
            Add floor plan
          </Button>
        ) : null}
      </div>

      <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
        {bundle.floorPlans.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-zinc-500">No floor plans yet.</li>
        ) : (
          bundle.floorPlans.map((plan) => {
            const features = Array.isArray(plan.unit_features) ? plan.unit_features : [];
            return (
              <li
                key={plan.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-zinc-900">{plan.name}</p>
                  <p className="text-sm text-zinc-500">
                    {plan.unit_type ? `${unitTypeLabel(plan.unit_type)} · ` : ""}
                    {formatBedsBaths(plan.beds, plan.baths)}
                    {plan.price_min != null ? ` · From ${formatUsd(plan.price_min)}` : ""}
                  </p>
                  {features.length > 0 ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      {features.map(unitFeatureLabel).join(", ")}
                    </p>
                  ) : null}
                </div>
                {canEdit ? (
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(plan)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void onDelete(plan.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })
        )}
      </ul>

      <Button type="button" variant="outline" asChild>
        <Link to={`/developer/developments/${development.id}/units`}>Continue to Units</Link>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit floor plan" : "Add floor plan"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
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
                <Label>Bedrooms</Label>
                <Input value={form.beds} onChange={(e) => set("beds", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Bathrooms</Label>
                <Input value={form.baths} onChange={(e) => set("baths", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Sqft min</Label>
                <Input value={form.sqft_min} onChange={(e) => set("sqft_min", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Sqft max</Label>
                <Input value={form.sqft_max} onChange={(e) => set("sqft_max", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Price min</Label>
                <Input value={form.price_min} onChange={(e) => set("price_min", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Price max</Label>
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : form.id ? "Save floor plan" : "Add floor plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

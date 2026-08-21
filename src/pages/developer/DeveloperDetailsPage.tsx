import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { ExpectedCompletionFields, inferCompletionMode, type CompletionMode } from "@/components/developments/ExpectedCompletionFields";
import { useDeveloperEditor } from "@/components/developments/DeveloperDevelopmentLayout";
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
import {
  BUILDING_TYPE_OPTIONS,
  SALES_STATUS_OPTIONS,
  STAGE_OPTIONS,
} from "@/lib/developments/contractLabels";
import { updateDevelopmentDetails } from "@/lib/developments/workspace";
import { normalizeGooglePlace } from "@/lib/google-address";
import { toast } from "sonner";

export default function DeveloperDetailsPage() {
  const navigate = useNavigate();
  const { development, canEdit, reload } = useDeveloperEditor();
  const [form, setForm] = useState({
    name: development.name,
    slug: development.slug,
    stage: development.stage || "planning",
    sales_status: development.sales_status || "not_yet_released",
    building_type: development.building_type || "",
    address: development.address ?? "",
    city: development.city ?? "",
    state: development.state ?? "",
    postal_code: development.postal_code ?? "",
    neighborhood: development.neighborhood ?? "",
    description: development.description ?? "",
    developer_name: development.developer_name ?? "",
    expected_completion_year: development.expected_completion_year,
    expected_completion_quarter: development.expected_completion_quarter,
    expected_completion_month: development.expected_completion_month,
    actual_completion_date: development.actual_completion_date ?? "",
  });
  const [completionMode, setCompletionMode] = useState<CompletionMode>(() =>
    inferCompletionMode(development),
  );
  const [saving, setSaving] = useState(false);
  const slugLocked = Boolean(development.slug_locked_at);

  useEffect(() => {
    setForm({
      name: development.name,
      slug: development.slug,
      stage: development.stage || "planning",
      sales_status: development.sales_status || "not_yet_released",
      building_type: development.building_type || "",
      address: development.address ?? "",
      city: development.city ?? "",
      state: development.state ?? "",
      postal_code: development.postal_code ?? "",
      neighborhood: development.neighborhood ?? "",
      description: development.description ?? "",
      developer_name: development.developer_name ?? "",
      expected_completion_year: development.expected_completion_year,
      expected_completion_quarter: development.expected_completion_quarter,
      expected_completion_month: development.expected_completion_month,
      actual_completion_date: development.actual_completion_date ?? "",
    });
    setCompletionMode(inferCompletionMode(development));
  }, [development.id, development.updated_at]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onPlaceSelect = (place: unknown) => {
    const normalized = normalizeGooglePlace(place as never);
    set("address", normalized.address_line1 || "");
    set("city", normalized.city || "");
    set("state", normalized.state || "");
    set("postal_code", normalized.zip || "");
  };

  const saveBasics = async (): Promise<boolean> => {
    if (!canEdit) return false;
    if (!form.name.trim()) {
      toast.error("Development name is required.");
      return false;
    }

    const quarter =
      completionMode === "quarter" ? form.expected_completion_quarter : null;
    const month = completionMode === "month" ? form.expected_completion_month : null;

    setSaving(true);
    const { error } = await updateDevelopmentDetails(development.id, {
      name: form.name.trim(),
      slug: slugLocked ? undefined : form.slug.trim(),
      stage: form.stage,
      sales_status: form.sales_status,
      building_type: form.building_type || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      postal_code: form.postal_code || null,
      neighborhood: form.neighborhood || null,
      description: form.description || null,
      developer_name: form.developer_name || null,
      expected_completion_year: form.expected_completion_year,
      expected_completion_quarter: quarter,
      expected_completion_month: month,
      actual_completion_date:
        form.stage === "completed" ? form.actual_completion_date || null : null,
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return false;
    }
    toast.success("Basics saved.");
    await reload();
    return true;
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveBasics();
  };

  const onSaveAndContinue = async () => {
    const ok = await saveBasics();
    if (ok) navigate(`/developer/developments/${development.id}/building`);
  };

  return (
    <form onSubmit={onSave} className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Basics</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Core project identity — name, location, type, construction stage, and sales status.
        </p>
      </div>

      {!canEdit ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your role is view-only for this account.
        </p>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Project</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Development name</Label>
            <Input
              id="name"
              value={form.name}
              disabled={!canEdit}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="developer_name">Developer / Company</Label>
            <Input
              id="developer_name"
              value={form.developer_name}
              disabled={!canEdit}
              onChange={(e) => set("developer_name", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={5}
              value={form.description}
              disabled={!canEdit}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Tell agents what makes this project special."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">URL slug</Label>
            <Input
              id="slug"
              value={form.slug}
              disabled={!canEdit || slugLocked}
              onChange={(e) => set("slug", e.target.value)}
            />
            {slugLocked ? (
              <p className="text-xs text-zinc-500">Locked after first publish.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Building type</Label>
            <Select
              value={form.building_type || undefined}
              disabled={!canEdit}
              onValueChange={(v) => set("building_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select building type" />
              </SelectTrigger>
              <SelectContent>
                {BUILDING_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Address</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Street address</Label>
            {canEdit ? (
              <AddressAutocomplete
                value={form.address}
                onChange={(v) => set("address", v)}
                onPlaceSelect={onPlaceSelect}
                placeholder="Start typing the street address"
                className="w-full"
              />
            ) : (
              <Input id="address" value={form.address} disabled />
            )}
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
            <Input
              id="postal"
              value={form.postal_code}
              disabled={!canEdit}
              onChange={(e) => set("postal_code", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="neighborhood">Neighborhood</Label>
            <Input
              id="neighborhood"
              value={form.neighborhood}
              disabled={!canEdit}
              onChange={(e) => set("neighborhood", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Stage & sales
        </h3>
        <p className="text-xs text-zinc-500">
          Stage is construction only. Sales status is marketing. Publish status stays separate (Draft /
          Pending Review / Published…).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Stage</Label>
            <Select
              value={form.stage}
              disabled={!canEdit}
              onValueChange={(v) => set("stage", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sales status</Label>
            <Select
              value={form.sales_status}
              disabled={!canEdit}
              onValueChange={(v) => set("sales_status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SALES_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {form.stage === "completed" ? (
          <div className="space-y-2">
            <Label htmlFor="actual_completion_date">Actual completion date</Label>
            <Input
              id="actual_completion_date"
              type="date"
              value={form.actual_completion_date}
              disabled={!canEdit}
              onChange={(e) => set("actual_completion_date", e.target.value)}
            />
          </div>
        ) : (
          <ExpectedCompletionFields
            mode={completionMode}
            onModeChange={setCompletionMode}
            year={form.expected_completion_year}
            quarter={form.expected_completion_quarter}
            month={form.expected_completion_month}
            onYearChange={(y) => set("expected_completion_year", y)}
            onQuarterChange={(q) => set("expected_completion_quarter", q)}
            onMonthChange={(m) => set("expected_completion_month", m)}
            disabled={!canEdit}
          />
        )}
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

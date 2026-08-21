import { Link } from "react-router-dom";
import { useDeveloperEditor } from "@/components/developments/DeveloperDevelopmentLayout";
import { Button } from "@/components/ui/button";
import { PublishStatusBadge } from "@/components/developments/PublishStatusBadge";
import {
  buildingAmenityLabel,
  buildingTypeLabel,
  formatExpectedCompletion,
} from "@/lib/developments/contractLabels";
import { formatLocation, salesStatusLabel, stageLabel } from "@/lib/developments/format";
import { memberPublishTransitions } from "@/lib/developments/publishStatus";
import { setDevelopmentPublishStatus } from "@/lib/developments/workspace";
import { toast } from "sonner";
import { useState } from "react";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-zinc-100 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="text-sm text-zinc-900">{value || "—"}</dd>
    </div>
  );
}

export default function DeveloperReviewPage() {
  const { development, canEdit, bundle, reload } = useDeveloperEditor();
  const [busy, setBusy] = useState(false);
  const transitions = memberPublishTransitions(development.publish_status);
  const amenities = Array.isArray(development.building_amenities)
    ? development.building_amenities.map(buildingAmenityLabel)
    : [];

  const onSubmit = async () => {
    setBusy(true);
    const { error } = await setDevelopmentPublishStatus(development.id, "pending_review");
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Submitted for AAC review.");
    await reload();
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Review</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Confirm the project looks right, then submit for AAC review when you’re ready.
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <PublishStatusBadge status={development.publish_status} />
          <span className="text-sm text-zinc-500">{development.slug}</span>
        </div>
        <dl>
          <Row label="Name" value={development.name} />
          <Row label="Location" value={formatLocation(development)} />
          <Row label="Developer" value={development.developer_name ?? ""} />
          <Row label="Building type" value={buildingTypeLabel(development.building_type)} />
          <Row label="Stage" value={stageLabel(development.stage)} />
          <Row label="Sales status" value={salesStatusLabel(development.sales_status)} />
          <Row
            label="Expected completion"
            value={
              development.stage === "completed" && development.actual_completion_date
                ? development.actual_completion_date
                : formatExpectedCompletion(development)
            }
          />
          <Row label="Amenities" value={amenities.join(", ")} />
          <Row label="Floor plans" value={String(bundle.floorPlans.length)} />
          <Row label="Units" value={String(bundle.units.length)} />
          <Row label="Photos" value={String(bundle.media.length)} />
          <Row label="Documents" value={String(bundle.documents.length)} />
          <Row label="Sales contacts" value={String(bundle.salesContacts.length)} />
        </dl>
      </section>

      <div className="flex flex-wrap gap-2 text-sm">
        <Button variant="outline" size="sm" asChild>
          <Link to={`/developer/developments/${development.id}`}>Edit basics</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/developer/developments/${development.id}/units`}>Edit units</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/developer/developments/${development.id}/photos`}>Edit media</Link>
        </Button>
      </div>

      {canEdit && transitions.includes("pending_review") ? (
        <Button disabled={busy} onClick={() => void onSubmit()}>
          {busy ? "Submitting…" : "Submit for AAC review"}
        </Button>
      ) : (
        <p className="text-sm text-zinc-500">
          {development.publish_status === "pending_review"
            ? "This project is awaiting AAC review."
            : development.publish_status === "published"
              ? "This project is live for AAC agents."
              : "This project cannot be submitted from its current publish status."}
        </p>
      )}
    </div>
  );
}

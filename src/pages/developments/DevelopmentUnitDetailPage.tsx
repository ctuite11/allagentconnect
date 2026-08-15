import { Link, useParams } from "react-router-dom";
import { useDevelopmentBundle } from "@/components/developments/DevelopmentLayout";
import { UnitStatusBadge } from "@/components/developments/DevelopmentBadges";
import {
  formatBedsBaths,
  formatDateLabel,
  formatSqft,
  formatUsd,
} from "@/lib/developments/format";
import { unitImageMedia } from "@/lib/developments/mediaScope";
import { Button } from "@/components/ui/button";

export default function DevelopmentUnitDetailPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const bundle = useDevelopmentBundle();
  const { development, units, phases, floorPlans, media, mediaUrls } = bundle;
  const unit = units.find((u) => u.id === unitId);
  const phase = unit ? phases.find((p) => p.id === unit.building_phase_id) : null;
  const plan = unit?.floor_plan_id ? floorPlans.find((p) => p.id === unit.floor_plan_id) : null;
  const unitMedia = unitId
    ? unitImageMedia(media, unitId).filter((m) => Boolean(mediaUrls[m.id]))
    : [];

  if (!unit) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center">
        <h2 className="font-display text-xl font-semibold text-zinc-900">Unit not found</h2>
        <p className="mt-2 text-sm text-zinc-600">This unit may have been removed or is not visible.</p>
        <Button asChild className="mt-6" variant="outline">
          <Link to={`/developments/${development.slug}/units`}>Back to units</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-zinc-600">
          <Link to={`/developments/${development.slug}/units`}>← All units</Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2">
              <UnitStatusBadge status={unit.status} />
            </div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-zinc-900">
              Unit {unit.unit_number}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {[phase?.name, plan?.name].filter(Boolean).join(" · ") || development.name}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Price</div>
            <div className="text-2xl font-semibold text-zinc-900">{formatUsd(unit.price)}</div>
          </div>
        </div>
      </header>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Beds / baths", value: formatBedsBaths(unit.beds, unit.baths) },
          { label: "Square feet", value: formatSqft(unit.sqft) || "—" },
          { label: "Floor", value: unit.floor || "—" },
          { label: "Delivery", value: formatDateLabel(unit.estimated_delivery) },
          {
            label: "Parking",
            value:
              unit.parking_spaces != null
                ? `${unit.parking_spaces} space${unit.parking_spaces === 1 ? "" : "s"}${unit.parking_notes ? ` — ${unit.parking_notes}` : ""}`
                : unit.parking_notes || "—",
          },
          { label: "Outdoor", value: unit.outdoor_space || "—" },
          { label: "Views / exposure", value: unit.views_exposure || "—" },
          { label: "Incentives", value: unit.incentives || development.incentives || "—" },
        ].map((row) => (
          <div key={row.label} className="rounded-xl border border-zinc-200 p-4">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{row.label}</dt>
            <dd className="mt-1 text-sm font-medium text-zinc-900 whitespace-pre-wrap">{row.value}</dd>
          </div>
        ))}
      </dl>

      {unit.description ? (
        <section className="space-y-2">
          <h3 className="font-semibold text-zinc-900">Description</h3>
          <p className="max-w-3xl text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">{unit.description}</p>
        </section>
      ) : null}

      {unitMedia.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-semibold text-zinc-900">Unit media</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unitMedia.map((item) => (
              <img
                key={item.id}
                src={mediaUrls[item.id]}
                alt={item.alt || `Unit ${unit.unit_number}`}
                className="aspect-[4/3] w-full rounded-xl object-cover"
                loading="lazy"
              />
            ))}
          </div>
        </section>
      ) : null}

      {plan ? (
        <section className="rounded-2xl border border-zinc-200 p-5">
          <h3 className="font-semibold text-zinc-900">Floor plan</h3>
          <p className="mt-1 text-sm text-zinc-600">
            {plan.name} · {formatBedsBaths(plan.beds, plan.baths)}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to={`/developments/${development.slug}/floor-plans`}>Browse floor plans</Link>
          </Button>
        </section>
      ) : null}
    </div>
  );
}

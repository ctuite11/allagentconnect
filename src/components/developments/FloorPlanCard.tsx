import { Link } from "react-router-dom";
import { BedDouble, Bath, Ruler } from "lucide-react";
import type { DevelopmentFloorPlanRow, DevelopmentUnitRow } from "@/lib/developments/types";
import { formatBedsBaths, formatStartingFrom, formatSqft, formatUsd } from "@/lib/developments/format";
import { inventoryForFloorPlan } from "@/lib/developments/queries";
import { cn } from "@/lib/utils";

export function FloorPlanCard({
  plan,
  units,
  slug,
  imageUrl,
  className,
}: {
  plan: DevelopmentFloorPlanRow;
  units: DevelopmentUnitRow[];
  slug: string;
  imageUrl?: string | null;
  className?: string;
}) {
  const inventory = inventoryForFloorPlan(units, plan.id);
  const fromPrice =
    formatStartingFrom(inventory.startingPrice) ??
    formatStartingFrom(plan.price_min) ??
    "Pricing on request";
  const sqft =
    plan.sqft_min != null && plan.sqft_max != null && plan.sqft_min !== plan.sqft_max
      ? `${formatSqft(plan.sqft_min)?.replace(" sqft", "")}–${formatSqft(plan.sqft_max)}`
      : formatSqft(plan.sqft_min ?? plan.sqft_max);

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
        className,
      )}
    >
      <div className="aspect-[4/3] bg-zinc-50">
        {imageUrl ? (
          <img src={imageUrl} alt={`${plan.name} floor plan`} className="h-full w-full object-contain p-3" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">Floor plan image coming soon</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="font-display text-lg font-semibold text-zinc-900">{plan.name}</h3>
          <p className="mt-1 text-sm text-zinc-600">{formatBedsBaths(plan.beds, plan.baths)}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-zinc-600">
          {sqft ? (
            <span className="inline-flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5" />
              {sqft}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5" />
            {plan.beds != null ? plan.beds : "—"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Bath className="h-3.5 w-3.5" />
            {plan.baths != null ? plan.baths : "—"}
          </span>
        </div>
        <div className="mt-auto space-y-2 border-t border-zinc-100 pt-3">
          <p className="text-base font-semibold text-zinc-900">{fromPrice}</p>
          <p className="text-sm text-zinc-600">
            {inventory.available} available
            {inventory.total > 0 ? ` of ${inventory.total} units` : ""}
          </p>
          <Link
            to={`/developments/${slug}/units?floorPlan=${plan.id}`}
            className="text-sm font-medium text-aac hover:underline"
          >
            View matching units
          </Link>
        </div>
      </div>
    </article>
  );
}

export function UnitCard({
  unit,
  slug,
  phaseName,
  floorPlanName,
}: {
  unit: DevelopmentUnitRow;
  slug: string;
  phaseName?: string | null;
  floorPlanName?: string | null;
}) {
  return (
    <Link
      to={`/developments/${slug}/units/${unit.id}`}
      className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:border-zinc-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-zinc-900">Unit {unit.unit_number}</h3>
          <p className="mt-1 text-sm text-zinc-600">
            {[phaseName, floorPlanName].filter(Boolean).join(" · ") || "Floor plan TBD"}
          </p>
        </div>
        <span className="text-base font-semibold text-zinc-900">{formatUsd(unit.price)}</span>
      </div>
      <p className="mt-3 text-sm text-zinc-600">
        {formatBedsBaths(unit.beds, unit.baths)}
        {unit.sqft != null ? ` · ${formatSqft(unit.sqft)}` : ""}
      </p>
    </Link>
  );
}

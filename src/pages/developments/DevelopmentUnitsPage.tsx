import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDevelopmentBundle } from "@/components/developments/DevelopmentLayout";
import { UnitStatusBadge } from "@/components/developments/DevelopmentBadges";
import {
  formatBedsBaths,
  formatDateLabel,
  formatSqft,
  formatUsd,
  unitStatusLabel,
  formatPriceRange,
} from "@/lib/developments/format";
import type { DevelopmentUnitStatus } from "@/lib/developments/types";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: Array<"all" | DevelopmentUnitStatus> = [
  "all",
  "available",
  "reserved",
  "under_agreement",
  "sold",
  "coming_soon",
];

export default function DevelopmentUnitsPage() {
  const bundle = useDevelopmentBundle();
  const { development, units, phases, floorPlans } = bundle;
  const [params, setParams] = useSearchParams();
  const floorPlanFilter = params.get("floorPlan");
  const [statusFilter, setStatusFilter] = useState<"all" | DevelopmentUnitStatus>("available");

  const phaseById = useMemo(() => new Map(phases.map((p) => [p.id, p.name])), [phases]);
  const planById = useMemo(() => new Map(floorPlans.map((p) => [p.id, p.name])), [floorPlans]);

  const filtered = useMemo(() => {
    return units.filter((unit) => {
      if (floorPlanFilter && unit.floor_plan_id !== floorPlanFilter) return false;
      if (statusFilter !== "all" && unit.status !== statusFilter) return false;
      return true;
    });
  }, [units, floorPlanFilter, statusFilter]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-900">Units</h2>
        <p className="text-sm text-zinc-600">
          Live development inventory for this project — not MLS or AAC listing cards.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              statusFilter === status
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
            )}
          >
            {status === "all" ? "All" : unitStatusLabel(status)}
          </button>
        ))}
        {floorPlanFilter ? (
          <button
            type="button"
            className="rounded-md bg-aac/10 px-3 py-1.5 text-sm font-medium text-aac"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("floorPlan");
              setParams(next, { replace: true });
            }}
          >
            Clear floor plan filter
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-600">
          No units match this filter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Unit</th>
                <th className="px-4 py-3 font-semibold">Phase / building</th>
                <th className="px-4 py-3 font-semibold">Floor plan</th>
                <th className="px-4 py-3 font-semibold">Beds / baths</th>
                <th className="px-4 py-3 font-semibold">Sqft</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Delivery</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((unit) => (
                <tr key={unit.id} className="border-t border-zinc-100 hover:bg-zinc-50/80">
                  <td className="px-4 py-3">
                    <Link
                      to={`/developments/${development.slug}/units/${unit.id}`}
                      className="font-medium text-aac hover:underline"
                    >
                      {unit.unit_number}
                    </Link>
                    {unit.floor ? <div className="text-xs text-zinc-500">Floor {unit.floor}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{phaseById.get(unit.building_phase_id) || "—"}</td>
                  <td className="px-4 py-3 text-zinc-700">
                    {unit.floor_plan_id ? planById.get(unit.floor_plan_id) || "—" : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{formatBedsBaths(unit.beds, unit.baths)}</td>
                  <td className="px-4 py-3 text-zinc-700">{formatSqft(unit.sqft) || "—"}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900">{formatPriceRange(unit.price_min, unit.price_max, unit.price)}</td>
                  <td className="px-4 py-3">
                    <UnitStatusBadge status={unit.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{formatDateLabel(unit.estimated_delivery)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

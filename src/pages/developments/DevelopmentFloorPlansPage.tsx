import { useDevelopmentBundle } from "@/components/developments/DevelopmentLayout";
import { FloorPlanCard } from "@/components/developments/FloorPlanCard";
import { floorPlanImageUrl } from "@/lib/developments/mediaScope";

export default function DevelopmentFloorPlansPage() {
  const bundle = useDevelopmentBundle();
  const { development, floorPlans, units, media, mediaUrls } = bundle;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-900">Floor plans</h2>
        <p className="text-sm text-zinc-600">
          Availability is derived from live unit inventory for {development.name}.
        </p>
      </header>

      {floorPlans.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-600">
          No active floor plans are published for this development yet.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {floorPlans.map((plan) => (
            <FloorPlanCard
              key={plan.id}
              plan={plan}
              units={units}
              slug={development.slug}
              imageUrl={floorPlanImageUrl(media, mediaUrls, plan.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

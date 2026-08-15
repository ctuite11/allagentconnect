import { cn } from "@/lib/utils";
import { lifecycleLabel, tierLabel, unitStatusLabel } from "@/lib/developments/format";

export function LifecycleBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-800 ring-1 ring-black/5",
        className,
      )}
    >
      {lifecycleLabel(status)}
    </span>
  );
}

export function TierBadge({
  tier,
  className,
}: {
  tier: string;
  className?: string;
}) {
  const label = tierLabel(tier);
  if (!label) return null;
  const premium = tier === "premium";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white",
        premium ? "bg-zinc-900" : "bg-aac",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function UnitStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const tone =
    status === "available"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : status === "reserved" || status === "under_agreement"
        ? "bg-amber-50 text-amber-900 ring-amber-200"
        : status === "sold"
          ? "bg-zinc-100 text-zinc-600 ring-zinc-200"
          : "bg-sky-50 text-sky-900 ring-sky-200";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1",
        tone,
        className,
      )}
    >
      {unitStatusLabel(status)}
    </span>
  );
}

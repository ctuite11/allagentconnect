import { cn } from "@/lib/utils";

type AgentResultsSummaryControlsProps = {
  resultsCount: number;
  loading?: boolean;
  resultsView: "map" | "list";
  onResultsViewChange: (view: "map" | "list") => void;
  allowListView?: boolean;
  showViewToggle?: boolean;
  compact?: boolean;
  className?: string;
};

export function AgentResultsSummaryControls({
  resultsCount,
  loading = false,
  resultsView,
  onResultsViewChange,
  allowListView = true,
  showViewToggle = true,
  compact = false,
  className,
}: AgentResultsSummaryControlsProps) {
  const labelClass = compact ? "text-[11px] font-medium text-neutral-500" : "text-[12px] font-medium text-neutral-500";
  const toggleBtnClass = compact
    ? "h-[22px] min-w-[2.25rem] rounded-[4px] px-1.5 text-[11px] font-medium whitespace-nowrap leading-none transition-colors duration-200 ease-out"
    : "h-7 min-w-[2.5rem] rounded-md px-2.5 text-[12px] font-medium leading-none transition-colors duration-200 ease-out";
  const toggleWrapClass = compact
    ? "inline-flex rounded-md border border-neutral-200 bg-white p-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    : "inline-flex rounded-lg border border-neutral-200 bg-white p-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]";
  const countClass = cn(
    "shrink-0 font-medium text-neutral-900 tabular-nums whitespace-nowrap",
    compact ? "text-sm" : "text-[13px]",
  );
  const canToggle = allowListView && showViewToggle && !loading && resultsCount > 0;
  const resultsLabel = loading ? "Results: —" : `Results: ${resultsCount.toLocaleString()}`;

  return (
    <div className={cn("flex min-w-0 shrink-0 items-center gap-3", className)}>
      <p className={countClass}>{resultsLabel}</p>
      {canToggle ? (
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn(labelClass, "whitespace-nowrap")}>View</span>
          <div className={toggleWrapClass}>
            <button
              type="button"
              onClick={() => onResultsViewChange("map")}
              className={cn(
                toggleBtnClass,
                resultsView === "map"
                  ? "bg-neutral-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
              )}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => onResultsViewChange("list")}
              className={cn(
                toggleBtnClass,
                resultsView === "list"
                  ? "bg-neutral-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
              )}
            >
              List
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

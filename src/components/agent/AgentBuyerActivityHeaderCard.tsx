import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { FileText, Flame, Heart, Layers, MessageSquare, Plus, Sparkle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { cn } from "@/lib/utils";
import {
  fetchBuyerActivityMetrics,
  type BuyerActivityMetrics,
} from "@/lib/fetchBuyerActivityMetrics";
import { initialsFromDisplayName } from "@/lib/initials";

/** Same visual language as dashboard “New Matches” stat (single sparkle + corner plus). */
function NewMatchesDashboardStyleIcon({ className }: { className?: string }) {
  return (
    <span className="relative inline-flex h-3.5 w-3.5 shrink-0" aria-hidden>
      <Sparkle className={cn("h-3.5 w-3.5", className)} strokeWidth={2} />
      <Plus className={cn("absolute -right-px -top-px h-2 w-2", className)} strokeWidth={2.5} />
    </span>
  );
}

function MetricsToolbar({
  metrics,
  loading,
  hotSheetRef,
  tintToolbarIcons,
  hotSheetMetricUseFlame,
  hideTopRule,
  newMatchesSparklePlus,
}: {
  metrics: BuyerActivityMetrics | null;
  loading: boolean;
  /** When set (e.g. hot sheet review), show “Hot Sheet #” code instead of buyer-wide sheet count */
  hotSheetRef?: string | null;
  /** My Buyers-style row: muted color per metric icon instead of plain grey. */
  tintToolbarIcons?: boolean;
  /** Success Hub My Buyers: Hot Sheets uses `Flame` (red) like dashboard table. */
  hotSheetMetricUseFlame?: boolean;
  /** Omit top border / extra padding (e.g. Success Hub buyer list cards). */
  hideTopRule?: boolean;
  /** Matches icon matches dashboard “New Matches” tile (sparkle + plus). */
  newMatchesSparklePlus?: boolean;
}) {
  const toolbarRuleClass = hideTopRule
    ? "mt-2 border-0 !border-t-0 pt-0"
    : "mt-2 border-t border-neutral-100 pt-2";

  if (loading) {
    return (
      <div className={toolbarRuleClass}>
        <div className="h-4 max-w-md animate-pulse rounded bg-neutral-100" />
      </div>
    );
  }

  const m = metrics ?? {
    matches: 0,
    views: 0,
    favorites: 0,
    hotSheets: 0,
    messages: 0,
  };

  const showSheetCode = hotSheetRef != null && String(hotSheetRef).trim() !== "";

  type MetricItem =
    | {
        key: string;
        kind: "number";
        icon: LucideIcon;
        label: string;
        value: number;
        iconClass?: string;
      }
    | {
        key: string;
        kind: "text";
        icon: typeof FileText;
        label: string;
        value: string;
      };

  const items: MetricItem[] = [
    showSheetCode
      ? {
          key: "h",
          kind: "text",
          icon: hotSheetMetricUseFlame ? Flame : FileText,
          label: "Hot Sheet #",
          value: String(hotSheetRef).trim(),
        }
      : {
          key: "h",
          kind: "number",
          icon: hotSheetMetricUseFlame ? Flame : Layers,
          label: "Hot sheets",
          value: m.hotSheets,
        },
    { key: "m", kind: "number", icon: Sparkle, label: "Matches", value: m.matches },
    {
      key: "f",
      kind: "number",
      icon: Heart,
      label: "Buyer Favorites",
      value: m.favorites,
      iconClass: tintToolbarIcons
        ? "fill-rose-500 text-rose-500 stroke-rose-500"
        : undefined,
    },
    { key: "msg", kind: "number", icon: MessageSquare, label: "Messages", value: m.messages },
  ];

  return (
    <div className={cn("flex flex-wrap items-center gap-x-0 gap-y-1", toolbarRuleClass)} aria-label="Buyer activity">
      {items.map((it, i) => {
        const iconTintClass = cn(
          "shrink-0 stroke-[2]",
          !tintToolbarIcons
            ? it.kind === "number"
              ? (it.iconClass ?? "text-zinc-400")
              : "text-zinc-400"
            : it.key === "m"
              ? "text-[#16A34A]"
              : it.key === "v"
                ? "text-sky-600"
                : it.key === "f"
                  ? ((it as { iconClass?: string }).iconClass ?? "text-rose-500 stroke-rose-500")
                  : it.key === "h"
                    ? hotSheetMetricUseFlame
                      ? "text-red-600"
                      : it.kind === "text"
                        ? "text-violet-600"
                        : "text-indigo-600"
                    : it.key === "msg"
                      ? "text-blue-600"
                      : "text-zinc-400",
        );

        return (
          <span key={it.key} className="inline-flex items-center">
            {i > 0 ? <span className="mx-2 h-3 w-px shrink-0 bg-neutral-200" aria-hidden /> : null}
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-medium text-neutral-700",
                it.kind === "number" && "tabular-nums",
              )}
              title={it.label}
            >
              {it.key === "m" && newMatchesSparklePlus ? (
                <NewMatchesDashboardStyleIcon className={iconTintClass} />
              ) : (
                <it.icon className={cn("h-3.5 w-3.5", iconTintClass)} aria-hidden />
              )}
              {it.kind === "number" ? it.value.toLocaleString() : it.value}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export type AgentBuyerActivityHeaderCardProps = {
  displayName: string;
  email?: string;
  phone?: string | null;
  /** CRM client id — loads metrics when parent does not supply `metrics` */
  crmClientId: string;
  /** Override initials bubble (e.g. Success Hub My Buyers neutral chrome). */
  avatarClassName?: string;
  /**
   * Parent-provided metrics (skips internal fetch).
   * Pass `metricsLoading` explicitly; if omitted, `metrics={null}` is treated as loading until real values arrive.
   */
  metrics?: BuyerActivityMetrics | null;
  metricsLoading?: boolean;
  trailing?: ReactNode;
  className?: string;
  /** Current hot sheet code on review pages; omit on buyer-wide views (shows sheet count instead). */
  hotSheetRef?: string | null;
  /** Color per metric icon (My Buyers rows); omit elsewhere for neutral grey toolbar. */
  metricsToolbarTintIcons?: boolean;
  /** When true with tint, Hot Sheets metric uses `Flame` + red (Success Hub buyers list). */
  hotSheetMetricUseFlame?: boolean;
  /** Hide divider above metrics row (agent `/agent/buyers` list cards). */
  hideMetricsToolbarTopRule?: boolean;
  /** Matches icon matches dashboard “New Matches” stat (sparkle + corner plus). */
  metricsToolbarNewMatchesSparklePlus?: boolean;
};

/**
 * Shared agent-facing buyer header: identity row + compact activity metrics toolbar.
 */
export function AgentBuyerActivityHeaderCard({
  displayName,
  email,
  phone,
  crmClientId,
  avatarClassName,
  metrics: metricsProp,
  metricsLoading: metricsLoadingProp,
  trailing,
  className,
  hotSheetRef,
  metricsToolbarTintIcons,
  hotSheetMetricUseFlame,
  hideMetricsToolbarTopRule,
  metricsToolbarNewMatchesSparklePlus,
}: AgentBuyerActivityHeaderCardProps) {
  /** Parent supplies metrics when `metrics` is passed (including `null`). Omit `metrics` to fetch internally. */
  const controlled = metricsProp !== undefined;

  const [internalMetrics, setInternalMetrics] = useState<BuyerActivityMetrics | null>(null);
  const [internalLoading, setInternalLoading] = useState(!controlled);

  useEffect(() => {
    if (controlled) return;
    let cancelled = false;
    const forClientId = crmClientId;
    setInternalLoading(true);
    setInternalMetrics(null);
    void (async () => {
      const m = await fetchBuyerActivityMetrics(supabase, forClientId);
      if (!cancelled) {
        setInternalMetrics(m);
        setInternalLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [crmClientId, controlled]);

  const metrics = controlled ? metricsProp : internalMetrics;
  /** When parent omits `metricsLoading`, treat `metrics={null}` as still loading (safe default). */
  const loading = controlled
    ? Boolean(metricsLoadingProp ?? metricsProp === null)
    : internalLoading;

  const phoneDisplay = phone?.trim() ? formatPhoneNumber(phone) : "";
  const contactLine =
    email?.trim() && phoneDisplay ? (
      <>
        {email}
        <span className="text-zinc-300"> · </span>
        {phoneDisplay}
      </>
    ) : email?.trim() ? (
      email
    ) : phoneDisplay ? (
      phoneDisplay
    ) : (
      <span className="text-zinc-400">No email on file</span>
    );

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
              avatarClassName ?? "bg-violet-100 text-violet-700",
            )}
            aria-hidden
          >
            {initialsFromDisplayName(displayName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900">{displayName}</p>
            <p className="truncate text-xs text-zinc-500">{contactLine}</p>
          </div>
        </div>
        {trailing ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:justify-end">{trailing}</div>
        ) : null}
      </div>
      <MetricsToolbar
        metrics={metrics}
        loading={loading}
        hotSheetRef={hotSheetRef}
        tintToolbarIcons={metricsToolbarTintIcons}
        hotSheetMetricUseFlame={hotSheetMetricUseFlame}
        hideTopRule={hideMetricsToolbarTopRule}
        newMatchesSparklePlus={metricsToolbarNewMatchesSparklePlus}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Eye, Heart, Layers, MessageSquare, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { cn } from "@/lib/utils";
import {
  fetchBuyerActivityMetrics,
  type BuyerActivityMetrics,
} from "@/lib/fetchBuyerActivityMetrics";

function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function MetricsToolbar({
  metrics,
  loading,
}: {
  metrics: BuyerActivityMetrics | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-2 border-t border-zinc-100 pt-2">
        <div className="h-4 max-w-md animate-pulse rounded bg-zinc-100" />
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

  const items: { key: string; icon: typeof Target; label: string; value: number }[] = [
    { key: "m", icon: Target, label: "Matches", value: m.matches },
    { key: "v", icon: Eye, label: "Views", value: m.views },
    { key: "f", icon: Heart, label: "Buyer favorites", value: m.favorites },
    { key: "h", icon: Layers, label: "Hot sheets", value: m.hotSheets },
    { key: "msg", icon: MessageSquare, label: "Messages", value: m.messages },
  ];

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-x-0 gap-y-1 border-t border-zinc-100 pt-2"
      aria-label="Buyer activity"
    >
      {items.map((it, i) => (
        <span key={it.key} className="inline-flex items-center">
          {i > 0 ? <span className="mx-2 h-3 w-px shrink-0 bg-zinc-200/90" aria-hidden /> : null}
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-zinc-600"
            title={it.label}
          >
            <it.icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" strokeWidth={2} aria-hidden />
            {it.value.toLocaleString()}
          </span>
        </span>
      ))}
    </div>
  );
}

export type AgentBuyerActivityHeaderCardProps = {
  displayName: string;
  email?: string;
  phone?: string | null;
  /** CRM client id — loads metrics when parent does not supply `metrics` */
  crmClientId: string;
  /**
   * Parent-provided metrics (skips internal fetch). Pass `null` to show zeros while loading.
   */
  metrics?: BuyerActivityMetrics | null;
  metricsLoading?: boolean;
  trailing?: ReactNode;
  className?: string;
};

/**
 * Shared agent-facing buyer header: identity row + compact activity metrics toolbar.
 */
export function AgentBuyerActivityHeaderCard({
  displayName,
  email,
  phone,
  crmClientId,
  metrics: metricsProp,
  metricsLoading: metricsLoadingProp,
  trailing,
  className,
}: AgentBuyerActivityHeaderCardProps) {
  /** Parent supplies metrics when `metrics` is passed (including `null`). Omit `metrics` to fetch internally. */
  const controlled = metricsProp !== undefined;

  const [internalMetrics, setInternalMetrics] = useState<BuyerActivityMetrics | null>(null);
  const [internalLoading, setInternalLoading] = useState(!controlled);

  useEffect(() => {
    if (controlled) return;
    let cancelled = false;
    setInternalLoading(true);
    (async () => {
      const m = await fetchBuyerActivityMetrics(supabase, crmClientId);
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
  const loading = controlled ? !!metricsLoadingProp : internalLoading;

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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700"
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
      <MetricsToolbar metrics={metrics} loading={loading} />
    </div>
  );
}

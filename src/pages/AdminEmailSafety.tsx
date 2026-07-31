import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

type SafetyDashboard = {
  ground_zero_at?: string;
  pauses?: {
    global?: boolean;
    hot_sheet?: boolean;
    communications?: boolean;
    transactional?: boolean;
    system?: boolean;
  };
  change?: {
    changed_by?: string | null;
    changed_at?: string | null;
    change_reason?: string | null;
  };
  queued_by_stream?: Record<string, number>;
  processing?: number;
  quarantined?: number;
  sends_last_5_minutes?: number;
  sends_today?: number;
  unique_recipients_today?: number;
  highest_per_recipient_today?: number;
  largest_source_event_fanout?: number;
  frequency_suppressions_today?: number;
  unknown_or_retired_template_attempts?: number;
  last_provider_call_at?: string | null;
  last_automatic_shutdown?: {
    reason?: string | null;
    at?: string | null;
    source_event_id?: string | null;
  };
  restart_sequence?: string[];
  automatic_reopen?: boolean;
};

function PauseBadge({ paused, label }: { paused?: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge variant={paused ? "destructive" : "secondary"}>
        {paused ? "PAUSED" : "open"}
      </Badge>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value ?? "—"}</div>
    </div>
  );
}

export default function AdminEmailSafety() {
  const [data, setData] = useState<SafetyDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: rpcData, error: rpcError } = await supabase.rpc("email_safety_dashboard");
      if (!active) return;
      if (rpcError) {
        setError(rpcError.message);
        setData(null);
      } else {
        setData((rpcData ?? null) as SafetyDashboard | null);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const queued = data?.queued_by_stream ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Safety"
        subtitle="Read-only Ground Zero controls. Automatic reopen is disabled."
      />

      <p className="text-sm text-muted-foreground">
        Related:{" "}
        <Link className="underline" to="/admin/email-analytics">
          Email Analytics
        </Link>
        . Restart sequence requires separate manual approvals (internal canary → transactional → Hot
        Sheet → Communications).
      </p>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            Failed to load safety dashboard: {error}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pause states</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <PauseBadge paused={data?.pauses?.global} label="Global" />
              <PauseBadge paused={data?.pauses?.hot_sheet} label="Hot Sheet" />
              <PauseBadge paused={data?.pauses?.communications} label="Communications" />
              <PauseBadge paused={data?.pauses?.transactional} label="Transactional" />
              <PauseBadge paused={data?.pauses?.system} label="System" />
              <div className="pt-3 text-sm text-muted-foreground">
                Ground Zero: {data?.ground_zero_at ?? "—"}
              </div>
              <div className="text-sm text-muted-foreground">
                Last change: {data?.change?.change_reason ?? "—"} (
                {data?.change?.changed_at ?? "—"})
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Queue health</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Stat label="Processing" value={data?.processing ?? 0} />
              <Stat label="Quarantined" value={data?.quarantined ?? 0} />
              <Stat label="Queued hot_sheet" value={queued.hot_sheet ?? 0} />
              <Stat label="Queued communications" value={queued.communications ?? 0} />
              <Stat label="Queued transactional" value={queued.transactional ?? 0} />
              <Stat label="Queued system" value={queued.system ?? 0} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery today</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Stat label="Sends (5 min)" value={data?.sends_last_5_minutes ?? 0} />
              <Stat label="Sends today" value={data?.sends_today ?? 0} />
              <Stat label="Unique recipients" value={data?.unique_recipients_today ?? 0} />
              <Stat
                label="Highest per recipient"
                value={data?.highest_per_recipient_today ?? 0}
              />
              <Stat
                label="Largest source fan-out"
                value={data?.largest_source_event_fanout ?? 0}
              />
              <Stat
                label="Frequency suppressions"
                value={data?.frequency_suppressions_today ?? 0}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Emergency signals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                Unknown/retired template attempts:{" "}
                <strong>{data?.unknown_or_retired_template_attempts ?? 0}</strong>
              </div>
              <div>Last provider call: {data?.last_provider_call_at ?? "—"}</div>
              <div>
                Last automatic shutdown:{" "}
                {data?.last_automatic_shutdown?.reason ?? "none"}
                {data?.last_automatic_shutdown?.at
                  ? ` @ ${data.last_automatic_shutdown.at}`
                  : ""}
              </div>
              <div>
                Affected source event:{" "}
                {data?.last_automatic_shutdown?.source_event_id ?? "—"}
              </div>
              <div>
                Automatic reopen:{" "}
                <Badge variant="secondary">
                  {data?.automatic_reopen ? "enabled" : "disabled"}
                </Badge>
              </div>
              <div>
                Restart sequence: {(data?.restart_sequence ?? []).join(" → ") || "—"}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

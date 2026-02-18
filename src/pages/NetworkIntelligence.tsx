import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  TrendingUp,
  RefreshCcw,
  DollarSign,
  MapPin,
  Users,
  Clock,
  ArrowRight,
  Flame,
  AlertCircle,
  BarChart3,
  Send,
} from "lucide-react";
import { useNetworkIntelligence } from "@/hooks/useNetworkIntelligence";
import { useAgentPresence } from "@/hooks/useAgentPresence";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ModuleSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-0.5 rounded-xl px-4 py-3 ${
        accent
          ? "bg-primary/10 border border-primary/20"
          : "bg-muted/60 border border-border"
      }`}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span
        className={`text-2xl font-bold tabular-nums ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ─── Bar row for demand ───────────────────────────────────────────────────────

function DemandBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-sm">
        <span className="text-foreground font-medium truncate pr-2">{label}</span>
        <span className="text-muted-foreground tabular-nums shrink-0">{count}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Hot Sheet row ────────────────────────────────────────────────────────────

function HotSheetRow({
  item,
  onResend,
}: {
  item: {
    id: string;
    name: string;
    matchCount: number;
    pendingInviteCount: number;
    pendingTokenIds: string[];
    pendingInvitedEmails: string[];
    lastActivity: string | null;
  };
  onResend: (tokenId: string, email: string, hotSheetId: string, hotSheetName: string) => void;
}) {
  const navigate = useNavigate();
  const hasPending = item.pendingInviteCount > 0;
  const hasMatches = item.matchCount > 0;

  const lastActivityLabel = item.lastActivity
    ? formatDistanceToNow(new Date(item.lastActivity), { addSuffix: true })
    : null;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      {/* Indicator dot */}
      <div className="mt-1 shrink-0">
        {hasPending ? (
          <span className="block h-2.5 w-2.5 rounded-full bg-amber-400" />
        ) : hasMatches ? (
          <span className="block h-2.5 w-2.5 rounded-full bg-primary" />
        ) : (
          <span className="block h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-foreground truncate">
            {item.name}
          </span>
          {hasMatches && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {item.matchCount} match{item.matchCount !== 1 ? "es" : ""}
            </Badge>
          )}
          {hasPending && (
            <Badge
              variant="outline"
              className="text-xs px-1.5 py-0 border-amber-400 text-amber-600"
            >
              {item.pendingInviteCount} pending
            </Badge>
          )}
        </div>

        {lastActivityLabel && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Last activity {lastActivityLabel}
          </p>
        )}

        {hasPending && item.pendingTokenIds[0] && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Waiting: {item.pendingInvitedEmails.slice(0, 2).join(", ")}
            {item.pendingInvitedEmails.length > 2
              ? ` +${item.pendingInvitedEmails.length - 2} more`
              : ""}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {hasPending && item.pendingTokenIds[0] && item.pendingInvitedEmails[0] && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() =>
              onResend(
                item.pendingTokenIds[0],
                item.pendingInvitedEmails[0],
                item.id,
                item.name
              )
            }
          >
            <Send className="h-3 w-3 mr-1" />
            Resend
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => navigate(`/hot-sheets/${item.id}/review`)}
        >
          Open
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NetworkIntelligence() {
  useAgentPresence();
  const navigate = useNavigate();
  const { summary, loading, error, refetch } = useNetworkIntelligence();
  const [resendingTokenId, setResendingTokenId] = useState<string | null>(null);

  const handleResend = async (
    tokenId: string,
    email: string,
    hotSheetId: string,
    hotSheetName: string
  ) => {
    if (resendingTokenId === tokenId) return;
    setResendingTokenId(tokenId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Fetch agent name
      const { data: profile } = await supabase
        .from("agent_profiles")
        .select("first_name, last_name")
        .eq("id", session.user.id)
        .maybeSingle();

      const agentName = profile
        ? `${profile.first_name} ${profile.last_name}`.trim()
        : "Your agent";

      const hotSheetLink = `${window.location.origin}/client/hotsheet/`;

      const { error: fnErr } = await supabase.functions.invoke("send-hot-sheet-invite", {
        body: {
          invitedEmail: email,
          inviterName: agentName,
          hotSheetName,
          hotSheetLink,
          hotSheetId,
          tokenId,
          mode: "resend",
        },
      });

      if (fnErr) throw fnErr;
      toast.success(`Invite resent to ${email}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to resend invite");
    } finally {
      // Keep button disabled for 2 min cooldown feedback
      setTimeout(() => setResendingTokenId(null), 120_000);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Network</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              What's moving inside the network right now
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 mb-6 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Module 1: Market Signals ───────────────────────────────────────── */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Market Signals
            </h2>
            <span className="text-xs text-muted-foreground">· Last 7 days · Network-wide</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatChip
                icon={RefreshCcw}
                label="Relisted"
                value={summary?.marketSignals.relistCount7d ?? 0}
                sub="new cycles started"
                accent={!!summary?.marketSignals.relistCount7d}
              />
              <StatChip
                icon={TrendingUp}
                label="Back on Market"
                value={summary?.marketSignals.backOnMarketCount7d ?? 0}
                sub="reactivated listings"
              />
              <StatChip
                icon={DollarSign}
                label="Price Changes"
                value={summary?.marketSignals.priceChangeCount7d ?? 0}
                sub="recorded reductions"
              />
              <StatChip
                icon={Clock}
                label="Avg Relist Gap"
                value={
                  summary?.marketSignals.avgDaysBetweenRelists != null
                    ? `${summary.marketSignals.avgDaysBetweenRelists}d`
                    : "—"
                }
                sub="days between cycles"
              />
            </div>
          )}
        </section>

        {/* ── Modules 2 + 3: two columns ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Module 2: Buyer Demand */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Buyer Demand
              </h2>
            </div>

            {loading ? (
              <ModuleSkeleton />
            ) : (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
                {/* New needs pill */}
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-foreground">
                    <span className="font-bold text-foreground tabular-nums">
                      {summary?.buyerDemand.newNeedsCount7d ?? 0}
                    </span>{" "}
                    new buyer needs in the last 7 days
                  </span>
                </div>

                {/* Top towns */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Where buyers are searching
                  </p>
                  {(summary?.buyerDemand.topTowns ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      No town data yet — buyers may not have set location criteria.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {summary!.buyerDemand.topTowns.map((t) => (
                        <div key={`${t.town}|${t.state}`} className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                          <DemandBar
                            label={`${t.town}${t.state ? `, ${t.state}` : ""}`}
                            count={t.count}
                            max={summary!.buyerDemand.topTowns[0].count}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Price bands */}
                {(summary?.buyerDemand.topPriceBands ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Price band concentration
                    </p>
                    <div className="space-y-2">
                      {summary!.buyerDemand.topPriceBands.map((b) => (
                        <DemandBar
                          key={b.label}
                          label={b.label}
                          count={b.count}
                          max={summary!.buyerDemand.topPriceBands[0].count}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Module 3: Your Active Hot Sheets */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Your Hot Sheets
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => navigate("/hot-sheets")}
              >
                View all
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>

            {loading ? (
              <ModuleSkeleton />
            ) : (
              <div className="rounded-2xl border border-border bg-card px-5 py-2">
                {(summary?.activeHotSheets ?? []).length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No active hot sheets yet.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => navigate("/hot-sheets")}
                    >
                      Create a Hot Sheet
                    </Button>
                  </div>
                ) : (
                  <div>
                    {summary!.activeHotSheets.map((item) => (
                      <HotSheetRow
                        key={item.id}
                        item={item}
                        onResend={(tokenId, email, hsId, hsName) => {
                          handleResend(tokenId, email, hsId, hsName);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Aggregates only · No agent or client attribution · Updated on page load
        </p>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { AgentPageHeader } from "@/components/layout/AgentPageHeader";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight, Clock, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentBuyerActivityHeaderCard } from "@/components/agent/AgentBuyerActivityHeaderCard";
import { supabase } from "@/integrations/supabase/client";
import { CreateBuyerDialog } from "@/components/CreateBuyerDialog";
import { BuyerCreatedNextStepDialog, type CreatedBuyer } from "@/components/success-hub/BuyerCreatedNextStepDialog";
import { Seo } from "@/components/Seo";
import { cn } from "@/lib/utils";
import {
  fetchBuyerActivityMetrics,
  type BuyerActivityMetrics,
} from "@/lib/fetchBuyerActivityMetrics";

interface BuyerRow {
  clientId: string;
  name: string;
  email: string;
  phone?: string | null;
  status: string;
  /** AAC buyer account linked (shared workspace / “in search”). */
  buyerWorkspaceLinked: boolean;
}

type FilterKey = "all" | "active" | "pending";

function BuyersRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[84px] w-full rounded-2xl bg-zinc-100/90" />
      ))}
    </div>
  );
}

export default function BuyersList() {
  const navigate = useNavigate();
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createdBuyer, setCreatedBuyer] = useState<CreatedBuyer | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  const loadBuyers = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: relationships, error: relErr } = await supabase
        .from("client_agent_relationships")
        .select("client_id,crm_client_id,status,created_at")
        .eq("agent_id", user.id)
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: false });

      if (relErr) {
        console.error("Error loading buyer relationships:", relErr);
        return;
      }

      if (!relationships || relationships.length === 0) {
        setBuyers([]);
        return;
      }

      const authClientIds = relationships.map((r) => r.client_id).filter(Boolean);
      const crmClientIds = (relationships as any[])
        .map((r) => r.crm_client_id)
        .filter(Boolean) as string[];
      const allCrmIds = [...new Set([...authClientIds, ...crmClientIds])];

      const { data: clientsData, error: clientsErr } = await supabase
        .from("clients")
        .select("id,first_name,last_name,email,phone")
        .in("id", allCrmIds);

      if (clientsErr) {
        console.error("Error loading clients for buyers:", clientsErr);
        setBuyers([]);
        return;
      }

      const clientMap = new Map<string, any>();
      for (const c of (clientsData ?? [])) {
        clientMap.set(c.id, c);
      }

      const rows: BuyerRow[] = relationships.map((r: any) => {
        const crmId = r.crm_client_id || r.client_id;
        const c = clientMap.get(crmId) || clientMap.get(r.client_id);
        if (!c) return null;
        const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.email;
        const buyerWorkspaceLinked =
          String(r.status) === "active" && r.client_id != null && String(r.client_id).trim() !== "";
        return {
          clientId: c.id,
          name,
          email: c?.email ?? "",
          phone: c?.phone ?? null,
          status: r.status,
          buyerWorkspaceLinked,
        };
      }).filter(Boolean) as BuyerRow[];

      setBuyers(rows);
    } catch (err) {
      console.error("Error loading buyers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuyers();
  }, []);

  const counts = useMemo(() => ({
    all: buyers.length,
    active: buyers.filter((b) => b.status === "active").length,
    pending: buyers.filter((b) => b.status === "pending").length,
  }), [buyers]);

  const filtered = useMemo(() => {
    if (filter === "all") return buyers;
    return buyers.filter((b) => b.status === filter);
  }, [buyers, filter]);

  /** Per-CRM aggregates — keyed only by buyer `clients.id`; one map entry per buyer, never shared. */
  const buyerMetricFingerprint = useMemo(() => {
    const ids = [...new Set(buyers.map((b) => b.clientId))];
    ids.sort();
    return ids.join("|");
  }, [buyers]);

  const [metricsByClientId, setMetricsByClientId] = useState<Record<string, BuyerActivityMetrics>>({});

  useEffect(() => {
    if (loading) {
      setMetricsByClientId({});
      return;
    }
    if (buyers.length === 0 || buyerMetricFingerprint === "") {
      setMetricsByClientId({});
      return;
    }

    let cancelled = false;
    const ids = buyerMetricFingerprint.split("|").filter(Boolean);

    void (async () => {
      const pairs = await Promise.all(
        ids.map(async (id) => {
          const m = await fetchBuyerActivityMetrics(supabase, id);
          return [id, m] as const;
        }),
      );
      if (cancelled) return;
      const next: Record<string, BuyerActivityMetrics> = {};
      for (const [id, m] of pairs) next[id] = m;
      setMetricsByClientId(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [buyerMetricFingerprint, buyers.length, loading]);

  const filterPills: { key: FilterKey; label: string }[] = [
    { key: "all", label: `All${counts.all ? ` · ${counts.all}` : ""}` },
    { key: "active", label: `Active${counts.active ? ` · ${counts.active}` : ""}` },
    { key: "pending", label: `Pending Invite${counts.pending ? ` · ${counts.pending}` : ""}` },
  ];

  return (
    <>
      <Seo
        title="Buyers | All Agent Connect"
        description="View and manage buyer accounts, activity, and connected workflows inside All Agent Connect."
        canonical="https://allagentconnect.com/success-hub/buyers"
        noindex
      />

      <AgentAacPage className="pb-12">
        <AgentPageHeader
          title="My Buyers"
          subtitle="Manage buyer hot sheets, favorites, invites, and activity."
          className="mb-6"
        />

        <div className="mb-4 flex items-center">
          <Button
            type="button"
            onClick={() => setShowCreate(true)}
            className="h-8 shrink-0 rounded-md border border-zinc-200/90 bg-white px-3 text-sm font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            New Buyer
          </Button>
        </div>

        <AgentSectionCard className="p-6">
          {/* Filter pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            {filterPills.map((pill) => {
              const active = filter === pill.key;
              return (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setFilter(pill.key)}
                  className={cn(
                    "h-8 px-3.5 rounded-full text-sm font-medium transition-colors",
                    active
                      ? "bg-zinc-900 text-white"
                      : "border border-zinc-100 bg-white text-zinc-700 hover:border-zinc-200"
                  )}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* List — section skeleton (no extra full-route monogram after auth) */}
          {loading ? (
            <div className="relative py-4" role="status" aria-live="polite" aria-busy="true">
              <span className="sr-only">Loading buyers…</span>
              <BuyersRowsSkeleton />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              hasAny={buyers.length > 0}
              filter={filter}
              onCreate={() => setShowCreate(true)}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((b) => {
                const metricsForBuyer = metricsByClientId[b.clientId];
                const buyerMetricsStillLoading =
                  buyerMetricFingerprint !== "" && !(b.clientId in metricsByClientId);
                return (
                  <BuyerCard
                    key={b.clientId}
                    buyer={b}
                    buyerMetricsLoading={buyerMetricsStillLoading}
                    metrics={metricsForBuyer ?? null}
                    onOpen={() => navigate(`/success-hub/buyers/${b.clientId}`)}
                  />
                );
              })}
            </div>
          )}
        </AgentSectionCard>
      </AgentAacPage>

      <CreateBuyerDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={(created) => {
          void loadBuyers({ silent: true });
          if (created) setCreatedBuyer(created);
        }}
      />

      <BuyerCreatedNextStepDialog
        buyer={createdBuyer}
        onClose={() => setCreatedBuyer(null)}
        onCreateHotSheet={(b) =>
          navigate(`/success-hub/buyers/${b.id}?createHotSheet=1`)
        }
      />
    </>
  );
}

function BuyerCard({
  buyer,
  metrics,
  buyerMetricsLoading,
  onOpen,
}: {
  buyer: BuyerRow;
  metrics: BuyerActivityMetrics | null;
  buyerMetricsLoading: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group flex cursor-pointer items-stretch gap-3 rounded-2xl border border-zinc-200/90 bg-white p-4 pl-5",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[box-shadow,border-color,transform] duration-150",
        "hover:-translate-y-px hover:border-zinc-300/90 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]",
      )}
      aria-label={`Open buyer ${buyer.name}`}
    >
      <div className="min-w-0 flex-1">
        <AgentBuyerActivityHeaderCard
          key={buyer.clientId}
          displayName={buyer.name}
          email={buyer.email}
          phone={buyer.phone ?? null}
          crmClientId={buyer.clientId}
          metrics={metrics}
          metricsLoading={buyerMetricsLoading}
          metricsToolbarTintIcons
          className="rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
          trailing={<BuyerRowStatusPill buyer={buyer} />}
        />
      </div>
      <div className="flex shrink-0 items-center justify-center self-center">
        <ChevronRight
          className="h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </div>
  );
}

function BuyerRowStatusPill({ buyer }: { buyer: BuyerRow }) {
  if (buyer.status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200/90 bg-sky-50 px-2.5 py-0.5 text-[11px] font-medium text-sky-900">
        <Clock className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
        Pending Invite
      </span>
    );
  }
  if (buyer.buyerWorkspaceLinked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
        <CheckCircle2 className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
        Searching
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
      <CheckCircle2 className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
      Invite Accepted
    </span>
  );
}

function EmptyState({
  hasAny,
  filter,
  onCreate,
}: {
  hasAny: boolean;
  filter: FilterKey;
  onCreate: () => void;
}) {
  if (hasAny) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-100 bg-white px-5 py-8 text-center">
        <p className="text-sm font-semibold text-zinc-900">
          No buyers in this view
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Try a different filter to see {filter === "active" ? "pending" : "active"} buyers.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-zinc-100 bg-white px-5 py-8 text-center">
      <h2 className="text-sm font-semibold text-zinc-900">No buyers yet</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Create your first buyer to start building hot sheets and tracking activity.
      </p>
      <Button onClick={onCreate} className="mt-5 h-9 rounded-full px-4">
        <UserPlus className="h-4 w-4 mr-2" />
        New Buyer
      </Button>
    </div>
  );
}

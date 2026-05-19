import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { AgentPageHeader } from "@/components/layout/AgentPageHeader";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";
import { Button } from "@/components/ui/button";
import { ChevronRight, UserPlus } from "lucide-react";
import { AacBackLink } from "@/components/layout/AacBackLink";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentBuyerActivityHeaderCard } from "@/components/agent/AgentBuyerActivityHeaderCard";
import { BuyerRowStatusPill } from "@/components/agent/BuyerRowStatusPill";
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

/** Title-case each stored name part so "brody" + "tuite" and single-field "brody tuite" both become "Brody Tuite". */
function titleCaseToken(term: string): string {
  const t = term.trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Canonical agent buyer workspace URL — always CRM `clients.id` (matches `BuyerAccount` + `useBuyerWorkspaceMirror`). */
function agentBuyerAccountPath(crmClientId: string): string {
  const id = String(crmClientId ?? "").trim();
  if (!id) return "/agent/buyers";
  return `/agent/buyers/${id}`;
}

function formatBuyerListName(c: { first_name?: string | null; last_name?: string | null; email?: string | null }): string {
  const rawFn = typeof c.first_name === "string" ? c.first_name.trim() : "";
  const rawLn = typeof c.last_name === "string" ? c.last_name.trim() : "";
  const fnParts = rawFn.split(/\s+/).filter(Boolean).map(titleCaseToken);
  const lnParts = rawLn.split(/\s+/).filter(Boolean).map(titleCaseToken);
  const fromFields = [...fnParts, ...lnParts].filter(Boolean).join(" ");
  if (fromFields) return fromFields;
  const em = typeof c.email === "string" ? c.email.trim() : "";
  return em;
}

function BuyersRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[84px] w-full rounded-xl border border-neutral-100 bg-neutral-100" />
      ))}
    </div>
  );
}

export default function BuyersList() {
  const navigate = useNavigate();
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [loading, setLoading] = useState(true);
  /** Last fetch failed with no buyer rows to show (avoid empty-state masking errors). */
  const [loadError, setLoadError] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createdBuyer, setCreatedBuyer] = useState<CreatedBuyer | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  const loadBuyers = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      setLoadError(false);
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
        setLoadError(true);
        return;
      }

      const relRows = (relationships ?? []) as any[];

      // Also include any buyer who is a member of one of this agent's hot sheets
      // (parity with Success Hub which unions relationships ∪ hot_sheet_clients).
      const { data: agentSheets, error: sheetsErr } = await (supabase as any)
        .from("hot_sheets")
        .select("id")
        .eq("user_id", user.id);
      if (sheetsErr) {
        console.error("Error loading agent hot sheets for buyer union:", sheetsErr);
      }
      const sheetIds = (agentSheets ?? []).map((s: any) => String(s.id));
      let hscClientIds: string[] = [];
      if (sheetIds.length > 0) {
        const { data: hscRows, error: hscErr } = await supabase
          .from("hot_sheet_clients")
          .select("client_id")
          .in("hot_sheet_id", sheetIds);
        if (hscErr) {
          console.error("Error loading hot_sheet_clients for buyer union:", hscErr);
        }
        hscClientIds = [
          ...new Set(
            (hscRows ?? [])
              .map((r: any) => (r?.client_id != null ? String(r.client_id).trim() : ""))
              .filter(Boolean),
          ),
        ];
      }

      // Pending invite tokens for this agent — surface buyers who only have an
      // outstanding `client_hotsheet_invite` token (no relationship, no membership yet).
      const { data: tokenRows, error: tokenErr } = await supabase
        .from("share_tokens")
        .select("payload, accepted_at")
        .eq("agent_id", user.id);
      if (tokenErr) {
        console.error("Error loading invite tokens for buyer union:", tokenErr);
      }
      const pendingInviteClientIds = new Set<string>();
      for (const t of tokenRows ?? []) {
        const p = (t as any).payload as Record<string, unknown> | null;
        if (!p || String(p.type ?? "") !== "client_hotsheet_invite") continue;
        if ((t as any).accepted_at) continue;
        const cid = p.client_id != null ? String(p.client_id).trim() : "";
        if (cid) pendingInviteClientIds.add(cid);
      }

      if (relRows.length === 0 && hscClientIds.length === 0 && pendingInviteClientIds.size === 0) {
        setBuyers([]);
        return;
      }

      const authClientIds = relRows.map((r) => r.client_id).filter(Boolean) as string[];
      const crmClientIds = relRows.map((r) => r.crm_client_id).filter(Boolean) as string[];
      const allCrmIds = [
        ...new Set([
          ...authClientIds,
          ...crmClientIds,
          ...hscClientIds,
          ...pendingInviteClientIds,
        ]),
      ];

      const { data: clientsData, error: clientsErr } = await supabase
        .from("clients")
        .select("id,first_name,last_name,email,phone")
        .in("id", allCrmIds);

      if (clientsErr) {
        console.error("Error loading clients for buyers:", clientsErr);
        setBuyers([]);
        setLoadError(true);
        return;
      }

      const clientMap = new Map<string, any>();
      for (const c of (clientsData ?? [])) {
        clientMap.set(c.id, c);
      }

      const rows: BuyerRow[] = [];
      const seenClientIds = new Set<string>();

      for (const r of relRows) {
        const crmId = r.crm_client_id || r.client_id;
        const c = clientMap.get(crmId) || clientMap.get(r.client_id);
        if (!c) continue;
        if (seenClientIds.has(c.id)) continue;
        seenClientIds.add(c.id);
        const name = formatBuyerListName(c);
        const buyerWorkspaceLinked =
          String(r.status) === "active" && r.client_id != null && String(r.client_id).trim() !== "";
        rows.push({
          clientId: c.id,
          name,
          email: c?.email ?? "",
          phone: c?.phone ?? null,
          status: r.status,
          buyerWorkspaceLinked,
        });
      }

      // Union: buyers on agent's hot sheets without an explicit relationship row.
      for (const cid of hscClientIds) {
        if (seenClientIds.has(cid)) continue;
        const c = clientMap.get(cid);
        if (!c) continue;
        seenClientIds.add(cid);
        const name = formatBuyerListName(c);
        const pending = pendingInviteClientIds.has(cid);
        rows.push({
          clientId: c.id,
          name,
          email: c?.email ?? "",
          phone: c?.phone ?? null,
          status: pending ? "pending" : "active",
          buyerWorkspaceLinked: false,
        });
      }

      // Union: buyers with only an outstanding invite token (not yet on a sheet).
      for (const cid of pendingInviteClientIds) {
        if (seenClientIds.has(cid)) continue;
        const c = clientMap.get(cid);
        if (!c) continue;
        seenClientIds.add(cid);
        const name = formatBuyerListName(c);
        rows.push({
          clientId: c.id,
          name,
          email: c?.email ?? "",
          phone: c?.phone ?? null,
          status: "pending",
          buyerWorkspaceLinked: false,
        });
      }

      setBuyers(rows);
    } catch (err) {
      console.error("Error loading buyers:", err);
      setLoadError(true);
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
        canonical="https://allagentconnect.com/agent/buyers"
        noindex
      />

      <AgentAacPage className="pb-12">
        <div className="mb-4">
          <AacBackLink to="/agent-dashboard" title="Return to Success Hub dashboard">
            Back
          </AacBackLink>
        </div>
        <AgentPageHeader
          title="My Buyers"
          subtitle="Manage buyer hot sheets, favorites, invites, and activity."
          className="mb-5"
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => setShowCreate(true)}
            className="bg-[#0E56F5] text-white shadow-sm hover:bg-[#0B46CC] focus-visible:ring-2 focus-visible:ring-[#0E56F5]/35 focus-visible:ring-offset-2"
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            New Buyer
          </Button>
        </div>

        {loadError && !loading && buyers.length === 0 ? (
          <AgentSectionCard className="border-0 p-6 shadow-none hover:border-0 hover:shadow-none">
            <p className="text-sm font-medium text-neutral-900">Couldn&apos;t load buyers</p>
            <p className="mt-2 text-sm text-neutral-600">
              Check your connection and try again.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-4 bg-[#0E56F5] text-white shadow-sm hover:bg-[#0B46CC] focus-visible:ring-2 focus-visible:ring-[#0E56F5]/35 focus-visible:ring-offset-2"
              onClick={() => void loadBuyers()}
            >
              Try again
            </Button>
          </AgentSectionCard>
        ) : (
        <AgentSectionCard className="border-0 p-5 shadow-none sm:p-6 hover:border-0 hover:shadow-none">
          {/* Filter pills */}
          <div className="mb-5 flex flex-wrap gap-2">
            {filterPills.map((pill) => {
              const active = filter === pill.key;
              return (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setFilter(pill.key)}
                  className={cn(
                    "h-8 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2",
                    active
                      ? "bg-[#0E56F5] text-white"
                      : "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50/80"
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
                    to={agentBuyerAccountPath(b.clientId)}
                  />
                );
              })}
            </div>
          )}
        </AgentSectionCard>
        )}
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
          navigate(`${agentBuyerAccountPath(b.id)}?createHotSheet=1`)
        }
      />
    </>
  );
}

function BuyerCard({
  buyer,
  metrics,
  buyerMetricsLoading,
  to,
}: {
  buyer: BuyerRow;
  metrics: BuyerActivityMetrics | null;
  buyerMetricsLoading: boolean;
  /** Absolute path to buyer workspace (`/agent/buyers/:crmClientId`). */
  to: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex cursor-pointer items-stretch gap-3 rounded-xl border border-neutral-200 bg-white p-4 pl-5",
        "shadow-sm transition-[box-shadow,border-color,background-color] duration-150",
        "hover:border-neutral-300 hover:bg-neutral-50/80 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2",
        "no-underline text-inherit",
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
          hotSheetMetricUseFlame
          hideMetricsToolbarTopRule={true}
          metricsToolbarNewMatchesSparklePlus={true}
          avatarClassName="bg-neutral-200 text-neutral-800"
          className="rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
          trailing={<BuyerRowStatusPill buyer={buyer} />}
        />
      </div>
      <div className="flex shrink-0 items-center justify-center self-center">
        <ChevronRight
          className="h-4 w-4 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-600"
          aria-hidden
        />
      </div>
    </Link>
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
      <div className="rounded-xl border border-dashed border-neutral-200 bg-white px-5 py-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-neutral-900">
          No buyers in this view
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          Try a different filter to see {filter === "active" ? "pending" : "active"} buyers.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-neutral-200 bg-white px-5 py-10 text-center shadow-sm">
      <h2 className="text-sm font-semibold text-neutral-900">No buyers yet</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Create your first buyer to start building hot sheets and tracking activity.
      </p>
      <Button
        type="button"
        size="sm"
        onClick={onCreate}
        className="mt-5 bg-[#0E56F5] text-white shadow-sm hover:bg-[#0B46CC] focus-visible:ring-2 focus-visible:ring-[#0E56F5]/35 focus-visible:ring-offset-2"
      >
        <UserPlus className="mr-2 h-4 w-4" />
        New Buyer
      </Button>
    </div>
  );
}

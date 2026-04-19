import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { ChevronRight, UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CreateBuyerDialog } from "@/components/CreateBuyerDialog";
import { BuyerCreatedNextStepDialog, type CreatedBuyer } from "@/components/success-hub/BuyerCreatedNextStepDialog";
import { Seo } from "@/components/Seo";
import { cn } from "@/lib/utils";

interface BuyerRow {
  clientId: string;
  name: string;
  email: string;
  phone?: string | null;
  status: string;
  hotSheetCount: number;
}

type FilterKey = "all" | "active" | "pending";

export default function BuyersList() {
  const navigate = useNavigate();
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createdBuyer, setCreatedBuyer] = useState<CreatedBuyer | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  const loadBuyers = async () => {
    setLoading(true);
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

      const [clientsRes, hscRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id,first_name,last_name,email,phone")
          .in("id", allCrmIds),
        supabase
          .from("hot_sheet_clients")
          .select("client_id,hot_sheet_id")
          .in("client_id", allCrmIds),
      ]);

      const clientMap = new Map<string, any>();
      for (const c of (clientsRes.data ?? [])) {
        clientMap.set(c.id, c);
      }

      const hsCountMap = new Map<string, number>();
      for (const row of (hscRes.data ?? []) as any[]) {
        const cid = String(row.client_id);
        hsCountMap.set(cid, (hsCountMap.get(cid) ?? 0) + 1);
      }

      const rows: BuyerRow[] = relationships.map((r: any) => {
        const crmId = r.crm_client_id || r.client_id;
        const c = clientMap.get(crmId) || clientMap.get(r.client_id);
        if (!c) return null;
        const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.email;
        return {
          clientId: c.id,
          name,
          email: c?.email ?? "",
          phone: c?.phone ?? null,
          status: r.status,
          hotSheetCount: hsCountMap.get(c.id) ?? 0,
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

  const filterPills: { key: FilterKey; label: string }[] = [
    { key: "all", label: `All${counts.all ? ` · ${counts.all}` : ""}` },
    { key: "active", label: `Active${counts.active ? ` · ${counts.active}` : ""}` },
    { key: "pending", label: `Pending Invite${counts.pending ? ` · ${counts.pending}` : ""}` },
  ];

  return (
    <PageShell className="bg-white">
      <Seo
        title="Buyers | All Agent Connect"
        description="View and manage buyer accounts, activity, and connected workflows inside All Agent Connect."
        canonical="https://allagentconnect.com/success-hub/buyers"
        noindex
      />

      <div className="max-w-5xl mx-auto pt-2 pb-10">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
              My Buyers
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Manage buyer hot sheets, favorites, invites, and activity.
            </p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="h-9 rounded-full px-4 shrink-0"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            New Buyer
          </Button>
        </div>

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
                    : "bg-white border border-zinc-300 text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
                )}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            hasAny={buyers.length > 0}
            filter={filter}
            onCreate={() => setShowCreate(true)}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((b) => (
              <BuyerCard
                key={b.clientId}
                buyer={b}
                onOpen={() => navigate(`/success-hub/buyers/${b.clientId}`)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateBuyerDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={loadBuyers}
      />
    </PageShell>
  );
}

function BuyerCard({ buyer, onOpen }: { buyer: BuyerRow; onOpen: () => void }) {
  const isPending = buyer.status === "pending";
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
        "group cursor-pointer rounded-2xl border border-zinc-200 bg-white",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-zinc-300",
        "transition-all duration-150",
        "px-5 py-4 flex items-center justify-between gap-4"
      )}
    >
      <div className="min-w-0">
        <p className="text-base font-semibold text-zinc-900 truncate">{buyer.name}</p>
        <p className="text-sm text-zinc-500 mt-0.5 truncate">{buyer.email}</p>
        {buyer.phone && (
          <p className="text-xs text-zinc-400 truncate">{buyer.phone}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span
          className={cn(
            "inline-flex items-center h-6 px-2 rounded-full text-xs font-medium",
            isPending
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          )}
        >
          {isPending ? "Pending Invite" : "Active"}
        </span>
        <span className="hidden sm:inline text-xs text-zinc-500 whitespace-nowrap">
          {buyer.hotSheetCount} hot sheet{buyer.hotSheetCount !== 1 ? "s" : ""}
        </span>
        <ChevronRight className="h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
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
      <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-8 text-center">
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
    <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-8 text-center">
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

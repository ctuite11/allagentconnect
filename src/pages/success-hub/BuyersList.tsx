import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, UserPlus, Loader2, Pencil, MoreHorizontal, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CreateBuyerDialog } from "@/components/CreateBuyerDialog";
import { EditBuyerDialog } from "@/components/success-hub/EditBuyerDialog";
import { RemoveBuyerClientDialog } from "@/components/success-hub/RemoveBuyerClientAction";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BuyerStatusBadge,
  getBuyerStatus,
  BUYER_STATUS_ORDER,
  BUYER_STATUS_CONFIG,
  type BuyerStatus,
} from "@/lib/buyerStatus";
import { cn } from "@/lib/utils";

interface BuyerRow {
  clientId: string;
  name: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  agentId: string;
  agentUserId: string | null;
  notes: string | null;
  status: BuyerStatus;
  hotSheetCount: number;
  createdAt: string;
  updatedAt: string;
}

type FilterKey = "all" | BuyerStatus;

/** Relationship statuses considered "still a buyer client" for My Buyers. */
const ACTIVE_REL_STATUSES = new Set(["active", "invited", "pending"]);

export default function BuyersList() {
  const navigate = useNavigate();
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [editBuyer, setEditBuyer] = useState<BuyerRow | null>(null);
  const [removeBuyer, setRemoveBuyer] = useState<BuyerRow | null>(null);

  const loadBuyers = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: relationships, error: relErr } = await supabase
        .from("client_agent_relationships")
        .select("client_id,crm_client_id,status,created_at,ended_at")
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false });

      if (relErr) {
        console.error("Error loading buyer relationships:", relErr);
        return;
      }

      // Only relationships that are still active count as buyer clients.
      // Excludes: ended, archived, closed, inactive (legacy values).
      const liveRelationships = (relationships ?? []).filter((r: any) =>
        ACTIVE_REL_STATUSES.has((r.status ?? "").toLowerCase()) && !r.ended_at,
      );

      if (liveRelationships.length === 0) {
        setBuyers([]);
        return;
      }

      const authClientIds = liveRelationships.map((r: any) => r.client_id).filter(Boolean);
      const crmClientIds = liveRelationships
        .map((r: any) => r.crm_client_id)
        .filter(Boolean) as string[];
      const allCrmIds = [...new Set([...authClientIds, ...crmClientIds])];

      const [clientsRes, hscRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id,first_name,last_name,email,phone,notes,agent_id,agent_user_id,updated_at")
          .in("id", allCrmIds),
        supabase
          .from("hot_sheet_clients")
          .select("client_id,hot_sheet_id")
          .in("client_id", allCrmIds),
      ]);

      const clientMap = new Map<string, any>();
      for (const c of (clientsRes.data ?? [])) clientMap.set(c.id, c);

      const hsCountMap = new Map<string, number>();
      for (const row of (hscRes.data ?? []) as any[]) {
        const cid = String(row.client_id);
        hsCountMap.set(cid, (hsCountMap.get(cid) ?? 0) + 1);
      }

      const rows: BuyerRow[] = liveRelationships.map((r: any) => {
        const crmId = r.crm_client_id || r.client_id;
        const c = clientMap.get(crmId) || clientMap.get(r.client_id);
        if (!c) return null;
        const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.email;
        const status = getBuyerStatus({ agent_user_id: c.agent_user_id });
        return {
          clientId: c.id,
          name,
          email: c?.email ?? "",
          phone: c?.phone ?? null,
          firstName: c?.first_name ?? "",
          lastName: c?.last_name ?? "",
          agentId: c?.agent_id ?? "",
          agentUserId: c?.agent_user_id ?? null,
          notes: c?.notes ?? null,
          status,
          hotSheetCount: hsCountMap.get(c.id) ?? 0,
          createdAt: r.created_at ?? c.updated_at ?? "",
          updatedAt: c.updated_at ?? r.created_at ?? "",
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

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: buyers.length,
      active: 0,
      pending_invite: 0,
    };
    for (const b of buyers) c[b.status] += 1;
    return c;
  }, [buyers]);

  const visible = useMemo(() => {
    let list = buyers;
    if (filter !== "all") list = list.filter((b) => b.status === filter);
    return [...list].sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
  }, [buyers, filter]);

  const tabs: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    ...BUYER_STATUS_ORDER.map((s) => ({ key: s as FilterKey, label: BUYER_STATUS_CONFIG[s].label })),
  ];

  return (
    <PageShell>
      <PageHeader
        title="My Buyers"
        subtitle="Manage buyer hot sheets, favorites, invites, and activity."
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            New Buyer
          </Button>
        }
      />

      {/* Filter tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {tabs.map((t) => {
          const active = filter === t.key;
          const count = counts[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                active
                  ? "bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "text-[10px] tabular-nums",
                  active ? "text-white/70" : "text-slate-400",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {filter === "all" ? "No buyers yet." : "No buyers in this status."}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((b) => (
            <Card
              key={b.clientId}
              className="cursor-pointer border border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow-md hover:-translate-y-px active:translate-y-0 active:shadow-sm transition-all duration-180"
              onClick={() => navigate(`/success-hub/buyers/${b.clientId}`)}
            >
              <CardContent className="flex items-center justify-between px-6 py-5">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-slate-900">{b.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{b.email}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <BuyerStatusBadge status={b.status} />
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">
                    {b.hotSheetCount} hot sheet{b.hotSheetCount !== 1 ? "s" : ""}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-[11px] font-medium text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditBuyer(b);
                    }}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0 text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="More actions"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setRemoveBuyer(b);
                        }}
                      >
                        <UserMinus className="h-3.5 w-3.5 mr-2" />
                        Remove Buyer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateBuyerDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={loadBuyers}
      />

      <EditBuyerDialog
        open={!!editBuyer}
        onOpenChange={(o) => { if (!o) setEditBuyer(null); }}
        buyer={
          editBuyer
            ? {
                id: editBuyer.clientId,
                first_name: editBuyer.firstName,
                last_name: editBuyer.lastName,
                email: editBuyer.email,
                phone: editBuyer.phone,
                notes: editBuyer.notes,
              }
            : null
        }
        onSuccess={loadBuyers}
      />

      <RemoveBuyerClientDialog
        open={!!removeBuyer}
        onOpenChange={(o) => { if (!o) setRemoveBuyer(null); }}
        buyerName={removeBuyer?.name}
        agentId={removeBuyer?.agentId}
        buyerId={removeBuyer?.clientId}
        onRemoved={loadBuyers}
      />
    </PageShell>
  );
}

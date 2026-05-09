import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Home, Pencil, ArrowLeft, CheckCircle2, Clock, Plus } from "lucide-react";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { EditHotsheetCriteriaDialog } from "@/components/EditHotsheetCriteriaDialog";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { toast } from "sonner";
import { buyerCollectionCardRoot, buyerImageMosaicGrid, buyerSectionCard } from "@/lib/buyerUi";
import { fetchBuyerActivityMetrics, type BuyerActivityMetrics } from "@/lib/fetchBuyerActivityMetrics";
import { AgentBuyerActivityHeaderCard } from "@/components/agent/AgentBuyerActivityHeaderCard";
import { formatCriteriaDisplayLabel, formatCriteriaDisplayLabels } from "@/lib/formatCriteriaDisplay";

interface BuyerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
}

interface LinkedHotSheet {
  id: string;
  name: string;
  criteria: any;
  photos: string[];
  matchCount: number;
}

function PhotoCell({ src }: { src?: string }) {
  if (src) {
    return (
      <div className="relative w-full h-full overflow-hidden">
        <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      </div>
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-white">
      <Home className="h-5 w-5 text-neutral-300" />
    </div>
  );
}

function CriteriaPills({ criteria }: { criteria: any }) {
  if (!criteria) return null;

  const pills: string[] = [];

  const locations = criteria.cities || criteria.towns || [];
  if (locations.length > 0) {
    pills.push(locations.slice(0, 2).join(", ") + (locations.length > 2 ? ` +${locations.length - 2}` : ""));
  } else if (criteria.state) {
    pills.push(criteria.state);
  }

  if (criteria.priceMin || criteria.priceMax) {
    const min = criteria.priceMin ? `$${(criteria.priceMin / 1000).toFixed(0)}k` : "Any";
    const max = criteria.priceMax ? `$${(criteria.priceMax / 1000).toFixed(0)}k` : "No max";
    pills.push(`${min} – ${max}`);
  }

  if (criteria.bedroomsMin) pills.push(`${criteria.bedroomsMin}+ beds`);

  if (criteria.bathroomsMin) pills.push(`${criteria.bathroomsMin}+ baths`);

  if (criteria.propertyTypes?.length) {
    const types = criteria.propertyTypes as string[];
    const label = types.length === 1 ? formatCriteriaDisplayLabel(types[0]) : `${types.length} types`;
    pills.push(label);
  }

  if (criteria.statuses?.length) {
    pills.push(formatCriteriaDisplayLabels(criteria.statuses as string[]));
  }

  if (criteria.sqftMin) pills.push(`${criteria.sqftMin.toLocaleString()}+ sqft`);

  if (pills.length === 0) return <span className="text-xs text-zinc-400">All properties</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {pills.map((pill, i) => (
        <span
          key={i}
          className="rounded-full border border-zinc-200/80 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600"
        >
          {pill}
        </span>
      ))}
    </div>
  );
}

function RelationshipStatusPill({ status }: { status: "active" | "pending" }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
        <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-200/90 bg-sky-50 px-2.5 py-0.5 text-[11px] font-medium text-sky-900">
      <Clock className="h-3 w-3" />
      Pending
    </span>
  );
}

const HotSheetBuyerDetail = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = (location.state as any)?.from || "/agent/hot-sheets";
  const [loading, setLoading] = useState(true);
  const [buyer, setBuyer] = useState<BuyerInfo | null>(null);
  const [relationshipStatus, setRelationshipStatus] = useState<"active" | "pending" | null>(null);
  const [hotSheets, setHotSheets] = useState<LinkedHotSheet[]>([]);
  const [editingHotSheet, setEditingHotSheet] = useState<{ id: string; criteria: any } | null>(null);
  const [createHotSheetOpen, setCreateHotSheetOpen] = useState(false);
  const [agentUserId, setAgentUserId] = useState<string | null>(null);
  const [buyerActivityMetrics, setBuyerActivityMetrics] = useState<BuyerActivityMetrics | null>(null);

  useEffect(() => {
    if (clientId) fetchBuyerData();
  }, [clientId]);

  const fetchBuyerData = async () => {
    try {
      setLoading(true);
      setBuyerActivityMetrics(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setAgentUserId(user.id);

      const { data: rel } = await supabase
        .from("client_agent_relationships")
        .select("status")
        .eq("agent_id", user.id)
        .or(`crm_client_id.eq.${clientId},client_id.eq.${clientId}`)
        .in("status", ["active", "pending"])
        .maybeSingle();

      if (!rel) {
        toast.error("This buyer was removed.");
        navigate(backTo, { replace: true });
        return;
      }

      setRelationshipStatus(rel.status === "pending" ? "pending" : "active");

      const [clientRes, hscRes] = await Promise.all([
        supabase.from("clients").select("first_name, last_name, email, phone").eq("id", clientId!).maybeSingle(),
        supabase.from("hot_sheet_clients").select("hot_sheet_id").eq("client_id", clientId!),
      ]);

      if (clientRes.data) {
        setBuyer({
          firstName: clientRes.data.first_name || "",
          lastName: clientRes.data.last_name || "",
          email: clientRes.data.email || "",
          phone: clientRes.data.phone ?? null,
        });
      }

      if (hscRes.data?.length) {
        const hsIds = hscRes.data.map((r: any) => r.hot_sheet_id);
        const { data: hsData } = await supabase.from("hot_sheets").select("id, name, criteria").in("id", hsIds);

        const result: LinkedHotSheet[] = [];
        for (const hs of hsData || []) {
          let photos: string[] = [];
          const matchCount = { value: 0 };
          try {
            const criteria = hs.criteria as any;
            if (criteria) {
              const { data: matchedListings } = await buildListingsQuery(supabase, criteria).limit(200);
              for (const l of matchedListings || []) {
                const lPhotos = l.photos as any[] | null;
                if (lPhotos?.length && photos.length < 4) {
                  const raw = lPhotos[0];
                  const url = typeof raw === "string" ? raw : raw?.url || null;
                  if (url) photos.push(url);
                }
              }
              matchCount.value = matchedListings?.length || 0;
            }
          } catch (e) {
            console.error("Error fetching matches for", hs.id, e);
          }
          result.push({ id: hs.id, name: hs.name, criteria: hs.criteria, photos, matchCount: matchCount.value });
        }

        setHotSheets(result);
      } else {
        setHotSheets([]);
      }

      const activity = await fetchBuyerActivityMetrics(supabase, clientId!);
      setBuyerActivityMetrics(activity);
    } catch (e) {
      console.error("Error fetching buyer data:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="pt-4 px-6 pb-6">
        <div className="mx-auto w-full max-w-[88rem] min-w-0">
          <div className="mb-2 flex animate-pulse items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-zinc-100" />
            <div className="h-4 w-28 rounded bg-zinc-100" />
          </div>
          <div className="mb-3 space-y-2">
            <div className="h-[4.5rem] rounded-xl border border-zinc-200/60 bg-zinc-50" />
            <div className="h-8 w-40 animate-pulse rounded-md bg-zinc-100" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 lg:gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50">
                <div className="aspect-[4/3] bg-zinc-100" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-2/3 rounded bg-zinc-200" />
                  <div className="h-3 w-1/2 rounded bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const displayName = buyer
    ? `${buyer.firstName} ${buyer.lastName}`.trim() || buyer.email || "Unknown Buyer"
    : "Unknown Buyer";

  return (
    <div className="pt-4 px-6 pb-6">
      <div className="mx-auto w-full max-w-[88rem] min-w-0">
        {/* Header — back + title only (matches mockup) */}
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="rounded-md p-1.5 -ml-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-600">Hot sheets</h1>
        </div>

        {/* Buyer card + New Hot Sheet (grouped — CTA directly under card, left-aligned) */}
        {buyer && relationshipStatus && (
          <div className="mb-3 w-full space-y-2">
            <AgentBuyerActivityHeaderCard
              displayName={displayName}
              email={buyer.email}
              phone={buyer.phone ?? null}
              crmClientId={clientId!}
              metrics={buyerActivityMetrics}
              metricsLoading={buyerActivityMetrics === null}
              trailing={<RelationshipStatusPill status={relationshipStatus} />}
            />
            <div className="flex w-full justify-start">
              <Button
                type="button"
                variant="outline"
                className="h-8 shrink-0 gap-1.5 rounded-md border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                onClick={() => setCreateHotSheetOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                New Hot Sheet
              </Button>
            </div>
          </div>
        )}

        {hotSheets.length === 0 ? (
          <div className={`${buyerSectionCard} rounded-xl border-zinc-200/90 p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]`}>
            <p className="text-sm text-zinc-500">No hot sheets linked to this buyer.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 lg:gap-5">
            {hotSheets.map((hs) => (
              <div
                key={hs.id}
                onClick={() => navigate(`/hot-sheets/${hs.id}/review`)}
                className={`relative ${buyerCollectionCardRoot} rounded-xl border-zinc-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)]`}
              >
                <button
                  type="button"
                  aria-label="Edit hot sheet"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingHotSheet({ id: hs.id, criteria: hs.criteria });
                  }}
                  className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200/90 bg-white shadow-sm transition-colors hover:bg-zinc-50"
                >
                  <Pencil className="h-3.5 w-3.5 text-zinc-700" />
                </button>

                <div className={buyerImageMosaicGrid}>
                  <PhotoCell src={hs.photos[0]} />
                  <PhotoCell src={hs.photos[1]} />
                  <PhotoCell src={hs.photos[2]} />
                  <PhotoCell src={hs.photos[3]} />
                </div>

                <div className="bg-white px-3 pt-2.5 pb-3">
                  <h3 className="truncate text-sm font-semibold text-zinc-900">{hs.name}</h3>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {hs.matchCount} listing{hs.matchCount !== 1 ? "s" : ""} match
                  </p>
                  <div className="mt-2">
                    <CriteriaPills criteria={hs.criteria} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {editingHotSheet && (
          <EditHotsheetCriteriaDialog
            open={!!editingHotSheet}
            onOpenChange={(open) => !open && setEditingHotSheet(null)}
            hotSheetId={editingHotSheet.id}
            initialCriteria={editingHotSheet.criteria}
            onUpdate={() => {
              fetchBuyerData();
              setEditingHotSheet(null);
            }}
          />
        )}

        {agentUserId && clientId && buyer && (
          <CreateHotSheetDialog
            open={createHotSheetOpen}
            onOpenChange={setCreateHotSheetOpen}
            userId={agentUserId}
            clientId={clientId}
            clientName={displayName}
            lockedToClient
            preSelectedClients={[
              {
                id: clientId,
                first_name: buyer.firstName,
                last_name: buyer.lastName,
                email: buyer.email,
                phone: buyer.phone ?? null,
              },
            ]}
            onSuccess={(hotSheetId) => {
              setCreateHotSheetOpen(false);
              fetchBuyerData();
              navigate(`/hot-sheets/${hotSheetId}/review`);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default HotSheetBuyerDetail;

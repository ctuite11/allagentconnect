import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Home, Pencil } from "lucide-react";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { EditHotsheetCriteriaDialog } from "@/components/EditHotsheetCriteriaDialog";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buyerCollectionCardRoot, buyerImageMosaicGrid, buyerSectionCard } from "@/lib/buyerUi";

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

/** Detail header scale — compact AAC standard. */
const buyerDetailTitleClass = cn("text-xl font-semibold tracking-tight text-zinc-900");

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

  // Location
  const locations = criteria.cities || criteria.towns || [];
  if (locations.length > 0) {
    pills.push(locations.slice(0, 2).join(", ") + (locations.length > 2 ? ` +${locations.length - 2}` : ""));
  } else if (criteria.state) {
    pills.push(criteria.state);
  }

  // Price
  if (criteria.priceMin || criteria.priceMax) {
    const min = criteria.priceMin ? `$${(criteria.priceMin / 1000).toFixed(0)}k` : "Any";
    const max = criteria.priceMax ? `$${(criteria.priceMax / 1000).toFixed(0)}k` : "No max";
    pills.push(`${min} – ${max}`);
  }

  // Beds
  if (criteria.bedroomsMin) pills.push(`${criteria.bedroomsMin}+ beds`);

  // Baths
  if (criteria.bathroomsMin) pills.push(`${criteria.bathroomsMin}+ baths`);

  // Property types
  if (criteria.propertyTypes?.length) {
    const types = criteria.propertyTypes as string[];
    const label = types.length === 1 ? types[0] : `${types.length} types`;
    pills.push(label);
  }

  // Sqft
  if (criteria.sqftMin) pills.push(`${criteria.sqftMin.toLocaleString()}+ sqft`);

  if (pills.length === 0) return <span className="text-sm text-zinc-400">All properties</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map((pill, i) => (
        <span key={i} className="px-2.5 py-0.5 bg-zinc-100 text-zinc-600 rounded-full text-xs font-medium">
          {pill}
        </span>
      ))}
    </div>
  );
}

const HotSheetBuyerDetail = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = (location.state as any)?.from || "/agent/hot-sheets";
  const [loading, setLoading] = useState(true);
  const [buyer, setBuyer] = useState<BuyerInfo | null>(null);
  const [hotSheets, setHotSheets] = useState<LinkedHotSheet[]>([]);
  const [editingHotSheet, setEditingHotSheet] = useState<{ id: string; criteria: any } | null>(null);
  const [createHotSheetOpen, setCreateHotSheetOpen] = useState(false);
  const [agentUserId, setAgentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (clientId) fetchBuyerData();
  }, [clientId]);

  const fetchBuyerData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setAgentUserId(user.id);

      // Guard: if this buyer no longer has an active/pending relationship
      // with this agent, redirect away from the active workspace.
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

      // Fetch hot sheets with criteria
      if (hscRes.data?.length) {
        const hsIds = hscRes.data.map((r: any) => r.hot_sheet_id);
        const { data: hsData } = await supabase
          .from("hot_sheets")
          .select("id, name, criteria")
          .in("id", hsIds);

        // For each hot sheet, run criteria query to get matching listing photos
        const result: LinkedHotSheet[] = [];
        for (const hs of hsData || []) {
          let photos: string[] = [];
          const matchCount = { value: 0 };
          try {
            const criteria = hs.criteria as any;
            if (criteria) {
              const { data: matchedListings, count: totalCount } = await buildListingsQuery(supabase, criteria).limit(200);
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
    } catch (e) {
      console.error("Error fetching buyer data:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <PageHeader
          title="Buyer Detail"
          backTo={backTo}
          titleClassName={buyerDetailTitleClass}
          compactBack
          className="mb-6"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-zinc-200 bg-zinc-50 animate-pulse">
              <div className="aspect-[4/3] bg-zinc-100 rounded-t-2xl" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-zinc-200 rounded w-2/3" />
                <div className="h-4 bg-zinc-100 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  const displayName = buyer
    ? `${buyer.firstName} ${buyer.lastName}`.trim() || buyer.email || "Unknown Buyer"
    : "Unknown Buyer";

  const newHotSheetBtnClass =
    "h-8 shrink-0 rounded-md border border-zinc-200/90 bg-white px-3 text-sm font-medium text-zinc-700 shadow-none hover:bg-zinc-50";

  return (
    <PageShell className="pb-8">
      <div className="mb-6">
        <PageHeader
          title={displayName}
          backTo={backTo}
          titleClassName={buyerDetailTitleClass}
          compactBack
          className="mb-1"
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={newHotSheetBtnClass}
              onClick={() => setCreateHotSheetOpen(true)}
            >
              New Hot Sheet
            </Button>
          }
        />
        {buyer?.email ? (
          <p className="text-sm font-normal text-zinc-500">{buyer.email}</p>
        ) : null}
      </div>

      {/* Hot Sheet Collection Cards */}
      {hotSheets.length === 0 ? (
        <div className={`${buyerSectionCard} p-12 text-center`}>
          <p className="text-zinc-500">No hot sheets linked to this buyer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hotSheets.map((hs) => (
            <div
              key={hs.id}
              onClick={() => navigate(`/hot-sheets/${hs.id}/review`)}
              className={`relative ${buyerCollectionCardRoot}`}
            >
              {/* Edit pencil — top right */}
              <button
                type="button"
                aria-label="Edit hot sheet"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingHotSheet({ id: hs.id, criteria: hs.criteria });
                }}
                className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-white border border-neutral-200 shadow-sm flex items-center justify-center hover:bg-white transition-colors"
              >
                <Pencil className="h-3.5 w-3.5 text-zinc-700" />
              </button>

              <div className={buyerImageMosaicGrid}>
                <PhotoCell src={hs.photos[0]} />
                <PhotoCell src={hs.photos[1]} />
                <PhotoCell src={hs.photos[2]} />
                <PhotoCell src={hs.photos[3]} />
              </div>

              {/* Card Body — same white slab as parent; no muted fill */}
              <div className="bg-white px-4 pt-3 pb-4">
                <h3 className="text-lg font-semibold text-zinc-900 truncate">{hs.name}</h3>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {hs.matchCount} listing{hs.matchCount !== 1 ? "s" : ""} match
                </p>

                {/* Search Criteria Pills */}
                <div className="mt-2">
                  <CriteriaPills criteria={hs.criteria} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Hot Sheet Dialog */}
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
            toast.success("Hot Sheet created");
            setCreateHotSheetOpen(false);
            fetchBuyerData();
            navigate(`/hot-sheets/${hotSheetId}/review`);
          }}
        />
      )}
    </PageShell>
  );
};

export default HotSheetBuyerDetail;

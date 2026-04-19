import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, AlertCircle, Home, MapPin, Pencil } from "lucide-react";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { EditHotsheetCriteriaDialog } from "@/components/EditHotsheetCriteriaDialog";
import { toast } from "sonner";

interface BuyerInfo {
  firstName: string;
  lastName: string;
  email: string;
}

interface LinkedHotSheet {
  id: string;
  name: string;
  criteria: any;
  photos: string[];
  matchCount: number;
}

type InviteStatus = "accepted" | "pending" | "not_invited";

function PhotoCell({ src }: { src?: string }) {
  if (src) {
    return (
      <div className="relative w-full h-full overflow-hidden">
        <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      </div>
    );
  }
  return (
    <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
      <Home className="h-5 w-5 text-zinc-300" />
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
  const [loading, setLoading] = useState(true);
  const [buyer, setBuyer] = useState<BuyerInfo | null>(null);
  const [hotSheets, setHotSheets] = useState<LinkedHotSheet[]>([]);
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>("not_invited");
  const [editingHotSheet, setEditingHotSheet] = useState<{ id: string; criteria: any } | null>(null);

  useEffect(() => {
    if (clientId) fetchBuyerData();
  }, [clientId]);

  const fetchBuyerData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
        navigate("/hot-sheets", { replace: true });
        return;
      }

      const [clientRes, hscRes, tokensRes] = await Promise.all([
        supabase.from("clients").select("first_name, last_name, email").eq("id", clientId!).maybeSingle(),
        supabase.from("hot_sheet_clients").select("hot_sheet_id").eq("client_id", clientId!),
        supabase.from("share_tokens").select("payload, accepted_at").eq("agent_id", user.id),
      ]);

      if (clientRes.data) {
        setBuyer({
          firstName: clientRes.data.first_name || "",
          lastName: clientRes.data.last_name || "",
          email: clientRes.data.email || "",
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
      }

      // Invite status
      if (tokensRes.data) {
        const clientTokens = tokensRes.data.filter(
          (t: any) => t.payload?.type === "client_hotsheet_invite" && t.payload?.client_id === clientId
        );
        if (clientTokens.length === 0) setInviteStatus("not_invited");
        else if (clientTokens.some((t: any) => t.accepted_at)) setInviteStatus("accepted");
        else setInviteStatus("pending");
      }
    } catch (e) {
      console.error("Error fetching buyer data:", e);
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: Record<InviteStatus, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "outline" }> = {
    accepted: { label: "Accepted", icon: <CheckCircle2 className="h-3 w-3" />, variant: "default" },
    pending: { label: "Pending", icon: <Clock className="h-3 w-3" />, variant: "secondary" },
    not_invited: { label: "Not Invited", icon: <AlertCircle className="h-3 w-3" />, variant: "outline" },
  };

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Buyer Detail" backTo="/hot-sheets" className="mb-8" />
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

  const status = statusConfig[inviteStatus];

  return (
    <PageShell className="pb-8">
      <PageHeader title={displayName} backTo="/hot-sheets" className="mb-2" />

      {/* Buyer info row */}
      <div className="flex items-center gap-3 mb-8">
        {buyer?.email && <span className="text-sm text-zinc-500">{buyer.email}</span>}
        <Badge variant={status.variant} className="flex items-center gap-1.5">
          {status.icon}
          {status.label}
        </Badge>
      </div>

      {/* Hot Sheet Collection Cards */}
      {hotSheets.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-12 text-center">
          <p className="text-zinc-500">No hot sheets linked to this buyer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hotSheets.map((hs) => (
            <div
              key={hs.id}
              onClick={() => navigate(`/hot-sheets/${hs.id}/review`)}
              className="relative bg-white border border-zinc-200 rounded-2xl shadow-sm cursor-pointer will-change-transform transition-all duration-200 hover:shadow-lg hover:-translate-y-[1px] focus-within:shadow-lg overflow-hidden"
            >
              {/* Edit pencil — top right */}
              <button
                type="button"
                aria-label="Edit hot sheet"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingHotSheet({ id: hs.id, criteria: hs.criteria });
                }}
                className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-white/95 backdrop-blur-sm border border-zinc-200 shadow-sm flex items-center justify-center hover:bg-white transition-colors"
              >
                <Pencil className="h-3.5 w-3.5 text-zinc-700" />
              </button>

              {/* 2x2 Photo Mosaic */}
              <div className="aspect-[4/3] grid grid-cols-2 grid-rows-2 gap-px bg-zinc-200">
                <PhotoCell src={hs.photos[0]} />
                <PhotoCell src={hs.photos[1]} />
                <PhotoCell src={hs.photos[2]} />
                <PhotoCell src={hs.photos[3]} />
              </div>

              {/* Card Body */}
              <div className="px-4 pt-3 pb-4">
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
    </PageShell>
  );
};

export default HotSheetBuyerDetail;

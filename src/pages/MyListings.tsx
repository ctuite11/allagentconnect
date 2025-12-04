import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import Navigation from "@/components/Navigation";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Pencil, Eye, Share2, Trash2, Grid, List as ListIcon, Plus, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { OpenHouseDialog } from "@/components/OpenHouseDialog";
import { ViewOpenHousesDialog } from "@/components/ViewOpenHousesDialog";
import { ReverseProspectDialog } from "@/components/ReverseProspectDialog";
import SocialShareMenu from "@/components/SocialShareMenu";
import { getListingPublicUrl, getListingShareUrl } from "@/lib/getPublicUrl";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
type ListingStatus = "new" | "active" | "pending" | "sold" | "withdrawn" | "expired" | "cancelled" | "draft" | "coming_soon";

interface Listing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  status: string;
  listing_number: string;
  photos: any;
  open_houses?: any;
  created_at: string;
  active_date: string | null;
  list_date?: string | null;
  expiration_date?: string | null;
  hot_sheet_matches?: number | null;
  views_count?: number | null;
  property_type?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  square_feet?: number | null;
  neighborhood?: string | null;
  listing_stats?: {
    view_count: number;
    save_count: number;
    share_count: number;
    contact_count: number;
    showing_request_count: number;
  };
}

const STATUS_TABS: { label: string; value: ListingStatus }[] = [
  { label: "New", value: "new" },
  { label: "Coming Soon", value: "coming_soon" },
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Sold", value: "sold" },
  { label: "Withdrawn", value: "withdrawn" },
  { label: "Expired", value: "expired" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Draft", value: "draft" },
];

function statusBadgeClass(status: string) {
  switch (status) {
    case "new":
      return "bg-emerald-500 text-white";
    case "active":
      return "bg-blue-500 text-white";
    case "pending":
      return "bg-amber-500 text-white";
    case "sold":
      return "bg-green-500 text-white";
    case "draft":
      return "bg-gray-400 text-white";
    case "coming_soon":
      return "bg-purple-500 text-white";
    case "withdrawn":
    case "expired":
    case "cancelled":
      return "bg-red-500 text-white";
    default:
      return "bg-gray-200 text-gray-800";
  }
}

function getThumbnailUrl(listing: Listing) {
  if (!listing.photos) return null;
  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  if (photos.length === 0) return null;
  
  // Handle both string URLs and objects with url property
  const firstPhoto = photos[0];
  if (typeof firstPhoto === 'string') {
    return firstPhoto;
  }
  return firstPhoto?.url || null;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

/**
 * PURE UI COMPONENT – takes listings + handlers, no Supabase here.
 */
function MyListingsView({
  listings,
  onEdit,
  onPreview,
  onShare,
  onDelete,
  onBulkDeleteDrafts,
  onNewListing,
  onQuickUpdate,
  onPhotos,
  onOpenHouse,
  onBrokerTour,
  onViewOpenHouses,
  onMatches,
  onSocialShare,
  onStats,
}: {
  listings: Listing[];
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
  onShare: (id: string) => void;
  onDelete: (id: string) => void;
  onBulkDeleteDrafts: (ids: string[]) => Promise<void>;
  onNewListing: () => void;
  onQuickUpdate: (id: string, updates: Partial<Pick<Listing, "price" | "status">>) => Promise<void>;
  onPhotos: (id: string) => void;
  onOpenHouse: (listing: Listing) => void;
  onBrokerTour: (listing: Listing) => void;
  onViewOpenHouses: (listing: Listing) => void;
  onMatches: (listing: Listing) => void;
  onSocialShare: (listing: Listing) => void;
  onStats: (id: string) => void;
}) {
  const [activeStatus, setActiveStatus] = useState<ListingStatus>("new");
  const [view, setView] = useState<"grid" | "list">("list");

  // Quick edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number | "">("");
  const [editStatus, setEditStatus] = useState<ListingStatus | "">("");

  // Bulk draft deletion state
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get draft listings for bulk selection
  const draftListings = useMemo(() => listings.filter(l => l.status === "draft"), [listings]);

  // Clear selection when switching away from draft tab
  useEffect(() => {
    if (activeStatus !== "draft") {
      setSelectedDraftIds(new Set());
    }
  }, [activeStatus]);

  const toggleDraftSelection = (id: string) => {
    setSelectedDraftIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllDrafts = () => {
    if (selectedDraftIds.size === draftListings.length) {
      setSelectedDraftIds(new Set());
    } else {
      setSelectedDraftIds(new Set(draftListings.map(l => l.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDraftIds.size === 0) return;
    setIsDeleting(true);
    try {
      await onBulkDeleteDrafts(Array.from(selectedDraftIds));
      setSelectedDraftIds(new Set());
    } finally {
      setIsDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  };

  const filteredListings = useMemo(() => {
    let result = listings.filter((l) => l.status === activeStatus);
    // Sort newest first
    result.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
    return result;
  }, [listings, activeStatus]);

  const startQuickEdit = (listing: Listing) => {
    setEditingId(listing.id);
    setEditPrice(listing.price);
    setEditStatus(listing.status as ListingStatus);
  };

  const cancelQuickEdit = () => {
    setEditingId(null);
    setEditPrice("");
    setEditStatus("");
  };

  const saveQuickEdit = async () => {
    if (!editingId || editPrice === "" || editStatus === "") return;

    await onQuickUpdate(editingId, {
      price: Number(editPrice),
      status: editStatus as ListingStatus,
    });

    cancelQuickEdit();
  };

  const comingSoon = (feature: string) => {
    toast.info(`${feature} is coming soon.`);
  };

  return (
    <div className="flex-1 container mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Listings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your active, pending, and past listings from one place.
          </p>
        </div>
      </div>

      {/* New Listing Button Row */}
      <div className="flex items-center justify-between">
        <button
          onClick={onNewListing}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
        >
          <Plus className="h-4 w-4" />
          New Listing
        </button>

        {/* View toggle */}
        <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-muted">
          <button
            onClick={() => setView("grid")}
            className={`p-1.5 rounded ${
              view === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Grid size={16} />
          </button>
          <button
            onClick={() => setView("list")}
            className={`p-1.5 rounded ${
              view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <ListIcon size={16} />
          </button>
        </div>
      </div>

      {/* Status Tabs - smaller buttons */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveStatus(tab.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              activeStatus === tab.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:bg-accent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedDraftIds.size} draft listing(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedDraftIds.size} draft listing(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Select All Drafts Row - only visible on Draft tab */}
      {activeStatus === "draft" && draftListings.length > 0 && (
        <div className="flex items-center gap-4 py-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all-drafts"
              checked={selectedDraftIds.size === draftListings.length && draftListings.length > 0}
              onCheckedChange={selectAllDrafts}
            />
            <label htmlFor="select-all-drafts" className="text-sm font-medium cursor-pointer">
              Select All Drafts ({selectedDraftIds.size} of {draftListings.length})
            </label>
          </div>
          {selectedDraftIds.size > 0 && (
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition text-sm font-medium disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedDraftIds.size})
            </button>
          )}
        </div>
      )}

      {/* GRID VIEW */}
      {view === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((l) => {
            const thumbnail = getThumbnailUrl(l);
            return (
              <div
                key={l.id}
                className="border border-border rounded-xl overflow-hidden bg-card shadow-sm hover:shadow-lg transition"
              >
                <div className="w-full h-48 bg-muted overflow-hidden cursor-pointer" onClick={() => onPreview(l.id)}>
                  <img src={thumbnail || "/placeholder.svg"} alt={l.address} className="w-full h-full object-cover" />
                </div>

                <div className="p-4">
                  <div className="font-semibold text-lg">
                    {l.address}, {l.city}
                  </div>
                  <div className="text-muted-foreground text-sm mt-1">${l.price.toLocaleString()}</div>

                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className={`text-xs font-medium px-3 py-1 rounded-full capitalize ${statusBadgeClass(l.status)}`}
                    >
                      {l.status.replace("_", " ")}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition"
                        onClick={() => onEdit(l.id)}
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition"
                        onClick={() => onPreview(l.id)}
                        title="Preview"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition"
                        onClick={() => onShare(l.id)}
                        title="Share"
                      >
                        <Share2 size={16} />
                      </button>
                      <button
                        className="p-2 rounded-md hover:bg-destructive/10 text-destructive transition"
                        onClick={() => onDelete(l.id)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredListings.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground text-sm py-10">
              No listings match your filters yet.
            </div>
          )}
        </div>
      )}

      {/* LIST VIEW – with MLS-style quick tools + quick edit */}
      {/* LIST VIEW – MLS-style tools + quick edit near price/status */}
      {/* LIST VIEW – MLS-style tools + quick edit near price/status */}
      {view === "list" && (
        <div className="space-y-3">
          {filteredListings.map((l) => {
            const thumbnail = getThumbnailUrl(l);
            const isEditing = editingId === l.id;
            const matchCount = l.hot_sheet_matches ?? 0;
            const views = l.listing_stats?.view_count ?? 0;
            const favorites = l.listing_stats?.save_count ?? 0;
            const shares = l.listing_stats?.share_count ?? 0;
            const listDate = formatDate(l.list_date) || formatDate(l.created_at);
            const expDate = formatDate(l.expiration_date);
            const hasOpenHouses = Array.isArray(l.open_houses) && l.open_houses.length > 0;
            const hasPublicOpenHouse = Array.isArray(l.open_houses) && 
              l.open_houses.some((oh: any) => oh.event_type === "in_person");
            const hasBrokerTour = Array.isArray(l.open_houses) && 
              l.open_houses.some((oh: any) => oh.event_type === "broker_tour");

            return (
              <div
                key={l.id}
                className="border border-border rounded-xl bg-card p-4 shadow-sm hover:shadow-md transition"
              >
                {/* Top tools bar – NO Views here */}
                <div className="flex flex-wrap items-center gap-3 text-xs border-b border-border pb-2 mb-3">
                  <button
                    className="px-3 py-1 rounded-full bg-white border border-border text-foreground hover:bg-accent transition"
                    onClick={() => onPhotos(l.id)}
                    title="Manage photos"
                  >
                    Photos
                  </button>
                  <button
                    className={`px-3 py-1 rounded-full transition flex items-center gap-1 ${
                      hasPublicOpenHouse 
                        ? "bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100"
                        : "bg-green-50 border border-green-200 text-green-700 hover:bg-green-100"
                    }`}
                    onClick={() => hasPublicOpenHouse ? onViewOpenHouses(l) : onOpenHouse(l)}
                  >
                    🎈 {hasPublicOpenHouse ? "View Schedule" : "Public Open House"}
                  </button>
                  <button
                    className={`px-3 py-1 rounded-full transition flex items-center gap-1 ${
                      hasBrokerTour 
                        ? "bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100"
                        : "bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100"
                    }`}
                    onClick={() => hasBrokerTour ? onViewOpenHouses(l) : onBrokerTour(l)}
                  >
                    🚗 {hasBrokerTour ? "View Schedule" : "Broker Open House"}
                  </button>
                  <button
                    className="px-3 py-1 rounded-full bg-white border border-border text-foreground hover:bg-accent transition"
                    onClick={() => onMatches(l)}
                    title="Contact matching buyers"
                  >
                    Matches ({matchCount})
                  </button>
                  <button
                    className="px-3 py-1 rounded-full bg-white border border-border text-foreground hover:bg-accent transition"
                    onClick={() => onSocialShare(l)}
                    title="Share on social media"
                  >
                    Social Share
                  </button>
                  <button
                    className="px-3 py-1 rounded-full bg-white border border-border text-foreground hover:bg-accent transition flex items-center gap-1"
                    onClick={() => onStats(l.id)}
                    title="View analytics"
                  >
                    <BarChart3 className="h-3 w-3" />
                    Stats
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  {/* Checkbox for draft selection */}
                  {activeStatus === "draft" && l.status === "draft" && (
                    <div className="shrink-0">
                      <Checkbox
                        checked={selectedDraftIds.has(l.id)}
                        onCheckedChange={() => toggleDraftSelection(l.id)}
                      />
                    </div>
                  )}

                  {/* Thumbnail */}
                  <div className="w-32 h-24 rounded-lg overflow-hidden bg-muted shrink-0 cursor-pointer">
                    <img
                      src={thumbnail || "/placeholder.svg"}
                      alt={l.address}
                      className="w-full h-full object-cover"
                      onClick={() => onPreview(l.id)}
                    />
                  </div>

                  {/* Main content column */}
                  <div className="flex-1 min-w-0">
                    {/* Address */}
                    <div className="font-semibold text-base truncate">
                      {l.address}, {l.city}
                    </div>

                    {/* Price + AAC + Quick Edit OR Save/Cancel on same row */}
                    <div className="mt-1 flex flex-wrap items-center gap-3 justify-between">
                      <div className="flex flex-wrap items-center gap-3">
                        {isEditing ? (
                          <input
                            type="number"
                            className="border border-border rounded px-2 py-1 text-sm w-32 bg-background"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value === "" ? "" : Number(e.target.value))}
                          />
                        ) : (
                          <div className="text-muted-foreground text-sm">${l.price.toLocaleString()}</div>
                        )}

                        {l.listing_number && (
                          <div className="text-xs text-muted-foreground">AAC #{l.listing_number}</div>
                        )}

                        {/* Save/Cancel buttons - show when editing */}
                        {isEditing && (
                          <div className="flex items-center gap-2">
                            <button
                              className="px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
                              onClick={saveQuickEdit}
                            >
                              Save
                            </button>
                            <button
                              className="px-2 py-1 rounded border border-border text-muted-foreground hover:bg-accent text-xs"
                              onClick={cancelQuickEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Quick Edit button - show when NOT editing */}
                      {!isEditing && (
                        <button
                          className="text-xs px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100 transition"
                          onClick={() => startQuickEdit(l)}
                          title="Quick edit price and status"
                        >
                          Quick Edit
                        </button>
                      )}
                    </div>

                    {/* Status + List / Exp / Matches / Views + Save/Cancel */}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-foreground/80 font-medium">
                      {/* Status pill or dropdown */}
                      {isEditing ? (
                        <select
                          className="border border-border rounded px-2 py-1 bg-background capitalize text-xs"
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as ListingStatus)}
                        >
                          {STATUS_TABS.map((tab) => (
                            <option key={tab.value} value={tab.value}>
                              {tab.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusBadgeClass(
                            l.status,
                          )}`}
                        >
                          {l.status.replace("_", " ")}
                        </span>
                      )}

                      {l.neighborhood && (
                        <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {l.neighborhood}
                        </span>
                      )}

                      <span>List: {listDate}</span>
                      {expDate && <span>Exp: {expDate}</span>}
                    </div>
                  </div>

                  {/* Right-hand icon column – NO Quick Edit here */}
                  <div className="flex flex-col items-end gap-2 text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <button
                        className="hover:text-foreground transition"
                        onClick={() => onEdit(l.id)}
                        title="Full edit"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        className="hover:text-foreground transition"
                        onClick={() => onPreview(l.id)}
                        title="Preview"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        className="hover:text-foreground transition"
                        onClick={() => onShare(l.id)}
                        title="Share link"
                      >
                        <Share2 size={18} />
                      </button>
                      <button
                        className="hover:text-destructive text-destructive/70 transition"
                        onClick={() => onDelete(l.id)}
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredListings.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-10">No listings match your filters yet.</div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * PAGE CONTAINER – fetches listings from Supabase and feeds them into the view.
 */
const MyListings = () => {
  const { user } = useAuthRole();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [openHouseListing, setOpenHouseListing] = useState<Listing | null>(null);
  const [brokerTourListing, setBrokerTourListing] = useState<Listing | null>(null);
  const [viewOpenHousesListing, setViewOpenHousesListing] = useState<Listing | null>(null);
  const [matchesListing, setMatchesListing] = useState<Listing | null>(null);
  const [socialShareListing, setSocialShareListing] = useState<Listing | null>(null);

  useEffect(() => {
    if (user) {
      fetchListings();
    }
  }, [user]);

  const fetchListings = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("listings")
        .select(`
          *,
          listing_stats (view_count, save_count, share_count, contact_count, showing_request_count)
        `)
        .eq("agent_id", user.id);

      if (error) throw error;
      
      const listingsWithStats = data?.map(listing => ({
        ...listing,
        views_count: listing.listing_stats?.view_count || 0,
        listing_stats: listing.listing_stats
      })) || [];

      // Calculate matches from hot_sheets
      const listingsWithMatches = await Promise.all(
        listingsWithStats.map(async (listing) => {
          // Query all active hot sheets
          const { data: hotSheets } = await supabase
            .from("hot_sheets")
            .select("id, criteria")
            .eq("is_active", true);
          
          // Count hot sheets where listing matches criteria
          let matchCount = 0;
          hotSheets?.forEach((hs: any) => {
            const criteria = hs.criteria;
            if (!criteria) return;
            
            // Check state match
            if (criteria.state && listing.state?.toLowerCase() !== criteria.state?.toLowerCase()) return;
            
            // Check city match (if cities specified)
            if (criteria.cities?.length > 0) {
              const listingCity = listing.city?.toLowerCase();
              const matchesCity = criteria.cities.some((c: string) => 
                c.toLowerCase() === listingCity
              );
              if (!matchesCity) return;
            }
            
            // Check property type match
            if (criteria.propertyTypes?.length > 0) {
              if (!criteria.propertyTypes.includes(listing.property_type)) return;
            }
            
            // Check price range
            if (criteria.minPrice && listing.price < criteria.minPrice) return;
            if (criteria.maxPrice && listing.price > criteria.maxPrice) return;
            
            // Check bedrooms
            if (criteria.bedrooms && listing.bedrooms < criteria.bedrooms) return;
            
            // Check bathrooms
            if (criteria.bathrooms && listing.bathrooms < criteria.bathrooms) return;
            
            matchCount++;
          });
          
          return {
            ...listing,
            hot_sheet_matches: matchCount
          };
        })
      );

      setListings(listingsWithMatches);
    } catch (error) {
      console.error("Error fetching listings:", error);
      toast.error("Failed to load listings");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id: string) => {
    navigate(`/agent/listings/edit/${id}`);
  };

  const handlePreview = (id: string) => {
    navigate(`/property/${id}`);
  };

  const handleShare = async (id: string) => {
    const url = getListingShareUrl(id);
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
    
    // Track the share
    const { trackShare } = await import("@/lib/trackShare");
    await trackShare(id, 'copy_link');
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this listing?")) return;

    try {
      const { error } = await supabase.from("listings").delete().eq("id", id);
      if (error) throw error;

      toast.success("Listing deleted successfully");
      fetchListings();
    } catch (error) {
      console.error("Error deleting listing:", error);
      toast.error("Failed to delete listing");
    }
  };

  const handleNewListing = () => {
    navigate("/agent/listings/new");
  };

  const handleQuickUpdate = async (id: string, updates: Partial<Pick<Listing, "price" | "status">>) => {
    try {
      const { data, error } = await supabase.from("listings").update(updates).eq("id", id).select("*").single();

      if (error) throw error;

      setListings((prev) => prev.map((l) => (l.id === id ? { ...l, ...(data as Listing) } : l)));
      toast.success("Listing updated");
    } catch (error) {
      console.error("Error updating listing:", error);
      toast.error("Failed to update listing");
    }
  };

  const handlePhotos = (id: string) => {
    navigate(`/agent/listings/${id}/photos`);
  };

  const handleOpenHouse = (listing: Listing) => {
    setOpenHouseListing(listing);
  };

  const handleBrokerTour = (listing: Listing) => {
    setBrokerTourListing(listing);
  };

  const handleViewOpenHouses = (listing: Listing) => {
    setViewOpenHousesListing(listing);
  };

  const handleMatches = (listing: Listing) => {
    setMatchesListing(listing);
  };

  const handleSocialShare = (listing: Listing) => {
    setSocialShareListing(listing);
  };

  const handleStats = (id: string) => {
    navigate(`/analytics/${id}`);
  };

  const handleBulkDeleteDrafts = async (ids: string[]) => {
    try {
      const { error } = await supabase.from("listings").delete().in("id", ids);
      if (error) throw error;
      
      toast.success(`Successfully deleted ${ids.length} draft listing(s)`, {
        className: "bg-green-50 border-green-200 text-green-800",
      });
      fetchListings();
    } catch (error) {
      console.error("Error deleting drafts:", error);
      toast.error("Failed to delete drafts. Please try again.", {
        className: "bg-red-50 border-red-200 text-red-800",
      });
    }
  };

  const handleOpenHouseClose = () => {
    setOpenHouseListing(null);
    setBrokerTourListing(null);
    fetchListings();
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <div className="flex-1 flex items-center justify-center p-6 pt-24">
          <p className="text-muted-foreground">You must be signed in as an agent to view your listings.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen message="Loading your listings..." />;
  }

  if (listings.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <div className="flex-1 container mx-auto p-6 pt-24">
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <h1 className="text-3xl font-semibold mb-2">My Listings</h1>
            <p className="text-muted-foreground mb-6">You haven't created any listings yet.</p>
            <button
              onClick={handleNewListing}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-lg"
            >
              <Plus className="h-5 w-5" />
              Create Your First Listing
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="pt-20">
      <MyListingsView
        listings={listings}
        onEdit={handleEdit}
        onPreview={handlePreview}
        onShare={handleShare}
        onDelete={handleDelete}
        onBulkDeleteDrafts={handleBulkDeleteDrafts}
        onNewListing={handleNewListing}
        onQuickUpdate={handleQuickUpdate}
        onPhotos={handlePhotos}
        onOpenHouse={handleOpenHouse}
        onBrokerTour={handleBrokerTour}
        onViewOpenHouses={handleViewOpenHouses}
        onMatches={handleMatches}
        onSocialShare={handleSocialShare}
        onStats={handleStats}
      />

      {/* Open House Dialog */}
      <OpenHouseDialog
        open={!!openHouseListing}
        onOpenChange={(open) => !open && handleOpenHouseClose()}
        listing={openHouseListing ? {
          id: openHouseListing.id,
          addressLine1: openHouseListing.address,
          city: openHouseListing.city,
          state: openHouseListing.state,
          zip: openHouseListing.zip_code,
          mlsNumber: openHouseListing.listing_number
        } : null}
        onSaved={handleOpenHouseClose}
      />

      {/* Broker Tour Dialog */}
      <OpenHouseDialog
        open={!!brokerTourListing}
        onOpenChange={(open) => !open && handleOpenHouseClose()}
        listing={brokerTourListing ? {
          id: brokerTourListing.id,
          addressLine1: brokerTourListing.address,
          city: brokerTourListing.city,
          state: brokerTourListing.state,
          zip: brokerTourListing.zip_code,
          mlsNumber: brokerTourListing.listing_number
        } : null}
        onSaved={handleOpenHouseClose}
        eventTypePreset="broker_tour"
      />

      {/* View Open Houses Dialog */}
      <ViewOpenHousesDialog
        open={!!viewOpenHousesListing}
        onOpenChange={(open) => !open && setViewOpenHousesListing(null)}
        listing={viewOpenHousesListing ? {
          id: viewOpenHousesListing.id,
          addressLine1: viewOpenHousesListing.address,
          city: viewOpenHousesListing.city,
          state: viewOpenHousesListing.state,
          zip: viewOpenHousesListing.zip_code,
          mlsNumber: viewOpenHousesListing.listing_number
        } : null}
        onDeleted={fetchListings}
      />

      {/* Matches Dialog */}
      <ReverseProspectDialog
        open={!!matchesListing}
        onOpenChange={(open) => !open && setMatchesListing(null)}
        listing={matchesListing ? {
          id: matchesListing.id,
          address: matchesListing.address,
          city: matchesListing.city,
          state: matchesListing.state,
          price: matchesListing.price,
          property_type: matchesListing.property_type || null,
          bedrooms: matchesListing.bedrooms || null,
          bathrooms: matchesListing.bathrooms || null,
          square_feet: matchesListing.square_feet || null
        } : null}
        matchCount={matchesListing?.hot_sheet_matches ?? 0}
      />

      {/* Social Share Dialog */}
      {socialShareListing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSocialShareListing(null)}>
          <div className="bg-background p-6 rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Share Listing</h3>
            <SocialShareMenu
              url={getListingShareUrl(socialShareListing.id)}
              title={`${socialShareListing.address}, ${socialShareListing.city} - $${socialShareListing.price.toLocaleString()}`}
              description={`Check out this property listing`}
              listingId={socialShareListing.id}
            />
          </div>
        </div>
      )}
      </main>
    </div>
  );
};

export default MyListings;

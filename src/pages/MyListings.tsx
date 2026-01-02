import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import Navigation from "@/components/Navigation";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Grid, List as ListIcon, Plus, BarChart3, ChevronDown, Lock, Sparkles, Home, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { OpenHouseDialog } from "@/components/OpenHouseDialog";
import { ViewOpenHousesDialog } from "@/components/ViewOpenHousesDialog";
import { ReverseProspectDialog } from "@/components/ReverseProspectDialog";
import SocialShareMenu from "@/components/SocialShareMenu";
import { EmailShareModal } from "@/components/EmailShareModal";
import { getListingPublicUrl, getListingShareUrl } from "@/lib/getPublicUrl";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/ui/page-header";
type ListingStatus = "new" | "active" | "pending" | "sold" | "withdrawn" | "expired" | "cancelled" | "draft" | "coming_soon" | "off_market";

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
  unit_number?: string | null;
  listing_stats?: {
    view_count: number;
    save_count: number;
    share_count: number;
    contact_count: number;
    showing_request_count: number;
  };
}

// Row 1: Primary statuses
const STATUS_ROW_1: { label: string; value: ListingStatus }[] = [
  { label: "Off-Market", value: "off_market" },
  { label: "Coming Soon", value: "coming_soon" },
  { label: "New", value: "new" },
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Sold", value: "sold" },
  { label: "Draft", value: "draft" },
];

// Row 2: Secondary statuses
const STATUS_ROW_2: { label: string; value: ListingStatus }[] = [
  { label: "Withdrawn", value: "withdrawn" },
  { label: "Expired", value: "expired" },
  { label: "Cancelled", value: "cancelled" },
];

const ALL_STATUSES = [...STATUS_ROW_1, ...STATUS_ROW_2];

function statusBadgeClass(status: string) {
  switch (status) {
    case "active":
    case "new":
      return "bg-emerald-100 text-emerald-700";
    case "coming_soon":
      return "bg-amber-100 text-amber-700";
    case "pending":
      return "bg-blue-100 text-blue-700";
    case "sold":
      return "bg-purple-100 text-purple-700";
    case "off_market":
      return "bg-muted text-muted-foreground";
    case "draft":
      return "bg-neutral-100 text-neutral-500";
    case "withdrawn":
    case "expired":
    case "cancelled":
      return "bg-red-100 text-red-600";
    default:
      return "bg-neutral-100 text-neutral-500";
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

// Helper for Title Case
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Format address with unit number for condos
function formatAddressWithUnit(listing: Listing): string {
  const baseAddress = toTitleCase(listing.address || "");
  const unit = listing.unit_number;
  const city = toTitleCase(listing.city || "");
  
  if (unit && unit.trim()) {
    // Format: "16 N Mead St #401, Charlestown"
    return `${baseAddress} #${unit.replace(/^#/, '')}, ${city}`;
  }
  return `${baseAddress}, ${city}`;
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
  onEmail,
  onStats,
}: {
  listings: Listing[];
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
  onShare: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onBulkDeleteDrafts: (ids: string[]) => Promise<void>;
  onNewListing: (status?: string) => void;
  onQuickUpdate: (id: string, updates: Partial<Pick<Listing, "price" | "status">>) => Promise<void>;
  onPhotos: (id: string) => void;
  onOpenHouse: (listing: Listing) => void;
  onBrokerTour: (listing: Listing) => void;
  onViewOpenHouses: (listing: Listing) => void;
  onMatches: (listing: Listing) => void;
  onSocialShare: (listing: Listing) => void;
  onEmail: (listing: Listing) => void;
  onStats: (id: string) => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFromUrl = searchParams.get("status");
  
  // Multi-select: parse comma-separated statuses from URL
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ListingStatus>>(() => {
    if (!statusFromUrl) return new Set();
    return new Set(statusFromUrl.split(",").filter(s => ALL_STATUSES.some(t => t.value === s)) as ListingStatus[]);
  });
  const [view, setView] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Sync URL param with state for multi-select
  const toggleStatus = (status: ListingStatus) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      // Update URL
      if (next.size > 0) {
        setSearchParams({ status: Array.from(next).join(",") });
      } else {
        setSearchParams({});
      }
      return next;
    });
  };

  const clearStatusFilters = () => {
    setSelectedStatuses(new Set());
    setSearchParams({});
  };

  // Quick edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number | "">("");
  const [editStatus, setEditStatus] = useState<ListingStatus | "">("");

  // Bulk draft deletion state
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Single listing deletion state
  const [listingToDelete, setListingToDelete] = useState<Listing | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

  // Get draft listings for bulk selection
  const draftListings = useMemo(() => listings.filter(l => l.status === "draft"), [listings]);

  // Clear selection when switching away from draft filter
  useEffect(() => {
    if (!selectedStatuses.has("draft")) {
      setSelectedDraftIds(new Set());
    }
  }, [selectedStatuses]);

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

  // Single listing delete handler
  const handleConfirmSingleDelete = async () => {
    if (!listingToDelete) return;
    setIsDeletingSingle(true);
    try {
      await onDelete(listingToDelete.id);
    } finally {
      setIsDeletingSingle(false);
      setListingToDelete(null);
    }
  };

  const filteredListings = useMemo(() => {
    let result = selectedStatuses.size === 0 
      ? listings 
      : listings.filter((l) => selectedStatuses.has(l.status as ListingStatus));
    
    // Apply search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((l) => 
        l.address?.toLowerCase().includes(q) ||
        l.city?.toLowerCase().includes(q) ||
        l.listing_number?.toLowerCase().includes(q) ||
        l.neighborhood?.toLowerCase().includes(q)
      );
    }
    
    // Sort newest first
    result.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
    return result;
  }, [listings, selectedStatuses, searchQuery]);

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
    <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <PageHeader
        title="My Listings"
        subtitle="Manage your active, pending, and past listings from one place."
        className="mb-6"
      />

      {/* New Listing Button Row */}
      <div className="mb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Listing
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => onNewListing("new")} className="cursor-pointer">
              <Home className="h-4 w-4 mr-2 text-muted-foreground" />
              <div>
                <div className="font-medium">New (Active)</div>
                <div className="text-xs text-muted-foreground">Ready to go live on market</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNewListing("off_market")} className="cursor-pointer">
              <Lock className="h-4 w-4 mr-2 text-muted-foreground" />
              <div>
                <div className="font-medium">Off-Market (Private)</div>
                <div className="text-xs text-muted-foreground">Private listing for agents only</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNewListing("coming_soon")} className="cursor-pointer">
              <Sparkles className="h-4 w-4 mr-2 text-muted-foreground" />
              <div>
                <div className="font-medium">Coming Soon</div>
                <div className="text-xs text-muted-foreground">Pre-market announcement</div>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Premium Filter Bar */}
      <div>
        <div className="flex items-center gap-3">
          {/* Status pills (single row, horizontal scroll) */}
          <div className="flex-1 overflow-x-auto scrollbar-none">
            <div className="flex flex-nowrap gap-2 whitespace-nowrap">
              {ALL_STATUSES.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => toggleStatus(tab.value)}
                  className={`shrink-0 text-sm px-3 py-1.5 rounded-full font-medium transition-colors border ${
                    selectedStatuses.has(tab.value)
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right side: Clear + Sort + View toggle */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Clear link */}
            {selectedStatuses.size > 0 && (
              <button
                onClick={clearStatusFilters}
                className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
              >
                Clear
              </button>
            )}

            {/* Sort dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-800 border border-zinc-200 bg-white rounded-lg px-3 py-1.5 transition-colors">
                  Sort
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem className="cursor-pointer text-sm">Date (Newest)</DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer text-sm">DOM</DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer text-sm">Price</DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer text-sm">Status</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View toggle */}
            <div className="inline-flex items-center border border-zinc-200 rounded-lg p-0.5 bg-white">
              <button
                onClick={() => setView("grid")}
                className={`p-1.5 rounded-md transition-colors ${
                  view === "grid" ? "bg-zinc-100 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-zinc-50"
                }`}
              >
                <Grid size={16} />
              </button>
              <button
                onClick={() => setView("list")}
                className={`p-1.5 rounded-md transition-colors ${
                  view === "list" ? "bg-zinc-100 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-zinc-50"
                }`}
              >
                <ListIcon size={16} />
              </button>
            </div>
          </div>
        </div>
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

      {/* Single Listing Delete Confirmation Dialog */}
      <AlertDialog open={!!listingToDelete} onOpenChange={(open) => !open && setListingToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this listing? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSingle}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSingleDelete}
              disabled={isDeletingSingle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingSingle ? "Deleting..." : "Delete listing"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Select All Drafts Row - only visible on Draft tab */}
      {selectedStatuses.has("draft") && selectedStatuses.size === 1 && draftListings.length > 0 && (
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
            <Button
              variant="destructive"
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={isDeleting}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedDraftIds.size})
            </Button>
          )}
        </div>
      )}

      {/* GRID VIEW */}
      {view === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredListings.map((l) => {
            const thumbnail = getThumbnailUrl(l);
            return (
              <div
                key={l.id}
                className="aac-card aac-card-2 overflow-hidden"
              >
                <div className="w-full h-48 bg-neutral-soft overflow-hidden cursor-pointer" onClick={() => onPreview(l.id)}>
                  <img src={thumbnail || "/placeholder.svg"} alt={l.address} className="w-full h-full object-cover" />
                </div>

                <div className="p-4">
                  {/* Address */}
                  <div className="font-semibold text-base text-foreground">
                    {formatAddressWithUnit(l)}
                  </div>
                  {/* Location - secondary */}
                  <div className="text-muted-foreground text-sm mt-0.5">
                    {l.state} {l.zip_code}
                  </div>
                  {/* Status + Listing # as secondary metadata */}
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${statusBadgeClass(l.status)}`}
                    >
                      {l.status.replace("_", " ")}
                    </span>
                    {l.listing_number && (
                      <span className="text-xs text-muted-foreground">#{l.listing_number}</span>
                    )}
                  </div>
                  {/* Price */}
                  <div className="text-muted-foreground text-sm mt-2 font-medium">${l.price.toLocaleString()}</div>

                  {/* Action text links - matching list view */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <button
                      className="text-zinc-600 hover:text-emerald-700 transition"
                      onClick={() => onEdit(l.id)}
                    >
                      Edit
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="text-zinc-600 hover:text-emerald-700 transition"
                      onClick={() => onPreview(l.id)}
                    >
                      View
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="text-zinc-600 hover:text-emerald-700 transition"
                      onClick={() => onShare(l.id)}
                    >
                      Share
                    </button>
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
        <div className="space-y-4">
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
            
            // Calculate Days on Market
            const listDateObj = l.list_date ? new Date(l.list_date) : l.created_at ? new Date(l.created_at) : null;
            const dom = listDateObj ? Math.max(0, Math.floor((Date.now() - listDateObj.getTime()) / (1000 * 60 * 60 * 24))) : 0;

            return (
              <div
                key={l.id}
                className="aac-card aac-card-2 overflow-hidden"
              >
                {/* Top tools bar - text links, no icons */}
                <div className="flex items-start justify-between text-sm px-4 py-2.5 bg-white">
                  {/* Left: Action buttons */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      className="text-zinc-600 hover:text-emerald-700 transition"
                      onClick={() => onEdit(l.id)}
                    >
                      Edit
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="text-zinc-600 hover:text-emerald-700 transition"
                      onClick={() => onPhotos(l.id)}
                    >
                      Photos
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="text-zinc-600 hover:text-emerald-700 transition"
                      onClick={() => hasPublicOpenHouse ? onViewOpenHouses(l) : onOpenHouse(l)}
                    >
                      Open House
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="text-zinc-600 hover:text-emerald-700 transition"
                      onClick={() => hasBrokerTour ? onViewOpenHouses(l) : onBrokerTour(l)}
                    >
                      Broker Tour
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="text-zinc-600 hover:text-emerald-700 transition"
                      onClick={() => onMatches(l)}
                    >
                      Matches ({matchCount})
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="text-zinc-600 hover:text-emerald-700 transition"
                      onClick={() => onEmail?.(l)}
                    >
                      Email
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="text-zinc-600 hover:text-emerald-700 transition"
                      onClick={() => onSocialShare(l)}
                    >
                      Social
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="text-zinc-600 hover:text-emerald-700 transition"
                      onClick={() => onStats(l.id)}
                    >
                      Stats
                    </button>
                  </div>
                  
                  {/* Right: Status + Dates stack */}
                  <div className="flex flex-col items-end gap-0.5 shrink-0 text-xs">
                    <span className={`font-medium px-2 py-0.5 rounded-full capitalize ${statusBadgeClass(l.status)}`}>
                      {l.status.replace("_", " ")}
                    </span>
                    <span className="text-muted-foreground">List: {listDate}</span>
                    {expDate && <span className="text-muted-foreground">Exp: {expDate}</span>}
                    <span className="text-muted-foreground">DOM: {dom}</span>
                  </div>
                </div>

                {/* Main content section */}
                <div className="p-4 relative">
                  <div className="flex items-start gap-4">
                    {/* Checkbox for draft selection */}
                    {selectedStatuses.has("draft") && selectedStatuses.size === 1 && l.status === "draft" && (
                      <div className="shrink-0 pt-1">
                        <Checkbox
                          checked={selectedDraftIds.has(l.id)}
                          onCheckedChange={() => toggleDraftSelection(l.id)}
                        />
                      </div>
                    )}

                    {/* Thumbnail - larger, visual anchor */}
                    <div className="w-[140px] h-[105px] rounded-xl overflow-hidden bg-neutral-soft shrink-0 cursor-pointer">
                      <img
                        src={thumbnail || "/placeholder.svg"}
                        alt={l.address}
                        className="w-full h-full object-cover"
                        onClick={() => onPreview(l.id)}
                      />
                    </div>

                    {/* Main content column: Listing # → Address → Location + Neighborhood → Price */}
                    <div className="flex-1 min-w-0">
                      {/* Listing # - blue, clickable */}
                      {l.listing_number && (
                        <button 
                          className="text-xs text-primary hover:text-primary/80 hover:underline cursor-pointer leading-none"
                          onClick={() => onPreview(l.id)}
                        >
                          #{l.listing_number}
                        </button>
                      )}
                      {/* Address */}
                      <div className="font-semibold text-base text-foreground truncate leading-tight mt-0.5">
                        {formatAddressWithUnit(l)}
                      </div>
                      {/* Location + Neighborhood - secondary metadata */}
                      <div className="text-sm text-muted-foreground leading-tight mt-0.5">
                        {l.state} {l.zip_code}{l.neighborhood ? ` · ${l.neighborhood}` : ''}
                      </div>

                      {/* Price - left aligned under location */}
                      <div className="mt-2">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="border border-neutral-200 rounded px-2 py-1 text-sm w-28 bg-white"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value === "" ? "" : Number(e.target.value))}
                            />
                            <select
                              className="border border-neutral-200 rounded px-2 py-1 bg-white capitalize text-xs"
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value as ListingStatus)}
                            >
                              {ALL_STATUSES.map((tab) => (
                                <option key={tab.value} value={tab.value}>
                                  {tab.label}
                                </option>
                              ))}
                            </select>
                            <button
                              className="px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
                              onClick={saveQuickEdit}
                            >
                              Save
                            </button>
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                              onClick={cancelQuickEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">${l.price.toLocaleString()}</span>
                            <button
                              className="text-xs text-primary hover:text-primary/80 hover:underline"
                              onClick={() => startQuickEdit(l)}
                              title="Quick edit price and status"
                            >
                              Quick Edit
                            </button>
                          </div>
                        )}
                      </div>
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
  const [emailListing, setEmailListing] = useState<Listing | null>(null);

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
    try {
      const { error } = await supabase.from("listings").delete().eq("id", id);
      if (error) throw error;

      toast.success("Listing deleted successfully", {
        className: "bg-emerald-50 border-emerald-200 text-emerald-800",
      });
      fetchListings();
    } catch (error) {
      console.error("Error deleting listing:", error);
      toast.error("Failed to delete listing", {
        className: "bg-red-50 border-red-200 text-red-800",
      });
      throw error; // Re-throw so the dialog can handle it
    }
  };

  const handleNewListing = (status?: string) => {
    const url = status ? `/agent/listings/new?status=${status}` : "/agent/listings/new";
    navigate(url);
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

  const handleEmail = (listing: Listing) => {
    setEmailListing(listing);
  };

  const handleStats = (id: string) => {
    navigate(`/analytics/${id}`);
  };

  const handleBulkDeleteDrafts = async (ids: string[]) => {
    try {
      const { error } = await supabase.from("listings").delete().in("id", ids);
      if (error) throw error;
      
      toast.success(`Successfully deleted ${ids.length} draft listing(s)`, {
        className: "bg-emerald-50 border-emerald-200 text-emerald-800",
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
        <div className="flex-1 flex items-center justify-center p-6 pt-20">
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
      <div className="min-h-screen flex flex-col">
        <Navigation />
        
        <main className="flex-1 bg-background pt-20">
          <div className="container mx-auto px-4 py-8 max-w-5xl">
            <PageHeader
              title="My Listings"
              subtitle="Manage your active, pending, and past listings from one place."
              className="mb-8"
            />
            
            {/* Empty State - matches Hot Sheets pattern */}
            <div className="aac-card p-12 text-center">
              <Plus className="h-16 w-16 mx-auto mb-4 text-neutral-400" />
              <h3 className="text-xl font-semibold text-neutral-800 mb-2">No listings yet</h3>
              <p className="text-neutral-600 mb-6">
                Create your first listing to get started.
              </p>
              <Button 
                onClick={() => handleNewListing("new")} 
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Listing
              </Button>
            </div>
          </div>
        </main>
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
        onEmail={handleEmail}
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

      {/* Email Share Modal */}
      <EmailShareModal
        open={!!emailListing}
        onOpenChange={(open) => !open && setEmailListing(null)}
        listingUrl={emailListing ? getListingShareUrl(emailListing.id) : ""}
        listingAddress={emailListing ? `${emailListing.address}, ${emailListing.city}` : ""}
      />
      </main>
    </div>
  );
};

export default MyListings;

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import Navigation from "@/components/Navigation";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Grid, List as ListIcon, Plus, ChevronDown, Lock, Sparkles, Home, Search, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { OpenHouseDialog } from "@/components/OpenHouseDialog";
import { ViewOpenHousesDialog } from "@/components/ViewOpenHousesDialog";
import { ReverseProspectDialog } from "@/components/ReverseProspectDialog";
import { EmailShareModal } from "@/components/EmailShareModal";
import { getListingShareUrl } from "@/lib/getPublicUrl";
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

// Core status tabs shown directly
const CORE_STATUS_TABS: { label: string; value: ListingStatus }[] = [
  { label: "Active", value: "active" },
  { label: "Coming Soon", value: "coming_soon" },
  { label: "Pending", value: "pending" },
  { label: "Sold", value: "sold" },
  { label: "Draft", value: "draft" },
];

// Additional statuses under "More"
const MORE_STATUS_TABS: { label: string; value: ListingStatus }[] = [
  { label: "New", value: "new" },
  { label: "Off-Market", value: "off_market" },
  { label: "Withdrawn", value: "withdrawn" },
  { label: "Expired", value: "expired" },
  { label: "Cancelled", value: "cancelled" },
];

// Sort options
type SortOption = "dom_desc" | "dom_asc" | "price_desc" | "price_asc" | "date_desc" | "date_asc" | "status";
const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "DOM (High → Low)", value: "dom_desc" },
  { label: "DOM (Low → High)", value: "dom_asc" },
  { label: "Price (High → Low)", value: "price_desc" },
  { label: "Price (Low → High)", value: "price_asc" },
  { label: "Date (Newest)", value: "date_desc" },
  { label: "Date (Oldest)", value: "date_asc" },
  { label: "Status", value: "status" },
];

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
  onStats: (id: string) => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFromUrl = searchParams.get("status") as ListingStatus | null;
  
  const [activeStatus, setActiveStatus] = useState<ListingStatus | null>(statusFromUrl);
  const [view, setView] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Sync URL param with state
  const handleStatusChange = (status: ListingStatus | null) => {
    setActiveStatus(status);
    if (status) {
      setSearchParams({ status });
    } else {
      setSearchParams({});
    }
  };

  // Quick edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number | "">("");
  const [editStatus, setEditStatus] = useState<ListingStatus | "">("");
  
  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");

  // Bulk draft deletion state
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Single listing deletion state
  const [listingToDelete, setListingToDelete] = useState<Listing | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

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

  // Helper to calculate days on market
  const calculateDOM = (listing: Listing) => {
    const startDate = listing.active_date || listing.list_date || listing.created_at;
    if (!startDate) return 0;
    const start = new Date(startDate);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const filteredListings = useMemo(() => {
    let result = activeStatus === null 
      ? listings 
      : listings.filter((l) => l.status === activeStatus);
    
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
    
    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case "dom_desc":
          return calculateDOM(b) - calculateDOM(a);
        case "dom_asc":
          return calculateDOM(a) - calculateDOM(b);
        case "price_desc":
          return (b.price || 0) - (a.price || 0);
        case "price_asc":
          return (a.price || 0) - (b.price || 0);
        case "date_desc":
          return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
        case "date_asc":
          return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
        case "status":
          return a.status.localeCompare(b.status);
        default:
          return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      }
    });
    
    return result;
  }, [listings, activeStatus, searchQuery, sortBy]);

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

  // All status tabs combined for the quick edit dropdown
  const ALL_STATUS_TABS = [...CORE_STATUS_TABS, ...MORE_STATUS_TABS];

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

      {/* Quick Search + Status Filters + View Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Quick Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by address or AAC #"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* All pill - show all listings */}
          <button
            onClick={() => handleStatusChange(null)}
            className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
              activeStatus === null
                ? "bg-neutral-soft text-foreground border-neutral-200"
                : "bg-white border-neutral-200 text-muted-foreground hover:text-foreground hover:bg-neutral-soft"
            }`}
          >
            All
          </button>
          
          {/* Core status filter pills */}
          {CORE_STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleStatusChange(activeStatus === tab.value ? null : tab.value)}
              className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
                activeStatus === tab.value
                  ? "bg-neutral-soft text-foreground border-neutral-200"
                  : "bg-white border-neutral-200 text-muted-foreground hover:text-foreground hover:bg-neutral-soft"
              }`}
            >
              {tab.label}
            </button>
          ))}
          
          {/* More dropdown for additional statuses */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                  MORE_STATUS_TABS.some(tab => tab.value === activeStatus)
                    ? "bg-neutral-soft text-foreground border-neutral-200"
                    : "bg-white border-neutral-200 text-muted-foreground hover:text-foreground hover:bg-neutral-soft"
                }`}
              >
                <MoreHorizontal className="h-4 w-4" />
                More
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {MORE_STATUS_TABS.map((tab) => (
                <DropdownMenuItem
                  key={tab.value}
                  onClick={() => handleStatusChange(activeStatus === tab.value ? null : tab.value)}
                  className={activeStatus === tab.value ? "bg-neutral-soft" : ""}
                >
                  {tab.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Sort dropdown */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div className="inline-flex items-center border border-neutral-200 rounded-lg p-0.5 bg-white">
            <button
              onClick={() => setView("grid")}
              className={`p-1.5 rounded-md transition-colors ${
                view === "grid" ? "bg-neutral-soft text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-neutral-soft"
              }`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-1.5 rounded-md transition-colors ${
                view === "list" ? "bg-neutral-soft text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-neutral-soft"
              }`}
            >
              <ListIcon size={16} />
            </button>
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
            <Button
              variant="destructive"
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={isDeleting}
              className="gap-2"
            >
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
            const matchCount = l.hot_sheet_matches ?? 0;
            const listDate = formatDate(l.list_date) || formatDate(l.created_at);
            const expDate = formatDate(l.expiration_date);
            const dom = calculateDOM(l);
            return (
              <div
                key={l.id}
                className="bg-white border border-zinc-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Photo */}
                <div className="w-full h-44 bg-zinc-100 overflow-hidden cursor-pointer" onClick={() => onPreview(l.id)}>
                  <img src={thumbnail || "/placeholder.svg"} alt={l.address} className="w-full h-full object-cover" />
                </div>

                <div className="p-4">
                  {/* Address */}
                  <div className="font-semibold text-foreground truncate">
                    {formatAddressWithUnit(l)}
                  </div>
                  {/* Location */}
                  <div className="text-zinc-500 text-sm mt-0.5">
                    {l.city}, {l.state} {l.zip_code}
                  </div>
                  {/* Price */}
                  <div className="text-lg font-semibold mt-2">
                    ${l.price.toLocaleString()}
                  </div>

                  {/* Status badge + Timeline metadata */}
                  <div className="flex items-start justify-between mt-3 gap-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize shrink-0 ${statusBadgeClass(l.status)}`}>
                      {l.status.replace("_", " ")}
                    </span>
                    <div className="text-right text-xs text-zinc-500 leading-relaxed">
                      <div>List: {listDate}</div>
                      {expDate && <div>Exp: {expDate}</div>}
                      <div className="font-medium text-zinc-700">DOM: {dom}</div>
                    </div>
                  </div>

                  {/* Text action bar */}
                  <div className="flex items-center flex-wrap gap-x-1 gap-y-1 mt-4 text-xs text-zinc-600">
                    <button onClick={() => onEdit(l.id)} className="hover:text-emerald-700 transition">Edit</button>
                    <span className="text-zinc-300">•</span>
                    <button onClick={() => onSocialShare(l)} className="hover:text-emerald-700 transition">Email</button>
                    <span className="text-zinc-300">•</span>
                    <button onClick={() => onPreview(l.id)} className="hover:text-emerald-700 transition">View</button>
                    <span className="text-zinc-300">•</span>
                    <button onClick={() => onStats(l.id)} className="hover:text-emerald-700 transition">Stats</button>
                    <span className="text-zinc-300">•</span>
                    <button onClick={() => onMatches(l)} className="hover:text-emerald-700 transition">Matches ({matchCount})</button>
                    <span className="text-zinc-300">•</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="hover:text-emerald-700 transition inline-flex items-center gap-0.5">
                            More <ChevronDown className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 bg-white border border-zinc-200 shadow-lg">
                          <DropdownMenuItem onClick={() => onPhotos(l.id)}>Photos</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onOpenHouse(l)}>Open House</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onBrokerTour(l)}>Broker Tour</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            navigator.clipboard.writeText(getListingShareUrl(l.id));
                            toast.success("Link copied!");
                          }}>Copy Link</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onShare(l.id)}>Duplicate</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setListingToDelete(l)}
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredListings.length === 0 && (
            <div className="col-span-full text-center text-zinc-500 text-sm py-10">
              No listings match your filters yet.
            </div>
          )}
        </div>
      )}

      {/* LIST VIEW – Compact listing rows with text action bar */}
      {view === "list" && (
        <div className="space-y-3">
          {filteredListings.map((l) => {
            const thumbnail = getThumbnailUrl(l);
            const isEditing = editingId === l.id;
            const matchCount = l.hot_sheet_matches ?? 0;
            const listDate = formatDate(l.list_date) || formatDate(l.created_at);
            const expDate = formatDate(l.expiration_date);
            const dom = calculateDOM(l);

            return (
              <div
                key={l.id}
                className="bg-white border border-zinc-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4 p-4">
                  {/* Checkbox for draft selection */}
                  {activeStatus === "draft" && l.status === "draft" && (
                    <div className="shrink-0 pt-2">
                      <Checkbox
                        checked={selectedDraftIds.has(l.id)}
                        onCheckedChange={() => toggleDraftSelection(l.id)}
                      />
                    </div>
                  )}

                  {/* Thumbnail */}
                  <div className="w-32 h-24 rounded-lg overflow-hidden bg-zinc-100 shrink-0 cursor-pointer" onClick={() => onPreview(l.id)}>
                    <img
                      src={thumbnail || "/placeholder.svg"}
                      alt={l.address}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    {/* Top row: Address + Price | Status + Timeline */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        {l.listing_number && (
                          <button 
                            className="text-xs text-primary hover:text-primary/80 hover:underline cursor-pointer"
                            onClick={() => onPreview(l.id)}
                          >
                            #{l.listing_number}
                          </button>
                        )}
                        <div className="font-semibold text-foreground truncate">
                          {formatAddressWithUnit(l)}
                        </div>
                        <div className="text-sm text-zinc-500">
                          {l.city}, {l.state} {l.zip_code}
                        </div>
                        
                        {/* Price row */}
                        <div className="mt-2">
                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                type="number"
                                className="border border-zinc-200 rounded px-2 py-1 text-sm w-28 bg-white"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value === "" ? "" : Number(e.target.value))}
                              />
                              <select
                                className="border border-zinc-200 rounded px-2 py-1 bg-white capitalize text-sm"
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value as ListingStatus)}
                              >
                                {ALL_STATUS_TABS.map((tab) => (
                                  <option key={tab.value} value={tab.value}>
                                    {tab.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                className="px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
                                onClick={saveQuickEdit}
                              >
                                Save
                              </button>
                              <button
                                className="text-sm text-zinc-500 hover:text-foreground hover:underline"
                                onClick={cancelQuickEdit}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-lg font-semibold">${l.price.toLocaleString()}</span>
                          )}
                        </div>
                      </div>

                      {/* Right side: Status + Timeline */}
                      <div className="text-right shrink-0">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize inline-block ${statusBadgeClass(l.status)}`}>
                          {l.status.replace("_", " ")}
                        </span>
                        <div className="mt-2 text-xs text-zinc-500 leading-relaxed">
                          <div>List: {listDate}</div>
                          {expDate && <div>Exp: {expDate}</div>}
                          <div className="font-medium text-zinc-700">DOM: {dom}</div>
                        </div>
                      </div>
                    </div>

                    {/* Text action bar */}
                    <div className="flex items-center flex-wrap gap-x-1.5 gap-y-1 mt-3 text-sm text-zinc-600">
                      <button onClick={() => onEdit(l.id)} className="hover:text-emerald-700 transition">Edit</button>
                      <span className="text-zinc-300">•</span>
                      <button onClick={() => onSocialShare(l)} className="hover:text-emerald-700 transition">Email</button>
                      <span className="text-zinc-300">•</span>
                      <button onClick={() => onPreview(l.id)} className="hover:text-emerald-700 transition">View</button>
                      <span className="text-zinc-300">•</span>
                      <button onClick={() => onStats(l.id)} className="hover:text-emerald-700 transition">Stats</button>
                      <span className="text-zinc-300">•</span>
                      <button onClick={() => onMatches(l)} className="hover:text-emerald-700 transition">Matches ({matchCount})</button>
                      <span className="text-zinc-300">•</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="hover:text-emerald-700 transition inline-flex items-center gap-0.5">
                            More <ChevronDown className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 bg-white border border-zinc-200 shadow-lg">
                          <DropdownMenuItem onClick={() => onPhotos(l.id)}>Photos</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onOpenHouse(l)}>Open House</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onBrokerTour(l)}>Broker Tour</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            navigator.clipboard.writeText(getListingShareUrl(l.id));
                            toast.success("Link copied!");
                          }}>Copy Link</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onShare(l.id)}>Duplicate</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setListingToDelete(l)}
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredListings.length === 0 && (
            <div className="text-center text-zinc-500 text-sm py-10">No listings match your filters yet.</div>
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

      {/* Email Share Modal */}
      <EmailShareModal
        open={!!socialShareListing}
        onOpenChange={(open) => !open && setSocialShareListing(null)}
        listingUrl={socialShareListing ? getListingShareUrl(socialShareListing.id) : ""}
        listingAddress={socialShareListing ? `${socialShareListing.address}, ${socialShareListing.city}` : ""}
      />
      </main>
    </div>
  );
};

export default MyListings;

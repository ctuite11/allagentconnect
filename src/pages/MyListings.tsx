import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";

import PageShell from "@/components/layout/PageShell";
import { CardSurface } from "@/components/ui/CardSurface";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Grid, List as ListIcon, Plus, BarChart3, ChevronDown, Search, Trash2, FileText, MoreHorizontal } from "lucide-react";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import { LISTING_STATUS_LABELS, LISTING_TYPE_LABELS, getStatusConfig, isComingSoon } from "@/constants/status";

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
type ListingStatus = "new" | "active" | "coming_soon" | "off_market" | "back_on_market" | "temporarily_withdrawn" | "cancelled";

// Single source of truth for the active pipeline statuses
const PIPELINE_STATUSES: ListingStatus[] = ["active", "new", "coming_soon", "off_market", "back_on_market", "temporarily_withdrawn", "cancelled"];

interface Listing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  status: string;
  listing_number: string;
  listing_type?: string | null;
  photos: any;
  open_houses?: any;
  created_at: string;
  active_date: string | null;
  list_date?: string | null;
  expiration_date?: string | null;
  go_live_date?: string | null;
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

// Status filter options restricted to active pipeline
const ALL_STATUSES: { label: string; value: ListingStatus }[] = PIPELINE_STATUSES.map(s => ({
  label: s === "off_market" ? "Private" : (LISTING_STATUS_LABELS[s] || s),
  value: s,
}));

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
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
  }
  return d.toLocaleDateString();
}

// Format open house/broker tour event for inline display
function formatOpenHouseEvent(openHouse: any): { isBrokerTour: boolean; dateLabel: string; timeLabel: string } {
  const date = new Date(openHouse.date);
  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
  const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  
  const formatTime = (time: string) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };
  
  return {
    isBrokerTour: openHouse.event_type === "broker_tour",
    dateLabel: `${dayName}, ${monthDay}`,
    timeLabel: `${formatTime(openHouse.start_time)} - ${formatTime(openHouse.end_time)}`
  };
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
  onDeleteOpenHouse,
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
  onDeleteOpenHouse: (listingId: string, eventIndex: number) => void;
  onMatches: (listing: Listing) => void;
  onSocialShare: (listing: Listing) => void;
  onEmail: (listing: Listing) => void;
  onStats: (id: string) => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
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

  // Draft listings won't appear (filtered server-side), but keep state for type compat
  const draftListings = useMemo(() => listings.filter(l => l.status === "draft"), [listings]);

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
    <>
      {/* Header */}
      <PageHeader
        title="My Listings"
        subtitle="Manage your active, pending, and past listings from one place."
        backTo="/agent-dashboard"
      />

      {/* New Listing Button Row */}
      <div className="mb-4 flex items-center gap-3">
        <Button 
          onClick={() => onNewListing("new")} 
          className="gap-2 bg-black hover:bg-zinc-900 text-emerald-400 hover:text-emerald-300 font-display font-medium tracking-wide"
        >
          <Plus className="h-4 w-4" />
          New Listing
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate("/agent/listings/drafts")}
          className="gap-2 text-zinc-600"
        >
          <FileText className="h-4 w-4" />
          Drafts
        </Button>
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
                  view === "grid" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
                }`}
              >
                <Grid size={16} />
              </button>
              <button
                onClick={() => setView("list")}
                className={`p-1.5 rounded-md transition-colors ${
                  view === "list" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
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

      {/* Draft bulk-select removed — drafts filtered out server-side */}

      {/* GRID VIEW */}
      {view === "grid" && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredListings.map((l) => {
            const thumbnail = getThumbnailUrl(l);
            return (
              <CardSurface
                key={l.id}
                interactive
                className="cursor-pointer"
              >
              <div className="w-full h-48 bg-zinc-100 overflow-hidden cursor-pointer" onClick={() => onPreview(l.id)}>
                <img src={thumbnail || "/placeholder.svg"} alt={l.address} className="w-full h-full object-cover" />
              </div>

              <div className="p-4">
                {/* Address */}
                <div className="font-semibold text-base text-zinc-900">
                  {formatAddressWithUnit(l)}
                </div>
                {/* Location - secondary */}
                <div className="text-zinc-500 text-sm mt-0.5">
                  {l.state} {l.zip_code}
                </div>
                {/* Status + Listing # as secondary metadata */}
                <div className="flex items-center gap-2 mt-2">
                  <ListingStatusBadge status={l.status} size="sm" />
                  {l.listing_type && (
                    <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                      {LISTING_TYPE_LABELS[l.listing_type] || l.listing_type}
                    </span>
                  )}
                  {l.listing_number && (
                    <span className="text-xs text-zinc-500">#{l.listing_number}</span>
                  )}
                </div>
                {/* Price */}
                <div className="text-zinc-600 text-sm mt-2 font-medium">${l.price.toLocaleString()}</div>

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
            </CardSurface>
          );
        })}

        {filteredListings.length === 0 && (
          <div className="col-span-full text-center text-zinc-500 text-sm py-10">
            No listings match your filters yet.
          </div>
        )}
        </div>
      )}

      {/* LIST VIEW – with MLS-style quick tools + quick edit */}
      {/* LIST VIEW – MLS-style tools + quick edit near price/status */}
      {/* LIST VIEW – MLS-style tools + quick edit near price/status */}
      {view === "list" && (
        <div className="mt-6 space-y-4">
          {filteredListings.map((l) => {
            const thumbnail = getThumbnailUrl(l);
            const isEditing = editingId === l.id;
            const matchCount = l.hot_sheet_matches ?? 0;
            const views = l.listing_stats?.view_count ?? 0;
            const favorites = l.listing_stats?.save_count ?? 0;
            const shares = l.listing_stats?.share_count ?? 0;
            const listDate = formatDate(l.list_date) || formatDate(l.created_at);
            const expDate = formatDate(l.expiration_date);
            const goLiveDate = formatDate(l.go_live_date);
            // Filter out past events for toolbar button logic
            const nowForToolbar = new Date();
            const upcomingEvents = Array.isArray(l.open_houses) 
              ? (l.open_houses as any[]).filter((e: any) => {
                  if (!e?.date || !e?.end_time) return true;
                  return new Date(`${e.date}T${e.end_time}`) > nowForToolbar;
                })
              : [];
            const hasOpenHouses = upcomingEvents.length > 0;
            const hasPublicOpenHouse = upcomingEvents.some((oh: any) => oh.event_type === "in_person");
            const hasBrokerTour = upcomingEvents.some((oh: any) => oh.event_type === "broker_tour");
            
            // Calculate Days on Market
            const listDateObj = l.list_date ? new Date(l.list_date) : l.created_at ? new Date(l.created_at) : null;
            const dom = listDateObj ? Math.max(0, Math.floor((Date.now() - listDateObj.getTime()) / (1000 * 60 * 60 * 24))) : 0;

            return (
              <CardSurface
                key={l.id}
                className="relative p-4"
              >
                {/* Action row - tight, no vertical padding */}
                <div className="mb-3 flex justify-between items-start">
                  <div className="flex items-center gap-2 text-sm leading-tight text-zinc-600">
                    <button
                      className="hover:text-emerald-700 transition"
                      onClick={() => onEdit(l.id)}
                    >
                      Edit
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="hover:text-emerald-700 transition"
                      onClick={() => onPhotos(l.id)}
                    >
                      Photos
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="flex items-center gap-1 group"
                      onClick={() => hasPublicOpenHouse ? onViewOpenHouses(l) : onOpenHouse(l)}
                    >
                      <span aria-hidden>🎈</span>
                      <span className="group-hover:text-emerald-700 transition">Open House</span>
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="flex items-center gap-1 group"
                      onClick={() => hasBrokerTour ? onViewOpenHouses(l) : onBrokerTour(l)}
                    >
                      <span aria-hidden>🚙</span>
                      <span className="group-hover:text-[#0E56F5] transition">Broker Tour</span>
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="hover:text-emerald-700 transition"
                      onClick={() => onMatches(l)}
                    >
                      Matches ({matchCount})
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="hover:text-emerald-700 transition"
                      onClick={() => onEmail?.(l)}
                    >
                      Email
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="hover:text-emerald-700 transition"
                      onClick={() => onSocialShare(l)}
                    >
                      Social
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="hover:text-emerald-700 transition"
                      onClick={() => onStats(l.id)}
                    >
                      Stats
                    </button>
                  </div>
                  {/* Right side - quiet metadata + overflow */}
                   <div className="absolute top-4 right-4 text-right space-y-0.5">
                     <ListingStatusBadge status={l.status} size="sm" />
                      <div className="text-xs text-zinc-500 leading-tight">AAC List Date: {listDate}</div>
                    {isComingSoon(l.status) ? (
                      <>
                        {goLiveDate && <div className="text-xs text-zinc-500 leading-tight">On MLS Date: {goLiveDate}</div>}
                        {expDate && <div className="text-xs text-zinc-500 leading-tight">Exp: {expDate}</div>}
                      </>
                    ) : (
                      expDate && <div className="text-xs text-zinc-500 leading-tight">Exp: {expDate}</div>
                    )}
                    <div className="text-xs text-zinc-500 leading-tight">DOM: {dom}</div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="mt-1 p-1 rounded hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-zinc-600">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          className="cursor-pointer text-sm text-destructive focus:text-destructive"
                          onClick={() => setListingToDelete(l)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete Listing
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Content row - photo + info */}
                <div className="relative flex items-start gap-4">
                  {/* Photo - locked size */}
                  <div className="w-[140px] h-[100px] shrink-0 overflow-hidden rounded-xl bg-zinc-100 cursor-pointer">
                    <img
                      src={thumbnail || "/placeholder.svg"}
                      alt={l.address}
                      className="w-full h-full object-cover"
                      onClick={() => onPreview(l.id)}
                    />
                  </div>

                  {/* Center text stack */}
                   {/* Status badge moved to right column */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    {/* Listing # + Status inline */}
                    <div className="flex items-center gap-2">
                      {l.listing_number && (
                        <button 
                          className="text-xs text-primary hover:text-primary/80 hover:underline cursor-pointer leading-none"
                          onClick={() => onPreview(l.id)}
                        >
                          #{l.listing_number}
                        </button>
                      )}
                      {l.listing_type && (
                        <>
                          <span className="text-zinc-300">•</span>
                          <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                            {LISTING_TYPE_LABELS[l.listing_type] || l.listing_type}
                          </span>
                        </>
                      )}
                    </div>
                    {/* Address */}
                    <div className="font-semibold text-base text-zinc-900 truncate leading-tight">
                      {formatAddressWithUnit(l)}
                    </div>
                    {/* Location + Neighborhood */}
                    <div className="text-sm text-zinc-500 leading-tight">
                      {l.state} {l.zip_code}{l.neighborhood ? ` · ${l.neighborhood}` : ''}
                    </div>
                    {/* Price */}
                    <div className="mt-1">
                       {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="border border-zinc-200 rounded px-2 py-1 text-sm w-28 bg-white"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value === "" ? "" : Number(e.target.value))}
                            />
                            <select
                              className="border border-zinc-200 rounded px-2 py-1 bg-white capitalize text-xs"
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
                              className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline"
                              onClick={cancelQuickEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-medium text-zinc-900">${l.price.toLocaleString()}</span>
                              <button
                                className="text-xs text-primary hover:text-primary/80 hover:underline"
                                onClick={() => startQuickEdit(l)}
                                title="Quick edit price and status"
                              >
                                Quick Edit
                              </button>
                            </div>
                            <div className="w-8 shrink-0" />
                            {(() => {
                              const now = new Date();
                              const allEvents = Array.isArray(l.open_houses) ? (l.open_houses as any[]) : [];
                              // Filter out past events (safety net while backend cleans up every 15 min)
                              const events = allEvents.filter((e: any) => {
                                if (!e?.date || !e?.end_time) return true;
                                return new Date(`${e.date}T${e.end_time}`) > now;
                              });
                              const openHouseIndex = events.findIndex((e: any) => e?.event_type !== "broker_tour");
                              const openHouseEvent = openHouseIndex >= 0 ? events[openHouseIndex] : null;
                              const openHouseCount = events.filter((e: any) => e?.event_type !== "broker_tour").length;
                              const brokerTourIndex = events.findIndex((e: any) => e?.event_type === "broker_tour");
                              const brokerTourEvent = brokerTourIndex >= 0 ? events[brokerTourIndex] : null;
                              const brokerTourCount = events.filter((e: any) => e?.event_type === "broker_tour").length;
                              const hasEvents = openHouseEvent || brokerTourEvent;

                              if (!hasEvents) return null;

                              return (
                                <div className="min-w-0 space-y-0.5">
                                  {openHouseEvent && (() => {
                                    const first = formatOpenHouseEvent(openHouseEvent);
                                    return (
                                      <div className="flex items-center gap-1.5 text-sm text-zinc-600 min-w-0">
                                        <span aria-hidden className="shrink-0">🎈</span>
                                        <span className="truncate">Open House • {first.dateLabel} • {first.timeLabel}</span>
                                        {openHouseCount > 1 && (
                                          <span className="text-zinc-400 text-xs shrink-0">+{openHouseCount - 1} more</span>
                                        )}
                                        <button
                                          type="button"
                                          className="text-xs text-primary hover:text-primary/80 hover:underline ml-1 shrink-0"
                                          onClick={() => onViewOpenHouses(l)}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          className="text-xs text-red-600 hover:text-red-700 hover:underline shrink-0"
                                          onClick={() => onDeleteOpenHouse(l.id, openHouseIndex)}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    );
                                  })()}
                                  {brokerTourEvent && (() => {
                                    const first = formatOpenHouseEvent(brokerTourEvent);
                                    return (
                                      <div className="flex items-center gap-1.5 text-sm text-zinc-600 min-w-0">
                                        <span aria-hidden className="shrink-0">🚙</span>
                                        <span className="truncate">Broker Tour • {first.dateLabel} • {first.timeLabel}</span>
                                        {brokerTourCount > 1 && (
                                          <span className="text-zinc-400 text-xs shrink-0">+{brokerTourCount - 1} more</span>
                                        )}
                                        <button
                                          type="button"
                                          className="text-xs text-primary hover:text-primary/80 hover:underline ml-1 shrink-0"
                                          onClick={() => onViewOpenHouses(l)}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          className="text-xs text-red-600 hover:text-red-700 hover:underline shrink-0"
                                          onClick={() => onDeleteOpenHouse(l.id, brokerTourIndex)}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                     </div>
                  </div>

                </div>
              </CardSurface>
            );
          })}

          {filteredListings.length === 0 && (
            <div className="text-center text-zinc-500 text-sm py-10">No listings match your filters yet.</div>
          )}
        </div>
      )}
    </>
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
        .eq("agent_id", user.id)
        .in("status", PIPELINE_STATUSES);

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
    navigate(`/property/${id}`, { state: { from: '/agent/listings' } });
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

  const handleDeleteOpenHouse = async (listingId: string, eventIndex: number) => {
    if (!confirm("Delete this scheduled event?")) return;
    
    const listing = listings.find(l => l.id === listingId);
    if (!listing) return;
    
    const updatedOpenHouses = (listing.open_houses as any[]).filter((_, i) => i !== eventIndex);
    
    const { error } = await supabase
      .from("listings")
      .update({ open_houses: updatedOpenHouses })
      .eq("id", listingId);
      
    if (error) {
      toast.error("Failed to delete event");
      return;
    }
    
    toast.success("Event deleted");
    fetchListings();
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
      <div className="min-h-screen flex flex-col bg-background pt-20">
        <div className="flex-1 flex items-center justify-center p-6">
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
      <PageShell className="pb-8">
        <PageHeader
          title="My Listings"
          subtitle="Create your first listing to get started."
          backTo="/agent-dashboard"
        />
        
        {/* Empty State - matches Hot Sheets pattern */}
        <div className="aac-card p-12 text-center">
          <Plus className="h-16 w-16 mx-auto mb-4 text-zinc-400" />
          <h3 className="text-xl font-semibold text-zinc-800 mb-2">No listings yet</h3>
          <p className="text-zinc-600 mb-6">
            Create your first listing to get started.
          </p>
          <Button 
            onClick={() => handleNewListing("new")} 
            className="bg-black hover:bg-zinc-900 text-emerald-400 hover:text-emerald-300 font-display font-medium tracking-wide"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Listing
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className="pb-8">
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
        onDeleteOpenHouse={handleDeleteOpenHouse}
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
        agentCount={0}
        buyerCount={matchesListing?.hot_sheet_matches ?? 0}
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
      </PageShell>
  );
};

export default MyListings;

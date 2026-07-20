import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";

import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { AacBackLink } from "@/components/layout/AacBackLink";
import { AacPageIntro } from "@/components/layout/AacPageIntro";
import { AgentPageHeader } from "@/components/layout/AgentPageHeader";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";
import { CardSurface } from "@/components/ui/CardSurface";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ChevronDown, Search, Trash2, MoreHorizontal, Home } from "lucide-react";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import { LISTING_STATUS_LABELS, LISTING_TYPE, LISTING_TYPE_LABELS, isComingSoon } from "@/constants/status";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { OpenHouseDialog } from "@/components/OpenHouseDialog";
import { ViewOpenHousesDialog } from "@/components/ViewOpenHousesDialog";
import { ReverseProspectDialog } from "@/components/ReverseProspectDialog";
import SocialShareMenu from "@/components/SocialShareMenu";
import { Seo } from "@/components/Seo";
import { EmailShareModal } from "@/components/EmailShareModal";
import { getListingPublicUrl, getListingShareUrl } from "@/lib/getPublicUrl";
import { formatListingEmailSubjectLocation } from "@/lib/listingEmailSubject";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatListingPriceDisplay, formatUsdWholeForInput, listingEffectiveNumericPrice, parseUsdWholeInput } from "@/lib/formatListingPriceDisplay";
import {
  isDraftListingStatus,
  listingHasValidPricing,
  listingMissingPricingMessage,
  listingSatisfiesPricingRule,
} from "@/lib/listingPricingValidation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
type ListingStatus = "new" | "active" | "coming_soon" | "off_market" | "temporarily_withdrawn" | "cancelled" | "draft" | "expired";

// Managed statuses for My Listings controls (intentionally excludes BOM).
const PIPELINE_STATUSES: ListingStatus[] = ["active", "new", "coming_soon", "off_market", "temporarily_withdrawn", "cancelled", "expired", "draft"];
// Keep legacy BOM rows visible in My Listings without exposing BOM as a managed status option.
const FETCH_STATUSES = [...PIPELINE_STATUSES, "back_on_market"];

interface Listing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  price_range_min?: number | null;
  price_range_max?: number | null;
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

type MyListingsCache = {
  userId: string;
  listings: Listing[];
  updatedAt: number;
};

let myListingsCache: MyListingsCache | null = null;
const MY_LISTINGS_SCROLL_KEY = "myListings:scrollY";

// Status filter options restricted to active pipeline
const ALL_STATUSES: { label: string; value: ListingStatus }[] = PIPELINE_STATUSES.map(s => ({
  label: s === "draft" ? "Drafts" : (LISTING_STATUS_LABELS[s] || s),
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

const SUCCESS_HUB_PATH = "/agent-dashboard";

type MyListingsListingType = typeof LISTING_TYPE.FOR_SALE | typeof LISTING_TYPE.FOR_RENT;

function MyListingsNewListingButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className="h-9 gap-1.5 rounded-lg bg-neutral-900 px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-neutral-800 focus-visible:ring-neutral-400"
    >
      <Plus className="h-4 w-4" strokeWidth={2} />
      Add listing
    </Button>
  );
}

function MyListingsListingTypeToggle({
  value,
  onChange,
}: {
  value: MyListingsListingType;
  onChange: (value: MyListingsListingType) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Listing category"
      className="inline-flex shrink-0 rounded-xl border border-neutral-200 bg-neutral-50 p-0.5"
    >
      {([LISTING_TYPE.FOR_SALE, LISTING_TYPE.FOR_RENT] as const).map((type) => {
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(type)}
            className={cn(
              "h-8 rounded-lg px-3 text-xs font-medium transition-colors",
              active
                ? "bg-neutral-900 text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-800",
            )}
          >
            {type === LISTING_TYPE.FOR_SALE ? "Sale" : "Rental"}
          </button>
        );
      })}
    </div>
  );
}

function MyListingsPageIntro({
  subtitle,
  afterSubtitle,
}: {
  subtitle?: string;
  afterSubtitle?: React.ReactNode;
}) {
  return (
    <AacPageIntro
      withTopPadding
      back={<AacBackLink to={SUCCESS_HUB_PATH} title="Return to Success Hub" />}
      title="My Listings"
      subtitle={subtitle}
      afterSubtitle={afterSubtitle}
    />
  );
}

/** In-shell placeholder while listings fetch — keeps sidebar + avoids a second full-viewport monogram. */
function MyListingsSkeleton() {
  return (
    <AgentAacPage className="pb-12" aria-busy="true" role="status">
      <span className="sr-only">Loading your listings…</span>
      <MyListingsPageIntro subtitle="Manage your active, pending, and past listings from one place." />
      <div className="mb-6 space-y-3">
        <Skeleton className="h-9 w-[min(220px,85%)] rounded-md bg-neutral-100" />
        <Skeleton className="h-4 max-w-xl rounded-md bg-neutral-100" />
      </div>
      <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Skeleton className="h-9 w-full rounded-xl bg-neutral-100 lg:max-w-[220px]" />
          <div className="flex flex-1 gap-2 overflow-hidden">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-9 w-[76px] shrink-0 rounded-full bg-neutral-100" />
            ))}
          </div>
          <Skeleton className="h-9 w-[72px] shrink-0 self-end rounded-full bg-neutral-100 lg:self-auto" />
        </div>
      </div>
      <div className="mt-2 space-y-4">
        {[0, 1, 2].map((i) => (
          <CardSurface key={i} className="p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col gap-4 sm:flex-row">
              <Skeleton className="aspect-[140/100] w-full shrink-0 rounded-xl bg-neutral-100 sm:h-[100px] sm:w-[140px]" />
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-5 w-[min(100%,420px)] rounded-md bg-neutral-100" />
                <Skeleton className="h-4 w-[min(100%,280px)] rounded-md bg-neutral-100" />
                <Skeleton className="h-4 w-[min(100%,360px)] rounded-md bg-neutral-100" />
                <div className="flex flex-wrap gap-2 pt-2">
                  <Skeleton className="h-8 w-24 rounded-md bg-neutral-100" />
                  <Skeleton className="h-8 w-28 rounded-md bg-neutral-100" />
                  <Skeleton className="h-8 w-20 rounded-md bg-neutral-100" />
                </div>
              </div>
            </div>
          </CardSurface>
        ))}
      </div>
    </AgentAacPage>
  );
}

type MyListingsSortKey = "date" | "dom" | "price" | "status";

/** My Listings toolbar sort control — keep styles on this render path only. */
function MyListingsSortPill({
  sortKey,
  onSortKeyChange,
}: {
  sortKey: MyListingsSortKey;
  onSortKeyChange: (key: MyListingsSortKey) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pillActive = menuOpen || sortKey !== "date";

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          id="my-listings-sort-pill"
          aria-label="Sort listings"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          data-active={pillActive ? "true" : "false"}
          className={cn(
            "my-listings-sort-pill group inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium shadow-none outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2",
            pillActive
              ? "border-zinc-900 bg-zinc-100 text-zinc-900 hover:border-zinc-900 hover:bg-zinc-200"
              : "border-neutral-200 bg-white text-zinc-600 hover:border-neutral-300 hover:bg-zinc-200 hover:text-zinc-900",
          )}
        >
          Sort
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform duration-150",
              menuOpen && "rotate-180 text-zinc-900",
              !menuOpen && "group-hover:text-zinc-700",
            )}
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl border border-neutral-200 bg-white shadow-md">
        <DropdownMenuItem className="cursor-pointer text-[13px]" onClick={() => onSortKeyChange("date")}>
          Date (newest){sortKey === "date" ? " ✓" : ""}
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer text-[13px]" onClick={() => onSortKeyChange("dom")}>
          Days on market{sortKey === "dom" ? " ✓" : ""}
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer text-[13px]" onClick={() => onSortKeyChange("price")}>
          Price{sortKey === "price" ? " ✓" : ""}
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer text-[13px]" onClick={() => onSortKeyChange("status")}>
          Status{sortKey === "status" ? " ✓" : ""}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
  
  // Detect if agent has only drafts (no published listings)
  const nonDraftListings = useMemo(() => listings.filter(l => l.status !== "draft"), [listings]);
  const hasOnlyDrafts = listings.length > 0 && nonDraftListings.length === 0;

  // Multi-select: parse comma-separated statuses from URL, auto-select draft if only drafts exist
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ListingStatus>>(() => {
    if (statusFromUrl) {
      return new Set(statusFromUrl.split(",").filter(s => ALL_STATUSES.some(t => t.value === s)) as ListingStatus[]);
    }
    return new Set();
  });
  
  // Auto-select draft filter when agent has only drafts and no filter is active
  useEffect(() => {
    if (hasOnlyDrafts && selectedStatuses.size === 0 && !statusFromUrl) {
      setSelectedStatuses(new Set(["draft"]));
      setSearchParams({ status: "draft" });
    }
  }, [hasOnlyDrafts]);
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

  /** Card body opens View/Edit choice instead of navigating directly to property detail. */
  const [listingCardMenuId, setListingCardMenuId] = useState<string | null>(null);

  // Draft rows for bulk actions when Draft filter is on (still fetched with pipeline).
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
      // After deleting drafts, return to default view (no Draft filter selected).
      setSelectedStatuses(new Set());
      setSearchParams({});
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
      const wasDraft = listingToDelete.status === "draft";
      await onDelete(listingToDelete.id);
      if (wasDraft) {
        // After deleting a draft, return to default view and clear Draft selection.
        setSelectedStatuses(new Set());
        setSearchParams({});
      }
    } finally {
      setIsDeletingSingle(false);
      setListingToDelete(null);
    }
  };

  const [sortKey, setSortKey] = useState<MyListingsSortKey>("date");
  const [listingTypeFilter, setListingTypeFilter] = useState<MyListingsListingType>(LISTING_TYPE.FOR_SALE);

  const filteredListings = useMemo(() => {
    // Default (no status pills): show live/pipeline inventory only — never mix drafts in.
    // Drafts appear only when Draft is selected or URL includes `status=draft` (see selectedStatuses).
    // Exception: agents with only drafts still see their drafts on first paint while URL syncs to `?status=draft`.
    let result =
      selectedStatuses.size === 0
        ? hasOnlyDrafts
          ? listings
          : listings.filter((l) => l.status !== "draft")
        : listings.filter((l) => {
            const statusForFilter = (l.status === "back_on_market" ? "active" : l.status) as ListingStatus;
            return selectedStatuses.has(statusForFilter);
          });

    result = result.filter((l) => (l.listing_type || LISTING_TYPE.FOR_SALE) === listingTypeFilter);
    
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
    
    // Sort
    result = [...result].sort((a, b) => {
      switch (sortKey) {
        case "dom": {
          const domA = a.list_date ? Math.floor((Date.now() - new Date(a.list_date).getTime()) / 86400000) : 0;
          const domB = b.list_date ? Math.floor((Date.now() - new Date(b.list_date).getTime()) / 86400000) : 0;
          return domB - domA;
        }
        case "price": {
          const ev = (x: Listing) => listingEffectiveNumericPrice(x) ?? 0;
          return ev(b) - ev(a);
        }
        case "status":
          return (a.status ?? "").localeCompare(b.status ?? "");
        case "date":
        default:
          return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      }
    });
    return result;
  }, [listings, selectedStatuses, searchQuery, sortKey, hasOnlyDrafts, listingTypeFilter]);

  const startQuickEdit = (listing: Listing) => {
    setEditingId(listing.id);
    const seed = listingEffectiveNumericPrice(listing);
    setEditPrice(seed != null ? Math.round(seed) : "");
    // Treat BOM as an activation action in management UI, not a managed status.
    setEditStatus((listing.status === "back_on_market" ? "active" : listing.status) as ListingStatus);
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
      {/* Compact toolbar: search + status filters + sort (white shell, subtle shadow) */}
      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
          <MyListingsListingTypeToggle
            value={listingTypeFilter}
            onChange={setListingTypeFilter}
          />

          <div className="relative w-full shrink-0 lg:max-w-[240px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search address, MLS #…"
              autoComplete="off"
              className="h-9 w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-[13px] text-zinc-900 shadow-none outline-none placeholder:text-zinc-400 transition-colors focus:border-neutral-300 focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
              aria-label="Search listings"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-x-auto scrollbar-none">
            <div className="flex w-max max-w-full flex-nowrap gap-1.5 pb-0.5 sm:gap-2">
              {ALL_STATUSES.map((tab) => {
                const on = selectedStatuses.has(tab.value);
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => toggleStatus(tab.value)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium outline-none transition-colors",
                      on
                        ? "border-zinc-900 bg-white text-zinc-900 shadow-none hover:bg-zinc-100"
                        : "border-neutral-200 bg-white text-zinc-600 hover:border-neutral-300 hover:bg-zinc-200 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2",
                      on && "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-100 pt-2 lg:border-0 lg:pt-0">
            {selectedStatuses.size > 0 ? (
              <button
                type="button"
                onClick={clearStatusFilters}
                className="mr-auto text-[13px] font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
              >
                Clear filters
              </button>
            ) : null}

            <MyListingsSortPill sortKey={sortKey} onSortKeyChange={setSortKey} />
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

      {/* Draft bulk-action toolbar */}
      {selectedStatuses.has("draft") && draftListings.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <Checkbox
            checked={selectedDraftIds.size === draftListings.length}
            onCheckedChange={selectAllDrafts}
            aria-label="Select all drafts"
          />
          <span className="text-[13px] text-zinc-600">
            {selectedDraftIds.size > 0
              ? `${selectedDraftIds.size} of ${draftListings.length} selected`
              : `Select all (${draftListings.length})`}
          </span>
          <div className="flex-1" />
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedDraftIds.size === 0}
            className="h-8 gap-1.5 text-[13px] shadow-none"
            onClick={() => setShowBulkDeleteConfirm(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      )}

      {/* Auto-draft notice when agent has only drafts */}
      {hasOnlyDrafts && selectedStatuses.has("draft") && (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[13px] leading-snug text-zinc-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          Showing drafts because you don&apos;t have published listings yet.{" "}
          <button
            type="button"
            className="font-medium text-[#0E56F5] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
            onClick={() => onNewListing("new")}
          >
            Create a listing
          </button>
          .
        </div>
      )}

      {/* LIST VIEW — listing card layout restored to pre-audit design */}
      <div className="mt-5 space-y-4">
          {filteredListings.map((l) => {
            const thumbnail = getThumbnailUrl(l);
            const isEditing = editingId === l.id;
            const matchCount = l.hot_sheet_matches ?? 0;
            const views = l.listing_stats?.view_count ?? 0;
            const favorites = l.listing_stats?.save_count ?? 0;
            const listDate = formatDate(l.list_date) || formatDate(l.created_at);
            const expDate = formatDate(l.expiration_date);
            const goLiveDate = formatDate(l.go_live_date);
            const nowForToolbar = new Date();
            const upcomingEvents = Array.isArray(l.open_houses)
              ? (l.open_houses as any[]).filter((e: any) => {
                  if (!e?.date || !e?.end_time) return true;
                  return new Date(`${e.date}T${e.end_time}`) > nowForToolbar;
                })
              : [];
            const hasPublicOpenHouse = upcomingEvents.some((oh: any) => oh.event_type === "in_person");
            const hasBrokerTour = upcomingEvents.some((oh: any) => oh.event_type === "broker_tour");

            return (
              <CardSurface key={l.id} interactive className="relative p-4">
                {l.status === "draft" && (
                  <div className="absolute left-4 top-4 z-10">
                    <Checkbox
                      checked={selectedDraftIds.has(l.id)}
                      onCheckedChange={() => toggleDraftSelection(l.id)}
                      aria-label="Select draft"
                    />
                  </div>
                )}
                <div className={`mb-3 flex items-start justify-between ${l.status === "draft" ? "ml-8" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2 text-sm leading-tight text-zinc-600">
                    <button type="button" className="transition hover:text-emerald-700" onClick={() => onEdit(l.id)}>
                      Edit
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button type="button" className="transition hover:text-emerald-700" onClick={() => onPhotos(l.id)}>
                      Photos
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      type="button"
                      className="group inline-flex items-center gap-1"
                      onClick={() => (hasPublicOpenHouse ? onViewOpenHouses(l) : onOpenHouse(l))}
                    >
                      <span aria-hidden>🎈</span>
                      <span className="transition group-hover:text-emerald-700">Open House</span>
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      type="button"
                      className="group inline-flex items-center gap-1"
                      onClick={() => (hasBrokerTour ? onViewOpenHouses(l) : onBrokerTour(l))}
                    >
                      <span aria-hidden>🚙</span>
                      <span className="transition group-hover:text-[#0E56F5]">Broker Tour</span>
                    </button>
                    <span className="hidden text-zinc-300 sm:inline">•</span>
                    <button type="button" className="hidden transition hover:text-emerald-700 sm:inline" onClick={() => onMatches(l)}>
                      Matches ({matchCount})
                    </button>
                    <span className="hidden text-zinc-300 sm:inline">•</span>
                    <button type="button" className="hidden transition hover:text-emerald-700 sm:inline" onClick={() => onEmail?.(l)}>
                      Email
                    </button>
                    <span className="hidden text-zinc-300 sm:inline">•</span>
                    <button type="button" className="hidden transition hover:text-emerald-700 sm:inline" onClick={() => onSocialShare(l)}>
                      Social
                    </button>
                    <span className="hidden text-zinc-300 sm:inline">•</span>
                    <span className="hidden items-center gap-1 transition-opacity hover:opacity-80 sm:inline-flex">
                      <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 text-aac">
                        <path fill="currentColor" d="M8 2.75c3.73 0 6.7 2.2 7.95 5.25-1.25 3.05-4.22 5.25-7.95 5.25-3.73 0-6.7-2.2-7.95-5.25C1.3 4.95 4.27 2.75 8 2.75Z" />
                        <circle cx="8" cy="8" r="2.15" fill="hsl(var(--background))" />
                        <circle cx="8" cy="8" r="1.15" fill="currentColor" />
                      </svg>
                      <span className="text-[13px] font-medium leading-none text-zinc-800">{views}</span>
                    </span>
                    <span className="hidden text-zinc-300 sm:inline">•</span>
                    <span className="hidden items-center gap-1 transition-opacity hover:opacity-80 sm:inline-flex">
                      <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 fill-current text-destructive">
                        <path d="M8 14s-5-3.1-5-7.1C3 4.6 4.6 3 6.5 3c1.1 0 2.2.5 2.9 1.4C10.1 3.5 11.2 3 12.3 3 14.2 3 15.8 4.6 15.8 6.9 15.8 10.9 10.8 14 8 14Z" />
                      </svg>
                      <span className="text-[13px] font-medium leading-none text-zinc-800">{favorites}</span>
                    </span>
                    <span className="hidden text-zinc-300 sm:inline">•</span>
                    <button type="button" className="hidden transition hover:text-emerald-700 sm:inline" onClick={() => onStats(l.id)}>
                      Stats
                    </button>
                  </div>

                  <div className="absolute right-4 top-4 z-10 space-y-0.5 text-right">
                    <ListingStatusBadge status={l.status} size="lg" />
                    <div className="hidden text-xs leading-tight sm:block">
                      <span className="text-zinc-400">AAC List Date:</span>{" "}
                      <span className="text-zinc-500">{listDate}</span>
                    </div>
                    {isComingSoon(l.status) ? (
                      <>
                        {goLiveDate && (
                          <div className="hidden text-xs leading-tight sm:block">
                            <span className="text-zinc-400">On MLS Date:</span>{" "}
                            <span className="text-zinc-500">{goLiveDate}</span>
                          </div>
                        )}
                        {expDate && (
                          <div className="hidden text-xs leading-tight sm:block">
                            <span className="text-zinc-400">Exp:</span> <span className="text-zinc-500">{expDate}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      expDate && (
                        <div className="hidden text-xs leading-tight sm:block">
                          <span className="text-zinc-400">Exp:</span> <span className="text-zinc-500">{expDate}</span>
                        </div>
                      )
                    )}
                    {l.status === "draft" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="mt-1 rounded p-1 text-zinc-400 transition-colors hover:text-zinc-600"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            className="cursor-pointer text-sm text-destructive focus:text-destructive"
                            onClick={() => setListingToDelete(l)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete Listing
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                <div className="relative flex items-start gap-4">
                  <button
                    type="button"
                    className="h-[100px] w-[140px] shrink-0 overflow-hidden rounded-xl border border-zinc-100 bg-white outline-none transition-colors hover:border-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
                    onClick={() => setListingCardMenuId(l.id)}
                    aria-label={`View or edit listing: ${formatAddressWithUnit(l)}`}
                  >
                    <img
                      src={thumbnail || "/placeholder.svg"}
                      alt=""
                      className="pointer-events-none h-full w-full object-cover"
                    />
                  </button>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <button
                      type="button"
                      className="w-full rounded-lg border border-transparent p-0 text-left outline-none transition-colors hover:border-zinc-100/90 hover:bg-zinc-50/50 focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
                      onClick={() => setListingCardMenuId(l.id)}
                      aria-label={`View or edit listing: ${formatAddressWithUnit(l)}`}
                    >
                      <div className="flex items-center gap-2">
                        {l.listing_number && (
                          <span className="text-xs leading-none text-primary">#{l.listing_number}</span>
                        )}
                        {l.listing_type && (
                          <>
                            <span className="text-zinc-300">•</span>
                            <span className="inline-block rounded border border-zinc-100 bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#0E56F5]">
                              {LISTING_TYPE_LABELS[l.listing_type] || l.listing_type}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="truncate text-base font-semibold leading-tight text-zinc-900">
                        {formatAddressWithUnit(l)}
                      </div>
                      <div className="text-sm leading-tight text-zinc-500">
                        {l.state} {l.zip_code}
                        {l.neighborhood ? ` · ${l.neighborhood}` : ""}
                      </div>
                    </button>

                    <div className="mt-1">
                       {isEditing ? (
                         <div className="flex flex-wrap items-center gap-2">
                           <div className="relative w-[7rem] min-w-0">
                             <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[13px] font-medium text-zinc-500" aria-hidden>
                               $
                             </span>
                             <Input
                               type="text"
                               inputMode="numeric"
                               autoComplete="off"
                               aria-label="Listing price"
                               className="h-7 border-zinc-200 bg-white pl-5 pr-2 text-left text-[13px] font-medium tabular-nums text-zinc-900 shadow-none focus-visible:border-zinc-300 focus-visible:ring-1 focus-visible:ring-zinc-300/50 focus-visible:ring-offset-0"
                               value={editPrice === "" ? "" : formatUsdWholeForInput(editPrice)}
                               onChange={(e) => setEditPrice(parseUsdWholeInput(e.target.value))}
                             />
                           </div>
                           <Select
                             value={editStatus}
                             onValueChange={(v) => setEditStatus(v as ListingStatus)}
                           >
                             <SelectTrigger className="h-7 w-[7.5rem] border-zinc-200 bg-white px-2 text-[13px] capitalize text-zinc-900 shadow-none focus:ring-1 focus:ring-zinc-300/50">
                               <SelectValue placeholder="Status" />
                             </SelectTrigger>
                             <SelectContent>
                               {ALL_STATUSES.map((tab) => (
                                 <SelectItem key={tab.value} value={tab.value} className="text-xs capitalize">
                                   {tab.label}
                                 </SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                           <Button type="button" size="sm" className="h-7 px-2.5 text-[12px]" onClick={saveQuickEdit}>
                             Save
                           </Button>
                           <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-[12px] text-zinc-600" onClick={cancelQuickEdit}>
                             Cancel
                           </Button>
                         </div>
                       ) : (
                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-zinc-900">
                              {formatListingPriceDisplay(l) ?? "—"}
                            </span>
                            <button
                              type="button"
                              className="text-xs text-primary hover:text-primary/80 hover:underline"
                              onClick={() => startQuickEdit(l)}
                              title="Quick edit price and status"
                            >
                              Quick Edit
                            </button>
                          </div>
                          {(() => {
                            const now = new Date();
                            const allEvents = Array.isArray(l.open_houses) ? (l.open_houses as any[]) : [];
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
                              <div className="min-w-0 flex-1 space-y-0.5">
                                {openHouseEvent && (() => {
                                  const first = formatOpenHouseEvent(openHouseEvent);
                                  return (
                                    <div className="flex min-w-0 items-center gap-1.5 text-sm text-zinc-600">
                                      <span aria-hidden className="shrink-0">
                                        🎈
                                      </span>
                                      <span className="truncate">
                                        Open House • {first.dateLabel} • {first.timeLabel}
                                      </span>
                                      {openHouseCount > 1 && (
                                        <span className="shrink-0 text-xs text-zinc-400">+{openHouseCount - 1} more</span>
                                      )}
                                      <button
                                        type="button"
                                        className="ml-1 shrink-0 text-xs text-primary hover:text-primary/80 hover:underline"
                                        onClick={() => onViewOpenHouses(l)}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="shrink-0 text-xs text-red-600 hover:text-red-700 hover:underline"
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
                                    <div className="flex min-w-0 items-center gap-1.5 text-sm text-zinc-600">
                                      <span aria-hidden className="shrink-0">
                                        🚙
                                      </span>
                                      <span className="truncate">
                                        Broker Tour • {first.dateLabel} • {first.timeLabel}
                                      </span>
                                      {brokerTourCount > 1 && (
                                        <span className="shrink-0 text-xs text-zinc-400">+{brokerTourCount - 1} more</span>
                                      )}
                                      <button
                                        type="button"
                                        className="ml-1 shrink-0 text-xs text-primary hover:text-primary/80 hover:underline"
                                        onClick={() => onViewOpenHouses(l)}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="shrink-0 text-xs text-red-600 hover:text-red-700 hover:underline"
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
            <div className="rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <p className="text-[15px] font-semibold tracking-tight text-zinc-900">No listings match</p>
              <p className="mt-2 max-w-md mx-auto text-[13px] leading-snug text-zinc-500">
                Try the other category, adjust status filters, or clear your search to see inventory again.
              </p>
            </div>
          )}
        </div>

      <Dialog open={listingCardMenuId !== null} onOpenChange={(open) => !open && setListingCardMenuId(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Open listing</DialogTitle>
            <DialogDescription>View the property page or open the listing editor.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                if (listingCardMenuId) {
                  onEdit(listingCardMenuId);
                  setListingCardMenuId(null);
                }
              }}
            >
              Edit
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => {
                if (listingCardMenuId) {
                  onPreview(listingCardMenuId);
                  setListingCardMenuId(null);
                }
              }}
            >
              View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    if (!user) return;

    const hasCached =
      myListingsCache &&
      myListingsCache.userId === user.id &&
      Array.isArray(myListingsCache.listings);

    if (hasCached) {
      // Reuse recently loaded listings immediately, then refresh in background.
      setListings(myListingsCache!.listings);
      setLoading(false);
      fetchListings({ background: true });
      return;
    }
    fetchListings();
  }, [user]);

  useEffect(() => {
    const savedY = sessionStorage.getItem(MY_LISTINGS_SCROLL_KEY);
    if (!savedY) return;
    const y = Number(savedY);
    if (!Number.isFinite(y)) return;
    requestAnimationFrame(() => window.scrollTo({ top: y }));
  }, []);

  useEffect(() => {
    return () => {
      sessionStorage.setItem(MY_LISTINGS_SCROLL_KEY, String(window.scrollY));
    };
  }, []);

  const fetchListings = async ({ background = false }: { background?: boolean } = {}) => {
    if (!user) return;

    if (!background) {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from("listings")
        .select(`
          *,
          listing_stats (view_count, save_count, share_count, contact_count, showing_request_count)
        `)
        .eq("agent_id", user.id)
        .in("status", FETCH_STATUSES);

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
            
            // Check price range (use effective price when only range is set)
            const listingPriceVal = listingEffectiveNumericPrice(listing as Listing);
            if (criteria.minPrice && (listingPriceVal == null || listingPriceVal < criteria.minPrice)) return;
            if (criteria.maxPrice && (listingPriceVal == null || listingPriceVal > criteria.maxPrice)) return;
            
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
      myListingsCache = {
        userId: user.id,
        listings: listingsWithMatches,
        updatedAt: Date.now(),
      };
    } catch (error) {
      console.error("Error fetching listings:", error);
      if (!background) {
        toast.error("Failed to load listings");
      }
    } finally {
      if (!background) {
        setLoading(false);
      }
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
    const { trackShare } = await import("@/lib/trackShare").catch(() => ({ trackShare: async () => {} }));
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
      const current = listings.find((l) => l.id === id);
      if (!current) {
        toast.error("Listing not found");
        return;
      }

      const isInactiveStatus = (status?: string | null) =>
        status === "expired" ||
        status === "cancelled" ||
        status === "off_market" ||
        status === "temporarily_withdrawn" ||
        status === "withdrawn" ||
        status === "draft";

      let nextUpdates = { ...updates };
      // My Listings-only behavior: BOM action reactivates to `active` for inactive listings.
      if (
        updates.status === "back_on_market" &&
        isInactiveStatus(current.status)
      ) {
        nextUpdates = { ...nextUpdates, status: "active" };
      }

      const merged = {
        listing_type: current.listing_type,
        status: nextUpdates.status ?? current.status,
        price: nextUpdates.price ?? current.price,
        price_range_min: current.price_range_min,
        price_range_max: current.price_range_max,
      };

      const leavingDraft =
        isDraftListingStatus(current.status) && !isDraftListingStatus(merged.status);
      const targetingNonDraft = !isDraftListingStatus(merged.status);

      if ((leavingDraft || targetingNonDraft) && !listingSatisfiesPricingRule(merged)) {
        toast.error(listingMissingPricingMessage(merged));
        return;
      }

      // Block clearing price on a non-draft listing when no valid range remains.
      if (
        nextUpdates.price !== undefined &&
        !isDraftListingStatus(merged.status) &&
        !listingHasValidPricing(merged)
      ) {
        toast.error(listingMissingPricingMessage(merged));
        return;
      }

      const { data, error } = await supabase.from("listings").update(nextUpdates).eq("id", id).select("*").single();

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
      <AgentAacPage className="flex min-h-[50vh] flex-1 flex-col justify-center space-y-0">
        <p className="text-center text-sm text-neutral-500">
          You must be signed in as an agent to view your listings.
        </p>
      </AgentAacPage>
    );
  }

  if (loading) {
    return (
      <>
        <Seo title="My Listings" />
        <MyListingsSkeleton />
      </>
    );
  }

  if (listings.length === 0) {
    return (
      <>
        <Seo title="My Listings" />
        <AgentAacPage className="pb-12">
        <MyListingsPageIntro subtitle="Publish on AAC — off-market through active." />
        <AgentSectionCard className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-14">
          <div
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#16A34A]/40 to-transparent md:inset-x-12"
            aria-hidden
          />
          <button
            type="button"
            onClick={() => handleNewListing("new")}
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#16A34A]/25 bg-white shadow-sm transition-colors hover:border-[#16A34A]/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/25 focus-visible:ring-offset-2"
            aria-label="Create listing"
          >
            <Home className="h-8 w-8 text-[#16A34A]" strokeWidth={1.5} aria-hidden />
          </button>
          <h3 className="mb-2 text-[17px] font-semibold tracking-tight text-zinc-900 md:text-xl">No listings yet</h3>
          <p className="mb-8 max-w-sm mx-auto text-[13px] leading-snug text-zinc-500">
            Once you publish, your listings appear here — status filters match how you browse in search results.
          </p>
          <Button
            type="button"
            onClick={() => handleNewListing("new")}
            className="h-10 rounded-lg bg-[#0E56F5] px-5 text-[13px] font-semibold text-white shadow-sm hover:bg-[#0B46CC] focus-visible:ring-[#0E56F5]/35"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create listing
          </Button>
        </AgentSectionCard>
        </AgentAacPage>
      </>
    );
  }

  return (
    <>
      <Seo title="My Listings" />
      <AgentAacPage className="pb-12">
      <AacPageIntro
        withTopPadding
        back={<AacBackLink to={SUCCESS_HUB_PATH} title="Return to Success Hub" />}
        title="My Listings"
        subtitle="Manage your active, pending, and past listings from one place."
        afterSubtitle={<MyListingsNewListingButton onClick={() => handleNewListing("new")} />}
      />
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
          <div className="rounded-xl border border-zinc-100 bg-white p-6 shadow-none" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Share Listing</h3>
            <SocialShareMenu
              url={getListingShareUrl(socialShareListing.id)}
              title={`${socialShareListing.address}, ${socialShareListing.city} - ${formatListingPriceDisplay(socialShareListing) ?? "—"}`}
              description={`Check out this property listing`}
              listingId={socialShareListing.id}
              listingAddress={socialShareListing.address}
            />
          </div>
        </div>
      )}

      {/* Email Share Modal */}
      <EmailShareModal
        open={!!emailListing}
        onOpenChange={(open) => !open && setEmailListing(null)}
        listingUrl={emailListing ? getListingShareUrl(emailListing.id) : ""}
        listingAddress={
          emailListing
            ? formatListingEmailSubjectLocation(emailListing) || `${emailListing.address}, ${emailListing.city}`
            : ""
        }
      />
      </AgentAacPage>
    </>
  );
};

export default MyListings;

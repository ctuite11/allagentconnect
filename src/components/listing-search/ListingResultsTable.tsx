import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, ExternalLink, MessageSquare, Users, Check, FileSpreadsheet, Eye, EyeOff, Bookmark, CalendarDays, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { FilterState } from "@/components/listing-search/ListingSearchFilters";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";
import { buildDisplayAddress } from "@/lib/utils";
import { SectionCard } from "@/components/ui/section-card";
import SaveToHotSheetDialog from "@/components/SaveToHotSheetDialog";

interface Listing {
  id: string;
  listing_number: string;
  address: string;
  unit_number?: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  status: string;
  list_date?: string;
  property_type?: string;
  agent_id: string;
  agent_name?: string;
  photos?: any;
  neighborhood?: string;
  open_houses?: any[];
  year_built?: number;
  lot_size?: number;
  garage_spaces?: number;
  total_parking_spaces?: number;
  property_styles?: any;
}

interface ListingResultsTableProps {
  listings: Listing[];
  loading: boolean;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
  onRowClick: (listing: Listing) => void;
  filters?: FilterState;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
};

const getDaysOnMarket = (listDate?: string) => {
  if (!listDate) return "-";
  const days = Math.floor(
    (Date.now() - new Date(listDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  return days >= 0 ? days : "-";
};

// Status badge with specified colors
const getStatusBadge = (status: string) => {
  // Green = Active, Orange = Coming Soon, Red = Off-Market, Gray = Sold
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Active" },
    new: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Active" },
    coming_soon: { bg: "bg-amber-50", text: "text-amber-700", label: "Coming Soon" },
    off_market: { bg: "bg-rose-50", text: "text-rose-700", label: "Off-Market" },
    back_on_market: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Back on Market" },
    price_changed: { bg: "bg-blue-50", text: "text-blue-700", label: "Price Change" },
    under_agreement: { bg: "bg-violet-50", text: "text-violet-700", label: "Under Agreement" },
    pending: { bg: "bg-violet-50", text: "text-violet-700", label: "Pending" },
    sold: { bg: "bg-slate-100", text: "text-slate-600", label: "Sold" },
    withdrawn: { bg: "bg-slate-100", text: "text-slate-500", label: "Withdrawn" },
    expired: { bg: "bg-slate-100", text: "text-slate-500", label: "Expired" },
    cancelled: { bg: "bg-slate-100", text: "text-slate-500", label: "Cancelled" },
  };

  const config = statusConfig[status] || { bg: "bg-slate-100", text: "text-slate-600", label: status };

  return (
    <Badge 
      className={`${config.bg} ${config.text} border-0 text-xs font-medium px-2.5 py-0.5 whitespace-nowrap`}
    >
      {config.label}
    </Badge>
  );
};

// Get thumbnail from photos array
const getThumbnail = (listing: Listing) => {
  if (listing.photos && Array.isArray(listing.photos) && listing.photos.length > 0) {
    const photo = listing.photos[0];
    return typeof photo === 'string' ? photo : photo?.url || null;
  }
  return null;
};

// Calculate price per square foot
const getPricePerSqFt = (price: number, sqft?: number) => {
  if (!sqft || sqft === 0) return null;
  return Math.round(price / sqft);
};

// Check if listing has upcoming open house or broker open house
const getOpenHouseInfo = (listing: Listing) => {
  if (!listing.open_houses || !Array.isArray(listing.open_houses) || listing.open_houses.length === 0) {
    return null;
  }
  
  const now = new Date();
  const upcomingOpenHouses = listing.open_houses.filter((oh: any) => {
    const ohDate = new Date(oh.date || oh.start_date);
    return ohDate >= now;
  });
  
  if (upcomingOpenHouses.length === 0) return null;
  
  const hasBrokerOpen = upcomingOpenHouses.some((oh: any) => 
    oh.type === 'broker' || oh.is_broker_open === true
  );
  const hasPublicOpen = upcomingOpenHouses.some((oh: any) => 
    oh.type === 'public' || oh.type === 'open_house' || !oh.type
  );
  
  return { hasBrokerOpen, hasPublicOpen };
};

// Get property style display
const getPropertyStyle = (listing: Listing) => {
  if (listing.property_styles) {
    if (Array.isArray(listing.property_styles) && listing.property_styles.length > 0) {
      return listing.property_styles[0];
    }
    if (typeof listing.property_styles === 'string') {
      return listing.property_styles;
    }
  }
  return listing.property_type || null;
};

// Format lot size
const formatLotSize = (lotSize?: number) => {
  if (!lotSize) return null;
  if (lotSize >= 43560) {
    return `${(lotSize / 43560).toFixed(2)} acres`;
  }
  return `${lotSize.toLocaleString()} sf lot`;
};

// Get photo count
const getPhotoCount = (listing: Listing) => {
  if (listing.photos && Array.isArray(listing.photos)) {
    return listing.photos.length;
  }
  return 0;
};

const ListingResultsTable = ({
  listings,
  loading,
  sortColumn,
  sortDirection,
  onSort,
  onRowClick,
  filters,
}: ListingResultsTableProps) => {
  const navigate = useNavigate();
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState("date_new");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [hotSheetDialogOpen, setHotSheetDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const rowRefs = useState(() => new Map<string, HTMLTableRowElement>())[0];

  const toggleExpand = (id: string) => setExpandedId(prev => (prev === id ? null : id));

  const focusRowByIndex = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, displayedListings.length - 1));
    setFocusedIndex(clamped);
    const target = displayedListings[clamped];
    if (!target) return;
    rowRefs.get(target.id)?.focus();
    rowRefs.get(target.id)?.scrollIntoView({ block: "nearest" });
  };

  const onRowKeyDown = (
    e: React.KeyboardEvent,
    listing: Listing,
    idx: number
  ) => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (["button", "a", "input", "select", "textarea"].includes(tag)) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusRowByIndex(idx + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusRowByIndex(idx - 1);
        break;
      case "Enter":
        e.preventDefault();
        toggleExpand(listing.id);
        break;
      case " ":
        e.preventDefault();
        toggleRowSelection(listing.id);
        break;
      case "Escape":
        if (expandedId) {
          e.preventDefault();
          setExpandedId(null);
        }
        break;
    }
  };

  // Filter listings based on selected-only mode
  const displayedListings = showSelectedOnly 
    ? listings.filter(l => selectedRows.has(l.id))
    : listings;

  const toggleSelectAll = () => {
    if (selectedRows.size === displayedListings.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(displayedListings.map(l => l.id)));
    }
  };

  const handleKeepSelected = () => {
    if (showSelectedOnly) {
      setShowSelectedOnly(false);
    } else {
      setShowSelectedOnly(true);
    }
  };

  const handleSaveSearch = () => {
    // Save current URL to localStorage
    const searchUrl = window.location.href;
    const savedSearches = JSON.parse(localStorage.getItem("savedSearches") || "[]");
    savedSearches.push({
      url: searchUrl,
      savedAt: new Date().toISOString(),
      name: `Search ${savedSearches.length + 1}`
    });
    localStorage.setItem("savedSearches", JSON.stringify(savedSearches));
    toast.success("Search saved successfully");
  };

  // Build current search criteria for hot sheet
  const buildHotSheetCriteria = () => ({
    state: filters?.state,
    county: filters?.county,
    cities: filters?.selectedTowns,
    propertyTypes: filters?.propertyTypes,
    minPrice: filters?.priceMin ? parseInt(filters.priceMin) : null,
    maxPrice: filters?.priceMax ? parseInt(filters.priceMax) : null,
    bedrooms: filters?.bedsMin ? parseInt(filters.bedsMin) : null,
    bathrooms: filters?.bathsMin ? parseFloat(filters.bathsMin) : null,
    statuses: filters?.statuses,
  });

  const toggleRowSelection = (id: string, e?: React.SyntheticEvent) => {
    e?.stopPropagation?.();
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const SortableHeader = ({ 
    column, 
    children, 
    className = "" 
  }: { 
    column: string; 
    children: React.ReactNode; 
    className?: string;
  }) => (
    <TableHead
      className={`cursor-pointer hover:bg-muted transition-colors text-xs font-semibold text-muted-foreground whitespace-nowrap ${className}`}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown 
          className={`h-3 w-3 ${sortColumn === column ? "text-foreground" : "text-muted-foreground/50"}`} 
        />
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full bg-muted" />
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-base font-medium text-foreground">No listings found</p>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your search filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sticky Action Bar */}
      <div className="sticky top-4 z-10 rounded-xl bg-background border border-neutral-200/80 shadow-[0_2px_4px_rgba(0,0,0,0.08),0_12px_28px_rgba(0,0,0,0.12)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="h-9 px-4 text-sm font-medium"
            >
              {selectedRows.size === displayedListings.length && displayedListings.length > 0 ? "Deselect All" : "Select All"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedRows.size === 0 && !showSelectedOnly}
              onClick={handleKeepSelected}
              className="h-9 px-4 text-sm font-medium disabled:opacity-50"
            >
              {showSelectedOnly ? (
                <>
                  <Eye className="h-4 w-4 mr-1.5" />
                  Show All
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 mr-1.5" />
                  Keep Selected
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveSearch}
              className="h-9 px-4 text-sm font-medium"
            >
              <Bookmark className="h-4 w-4 mr-1.5" />
              Save Search
            </Button>
            {selectedRows.size > 0 && (
              <BulkShareListingsDialog
                listingIds={Array.from(selectedRows)}
                listingCount={selectedRows.size}
              />
            )}
            <Button
              variant="brandOutline"
              size="sm"
              onClick={() => {
                if (selectedRows.size === 0) {
                  toast.error("You haven't selected any properties", {
                    description: "Select one or more properties from the results to save a hotsheet.",
                  });
                  return;
                }
                setHotSheetDialogOpen(true);
              }}
              className="h-9 px-4 text-sm font-medium"
            >
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              Save as Hot Sheet
            </Button>
            {selectedRows.size > 0 && (
              <span className="text-sm text-muted-foreground ml-2 font-medium">
                {selectedRows.size} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_new">Date (New)</SelectItem>
                <SelectItem value="date_old">Date (Old)</SelectItem>
                <SelectItem value="price_high">Price (High)</SelectItem>
                <SelectItem value="price_low">Price (Low)</SelectItem>
                <SelectItem value="sqft">Square Feet</SelectItem>
                <SelectItem value="beds">Bedrooms</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-auto bg-background rounded-lg border border-border">

        {/* Hot Sheet Dialog */}
        <SaveToHotSheetDialog
          open={hotSheetDialogOpen}
          onOpenChange={setHotSheetDialogOpen}
          currentSearch={buildHotSheetCriteria()}
          selectedListingIds={Array.from(selectedRows)}
        />

        <Table>
        <TableHeader className="bg-neutral-50/70">
          <TableRow className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:text-xs [&>th]:font-semibold [&>th]:text-muted-foreground [&>th]:uppercase [&>th]:tracking-wider">
            <TableHead className="w-10 text-xs font-semibold text-muted-foreground">
              <div 
                className="w-4 h-4 border border-border rounded cursor-pointer flex items-center justify-center hover:bg-muted"
                onClick={toggleSelectAll}
              >
                {selectedRows.size === displayedListings.length && displayedListings.length > 0 && (
                  <Check className="w-3 h-3 text-foreground" />
                )}
              </div>
            </TableHead>
            <TableHead className="w-32 text-xs font-semibold text-muted-foreground pl-2">Photo</TableHead>
            <SortableHeader column="address" className="min-w-[180px]">Address</SortableHeader>
            <SortableHeader column="price" className="pl-1">Price</SortableHeader>
            <SortableHeader column="bedrooms" className="text-center px-1">Beds</SortableHeader>
            <SortableHeader column="bathrooms" className="text-center px-1">Baths</SortableHeader>
            <SortableHeader column="square_feet" className="text-right px-1">SqFt</SortableHeader>
            <TableHead className="text-xs font-semibold text-muted-foreground px-1">Status</TableHead>
            <SortableHeader column="list_date" className="text-center px-1">DOM</SortableHeader>
            <TableHead className="text-xs font-semibold text-muted-foreground px-1">Agent</TableHead>
            <TableHead className="w-36"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayedListings.map((listing, idx) => {
            const thumbnail = getThumbnail(listing);
            const pricePerSqFt = getPricePerSqFt(listing.price, listing.square_feet);
            const openHouseInfo = getOpenHouseInfo(listing);
            const isExpanded = expandedId === listing.id;

            return (
              <React.Fragment key={listing.id}>
                <TableRow
                  ref={(el) => { if (el) rowRefs.set(listing.id, el); }}
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onKeyDown={(e) => onRowKeyDown(e, listing, idx)}
                  onClick={() => {
                    onRowClick(listing);
                    toggleExpand(listing.id);
                  }}
                  className={[
                    "border-t border-neutral-200/70 cursor-pointer outline-none",
                    "hover:bg-neutral-50/60 transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2",
                    isExpanded ? "bg-neutral-50/40" : ""
                  ].join(" ")}
                >
                  {/* Checkbox */}
                  <TableCell className="px-4 py-4 align-top">
                    <button
                      onClick={(e) => toggleRowSelection(listing.id, e)}
                      className="h-4 w-4 rounded border border-neutral-300 flex items-center justify-center"
                      aria-label="Select listing"
                    >
                      {selectedRows.has(listing.id) && <Check className="h-3 w-3" />}
                    </button>
                  </TableCell>

                  {/* Thumbnail */}
                  <TableCell className="px-4 py-4 align-top">
                    <div className="relative h-[64px] w-[104px] overflow-hidden rounded-lg border border-neutral-200/70 bg-neutral-50">
                      {thumbnail ? (
                        <img src={thumbnail} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          No photo
                        </div>
                      )}
                      {getPhotoCount(listing) > 0 && (
                        <div className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                          {getPhotoCount(listing)}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Address */}
                  <TableCell className="px-4 py-4 align-top">
                    <a
                      href="#"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        navigate(`/property/${listing.id}`);
                      }}
                      className="text-sm font-semibold text-foreground hover:text-primary hover:underline block"
                    >
                      {listing.address}{listing.unit_number ? ` #${listing.unit_number}` : ""}
                    </a>

                    <div className="text-xs text-muted-foreground mt-1">
                      {listing.city}, {listing.state} {listing.zip_code}
                    </div>

                    {listing.neighborhood && (
                      <div className="text-xs text-muted-foreground mt-1">{listing.neighborhood}</div>
                    )}

                    {/* Property Details Row */}
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {getPropertyStyle(listing) && (
                        <span className="rounded-md bg-neutral-100 px-2 py-0.5 border border-neutral-200/70">
                          {getPropertyStyle(listing)}
                        </span>
                      )}
                      {listing.year_built && (
                        <span className="rounded-md bg-neutral-100 px-2 py-0.5 border border-neutral-200/70">
                          Built {listing.year_built}
                        </span>
                      )}
                      {formatLotSize(listing.lot_size) && (
                        <span className="rounded-md bg-neutral-100 px-2 py-0.5 border border-neutral-200/70">
                          {formatLotSize(listing.lot_size)}
                        </span>
                      )}
                    </div>

                    {/* Bottom info bar */}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      {openHouseInfo?.hasPublicOpen && (
                        <span className="rounded-md bg-neutral-100 px-2 py-0.5 border border-neutral-200/70">
                          Open
                        </span>
                      )}
                      {openHouseInfo?.hasBrokerOpen && (
                        <span className="rounded-md bg-neutral-100 px-2 py-0.5 border border-neutral-200/70">
                          Broker
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          navigate(`/property/${listing.id}`);
                        }}
                        className="text-primary font-mono hover:underline"
                      >
                        #{listing.listing_number}
                      </button>
                    </div>
                  </TableCell>

                  {/* Price */}
                  <TableCell className="px-4 py-4 align-top whitespace-nowrap">
                    <div className="text-sm font-semibold">{formatPrice(listing.price)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {pricePerSqFt ? `$${pricePerSqFt}/sqft` : ""}
                    </div>
                  </TableCell>

                  {/* Beds */}
                  <TableCell className="px-4 py-4 align-top text-sm">{listing.bedrooms || "-"}</TableCell>

                  {/* Baths */}
                  <TableCell className="px-4 py-4 align-top text-sm">{listing.bathrooms || "-"}</TableCell>

                  {/* SqFt */}
                  <TableCell className="px-4 py-4 align-top text-sm">
                    {listing.square_feet?.toLocaleString() || "-"}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="px-4 py-4 align-top">{getStatusBadge(listing.status)}</TableCell>

                  {/* DOM */}
                  <TableCell className="px-4 py-4 align-top text-sm">
                    {getDaysOnMarket(listing.list_date)}
                  </TableCell>

                  {/* Agent */}
                  <TableCell className="px-4 py-4 align-top text-sm">
                    {listing.agent_name || "-"}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="px-4 py-4 align-top">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="secondary" onClick={() => {/* existing contact logic */}}>
                        <MessageSquare className="h-4 w-4" />
                        <span className="ml-2 hidden lg:inline">Contact</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/property/${listing.id}`)}
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="ml-2 hidden lg:inline">View</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>

                {/* Expanded Row */}
                {isExpanded && (
                  <TableRow className="border-t border-neutral-200/70 bg-neutral-50/40">
                    <TableCell colSpan={999} className="px-4 py-4">
                      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
                        {/* Left: photo preview */}
                        <div className="rounded-xl border border-neutral-200/70 bg-background p-3">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Preview
                          </div>
                          <div className="mt-3 h-[200px] rounded-lg overflow-hidden border border-neutral-200/70 bg-neutral-50">
                            {thumbnail ? (
                              <img src={thumbnail} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                                No photos available
                              </div>
                            )}
                          </div>

                          <div className="mt-3 flex gap-2">
                            <Button size="sm" variant="secondary" onClick={() => {/* contact */}}>
                              Contact
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => navigate(`/property/${listing.id}`)}>
                              View Details
                            </Button>
                          </div>
                        </div>

                        {/* Right: quick facts */}
                        <div className="rounded-xl border border-neutral-200/70 bg-background p-3">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-sm font-semibold">
                                {listing.address}{listing.unit_number ? ` #${listing.unit_number}` : ""}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {listing.city}, {listing.state} {listing.zip_code}
                                {listing.neighborhood ? ` • ${listing.neighborhood}` : ""}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold">{formatPrice(listing.price)}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                DOM {getDaysOnMarket(listing.list_date)}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="rounded-lg border border-neutral-200/70 bg-neutral-50/60 p-3">
                              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Beds</div>
                              <div className="mt-1 text-sm font-semibold">{listing.bedrooms || "—"}</div>
                            </div>
                            <div className="rounded-lg border border-neutral-200/70 bg-neutral-50/60 p-3">
                              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Baths</div>
                              <div className="mt-1 text-sm font-semibold">{listing.bathrooms || "—"}</div>
                            </div>
                            <div className="rounded-lg border border-neutral-200/70 bg-neutral-50/60 p-3">
                              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Sq Ft</div>
                              <div className="mt-1 text-sm font-semibold">
                                {listing.square_feet ? listing.square_feet.toLocaleString() : "—"}
                              </div>
                            </div>
                            <div className="rounded-lg border border-neutral-200/70 bg-neutral-50/60 p-3">
                              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Status</div>
                              <div className="mt-1">{getStatusBadge(listing.status)}</div>
                            </div>
                          </div>

                          {/* Open houses */}
                          {(openHouseInfo?.hasPublicOpen || openHouseInfo?.hasBrokerOpen) && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {openHouseInfo?.hasPublicOpen && (
                                <Badge variant="secondary">Public Open House</Badge>
                              )}
                              {openHouseInfo?.hasBrokerOpen && (
                                <Badge variant="secondary">Broker Open House</Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
};

export default ListingResultsTable;

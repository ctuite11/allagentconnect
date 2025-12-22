import { useState, useMemo } from "react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, ExternalLink, Check, FileSpreadsheet, Eye, EyeOff, Bookmark } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { FilterState } from "@/components/listing-search/ListingSearchFilters";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";
import SaveToHotSheetDialog from "@/components/SaveToHotSheetDialog";
import SaveSearchDialog from "@/components/SaveSearchDialog";
import ContactAgentDialog from "@/components/ContactAgentDialog";
import { ListingResultCard } from "@/components/listing-search/ListingResultCard";


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
  annual_property_tax?: number;
  hoa_monthly?: number;
  list_office?: string;
  list_agent_phone?: string;
  list_agent_email?: string;
}

interface ListingResultsTableProps {
  listings: Listing[];
  loading: boolean;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
  onRowClick: (listing: Listing) => void;
  filters?: FilterState;
  fromPath?: string;
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
    active: { bg: "bg-slate-100", text: "text-emerald-700", label: "Active" },
    new: { bg: "bg-slate-100", text: "text-emerald-700", label: "Active" },
    coming_soon: { bg: "bg-slate-100", text: "text-slate-700", label: "Coming Soon" },
    off_market: { bg: "bg-slate-100", text: "text-slate-700", label: "Off-Market" },
    back_on_market: { bg: "bg-slate-100", text: "text-emerald-700", label: "Back on Market" },
    price_changed: { bg: "bg-slate-100", text: "text-slate-700", label: "Price Change" },
    under_agreement: { bg: "bg-slate-100", text: "text-slate-700", label: "Under Agreement" },
    pending: { bg: "bg-slate-100", text: "text-slate-700", label: "Pending" },
    sold: { bg: "bg-slate-100", text: "text-slate-600", label: "Sold" },
    withdrawn: { bg: "bg-slate-100", text: "text-slate-600", label: "Withdrawn" },
    expired: { bg: "bg-slate-100", text: "text-slate-600", label: "Expired" },
    cancelled: { bg: "bg-slate-100", text: "text-slate-600", label: "Cancelled" },
  };

  const config = statusConfig[status] || {
    bg: "bg-slate-100",
    text: "text-slate-600",
    label: status,
  };

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

// Boston neighborhood whitelist
const BOSTON_NEIGHBORHOODS = new Set(
  [
    "allston", "back bay", "bay village", "beacon hill", "brighton",
    "charlestown", "chinatown", "dorchester", "downtown", "east boston",
    "fenway", "fenway-kenmore", "hyde park", "jamaica plain", "mattapan",
    "mission hill", "north end", "roslindale", "roxbury", "south boston",
    "south boston waterfront", "south end", "west end", "west roxbury",
    "seaport", "leather district", "financial district"
  ].map(s => s.toLowerCase())
);

const norm = (s?: string) => (s || "").trim().toLowerCase();

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const sanitizeStreet = (raw?: string) => {
  const s = (raw || "").trim();
  if (!s) return "";
  // strip repeated ", City, ST ZIP" chunks at end
  return s.replace(/(?:,\s*[^,]+,\s*[A-Za-z]{2}\s*\d{5})+$/i, "").trim();
};

const extractZipFromAddress = (raw?: string) => {
  const s = (raw || "");
  const m = s.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : "";
};

const getLocation = (listing: Listing) => {
  const street = sanitizeStreet(listing.address);

  const cityRaw = (listing.city || "").trim();
  const neighborhoodRaw = (listing.neighborhood || "").trim();

  const neighborhood = neighborhoodRaw
    ? neighborhoodRaw.replace(/^boston\s*[-,]\s*/i, "").trim()
    : "";

  const neighborhoodKey = norm(neighborhood);

  const isBoston =
    norm(cityRaw) === "boston" ||
    (neighborhoodKey && BOSTON_NEIGHBORHOODS.has(neighborhoodKey));

  // ZIP: prefer listing.zip_code unless missing/00000, then extract from address
  const zipRaw = (listing.zip_code || "").trim();
  const zip =
    zipRaw && zipRaw !== "00000" ? zipRaw : (extractZipFromAddress(listing.address) || "");

  const state = ((listing.state || "MA").trim().toUpperCase() || "MA");

  // City: if Boston forced, city is Boston; otherwise city is the listing city
  const city = isBoston ? "Boston" : titleCase(cityRaw || "");

  // If not Boston and neighborhood equals the city (like "Northborough"), don't show it as a separate line
  const showNeighborhood =
    isBoston ? !!neighborhood : (!!neighborhood && norm(neighborhood) !== norm(city));

  return {
    street,
    city,
    state,
    zip,
    neighborhood: neighborhood ? titleCase(neighborhood) : "",
    isBoston,
    showNeighborhood,
  };
};

const ListingResultsTable = ({
  listings,
  loading,
  sortColumn,
  sortDirection,
  onSort,
  onRowClick,
  filters,
  fromPath,
}: ListingResultsTableProps) => {
  const navigate = useNavigate();
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState("date_new");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [hotSheetDialogOpen, setHotSheetDialogOpen] = useState(false);
  const [saveSearchDialogOpen, setSaveSearchDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [contactListing, setContactListing] = useState<Listing | null>(null);
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

  // Generate search summary for default name
  const searchSummary = useMemo(() => {
    const parts: string[] = [];
    
    // Towns
    if (filters?.selectedTowns && filters.selectedTowns.length > 0) {
      parts.push(filters.selectedTowns.slice(0, 2).join(", ") + (filters.selectedTowns.length > 2 ? ` +${filters.selectedTowns.length - 2}` : ""));
    } else if (filters?.state) {
      parts.push(filters.state);
    }
    
    // Beds
    if (filters?.bedsMin) {
      parts.push(`${filters.bedsMin}+ Beds`);
    }
    
    // Price
    if (filters?.priceMin || filters?.priceMax) {
      const min = filters.priceMin ? `$${Math.round(parseInt(filters.priceMin) / 1000)}k` : "";
      const max = filters.priceMax ? `$${Math.round(parseInt(filters.priceMax) / 1000)}k` : "";
      if (min && max) {
        parts.push(`${min}–${max}`);
      } else if (min) {
        parts.push(`${min}+`);
      } else if (max) {
        parts.push(`Up to ${max}`);
      }
    }
    
    return parts.join(" • ") || `Search ${new Date().toLocaleDateString()}`;
  }, [filters]);

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
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };


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
        <div className="rounded-2xl border border-slate-200 bg-[#F7F6F3] px-8 py-10 text-center">
          <p className="text-base font-medium text-slate-900">No listings found</p>
          <p className="text-sm text-slate-500 mt-1">Try adjusting your search filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sticky Action Bar */}
      <div className="sticky top-0 z-30 bg-[#FAFAF8] px-5 py-4">
        {/* Select All / Actions Row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
            className="h-9 px-4 text-sm font-medium rounded-xl bg-white border-slate-200 text-slate-700 hover:text-emerald-600 hover:bg-transparent hover:border-slate-300 transition-colors"
          >
            {selectedRows.size === displayedListings.length && displayedListings.length > 0 ? "Deselect All" : "Select All"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedRows.size === 0 && !showSelectedOnly}
            onClick={handleKeepSelected}
            className="h-9 px-4 text-sm font-medium rounded-xl bg-white border-slate-200 text-slate-700 hover:text-emerald-600 hover:bg-transparent hover:border-slate-300 transition-colors disabled:opacity-50"
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
            onClick={() => setSaveSearchDialogOpen(true)}
            className="h-9 px-4 text-sm font-medium rounded-xl bg-white border-slate-200 text-slate-700 hover:text-emerald-600 hover:bg-transparent hover:border-slate-300 transition-colors"
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
            variant="outline"
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
            className="h-9 px-4 text-sm font-medium rounded-xl bg-white border-slate-200 text-slate-700 hover:text-emerald-600 hover:bg-transparent hover:border-slate-300 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            Save as Hot Sheet
          </Button>
          
          {/* Sort Dropdown - inline */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-slate-500">Sort by:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px] h-9 text-sm rounded-xl border-slate-200 bg-white focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 bg-white">
                <SelectItem value="date_new">Date (New)</SelectItem>
                <SelectItem value="date_old">Date (Old)</SelectItem>
                <SelectItem value="price_high">Price (High)</SelectItem>
                <SelectItem value="price_low">Price (Low)</SelectItem>
                <SelectItem value="sqft">Square Feet</SelectItem>
                <SelectItem value="beds">Bedrooms</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {selectedRows.size > 0 && (
            <span className="text-sm text-slate-500 ml-2 font-medium">
              {selectedRows.size} selected
            </span>
          )}
        </div>
      </div>
      <div className="h-4" />

      {/* Hot Sheet Dialog */}
      <SaveToHotSheetDialog
        open={hotSheetDialogOpen}
        onOpenChange={setHotSheetDialogOpen}
        currentSearch={buildHotSheetCriteria()}
        selectedListingIds={Array.from(selectedRows)}
      />

      {/* Save Search Dialog */}
      <SaveSearchDialog
        open={saveSearchDialogOpen}
        onOpenChange={setSaveSearchDialogOpen}
        searchSummary={searchSummary}
      />

      {/* MOBILE: Card List (< md) */}
      <div className="md:hidden space-y-3">
        {displayedListings.map((listing) => (
          <ListingResultCard
            key={listing.id}
            listing={listing}
            isSelected={selectedRows.has(listing.id)}
            onSelect={toggleRowSelection}
            onRowClick={onRowClick}
            fromPath={fromPath}
          />
        ))}
      </div>

      {/* DESKTOP: Table/Grid (md+) */}
      <div className="hidden md:block overflow-x-auto px-5 pb-6">
        {/* Responsive min-widths: md=720px, lg=920px, xl=1100px */}
        <div className="min-w-[720px] lg:min-w-[920px] xl:min-w-[1100px] space-y-3">
          {/* Header Row */}
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 mb-3">
            {/* Responsive grid: md=compact, lg=+SqFt/DOM, xl=+Agent */}
            <div className="grid grid-cols-[170px_minmax(240px,1fr)_100px_60px_60px_100px] lg:grid-cols-[170px_minmax(260px,1fr)_100px_60px_60px_80px_60px_100px] xl:grid-cols-[170px_minmax(280px,1fr)_100px_60px_60px_80px_60px_180px_100px] gap-3 items-center">
              <div className="text-xs font-medium text-slate-500"></div>
              <div className="text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-900 flex items-center gap-1" onClick={() => onSort("address")}>
                Address
                <ArrowUpDown className={`h-3 w-3 ${sortColumn === "address" ? "text-slate-700" : "text-slate-400"}`} />
              </div>
              <div className="text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-900 flex items-center gap-1" onClick={() => onSort("price")}>
                Price
                <ArrowUpDown className={`h-3 w-3 ${sortColumn === "price" ? "text-slate-700" : "text-slate-400"}`} />
              </div>
              <div className="text-xs font-medium text-slate-500 text-center cursor-pointer hover:text-slate-900 flex items-center justify-center gap-1" onClick={() => onSort("bedrooms")}>
                Beds
                <ArrowUpDown className={`h-3 w-3 ${sortColumn === "bedrooms" ? "text-slate-700" : "text-slate-400"}`} />
              </div>
              <div className="text-xs font-medium text-slate-500 text-center cursor-pointer hover:text-slate-900 flex items-center justify-center gap-1" onClick={() => onSort("bathrooms")}>
                Baths
                <ArrowUpDown className={`h-3 w-3 ${sortColumn === "bathrooms" ? "text-slate-700" : "text-slate-400"}`} />
              </div>
              {/* SqFt: hidden at md, visible at lg+ */}
              <div className="hidden lg:flex text-xs font-medium text-slate-500 text-center cursor-pointer hover:text-slate-900 items-center justify-center gap-1" onClick={() => onSort("square_feet")}>
                SqFt
                <ArrowUpDown className={`h-3 w-3 ${sortColumn === "square_feet" ? "text-slate-700" : "text-slate-400"}`} />
              </div>
              {/* DOM: hidden at md, visible at lg+ */}
              <div className="hidden lg:flex text-xs font-medium text-slate-500 text-center cursor-pointer hover:text-slate-900 items-center justify-center gap-1" onClick={() => onSort("list_date")}>
                DOM
                <ArrowUpDown className={`h-3 w-3 ${sortColumn === "list_date" ? "text-slate-700" : "text-slate-400"}`} />
              </div>
              {/* Agent: hidden at md/lg, visible at xl+ */}
              <div className="hidden xl:block text-xs font-medium text-slate-500">Agent</div>
              <div className="text-xs font-medium text-slate-500"></div>
            </div>
          </div>

          {/* Listing Cards */}
          {displayedListings.map((listing, idx) => {
          const thumbnail = getThumbnail(listing);
          const pricePerSqFt = getPricePerSqFt(listing.price, listing.square_feet);
          const openHouseInfo = getOpenHouseInfo(listing);
          const isExpanded = expandedId === listing.id;

          return (
            <div
              key={listing.id}
              ref={(el) => { if (el) rowRefs.set(listing.id, el as any); }}
              tabIndex={0}
              aria-expanded={isExpanded}
              onKeyDown={(e) => onRowKeyDown(e, listing, idx)}
              onClick={() => {
                onRowClick(listing);
                toggleExpand(listing.id);
              }}
            className={[
                "rounded-2xl border border-slate-200/70 bg-white px-4 py-3 cursor-pointer outline-none transition-colors",
                "hover:bg-slate-50",
                "focus-visible:ring-0 focus-visible:ring-offset-0",
                isExpanded ? "bg-slate-50" : ""
              ].join(" ")}
            >
              {/* Main Row Content - Responsive grid matching header */}
              <div className="grid grid-cols-[170px_minmax(240px,1fr)_100px_60px_60px_100px] lg:grid-cols-[170px_minmax(260px,1fr)_100px_60px_60px_80px_60px_100px] xl:grid-cols-[170px_minmax(280px,1fr)_100px_60px_60px_80px_60px_180px_100px] gap-3 items-start">
                {/* Photo with Checkbox Overlay */}
                <div className="relative">
                  {/* Checkbox overlay */}
                  <button
                    onClick={(e) => toggleRowSelection(listing.id, e)}
                    className="absolute left-2 top-2 z-10 h-5 w-5 rounded-md border border-white/80 bg-white/90 shadow-sm flex items-center justify-center"
                    aria-label="Select listing"
                  >
                    {selectedRows.has(listing.id) && <Check className="h-3 w-3 text-emerald-600" />}
                  </button>

                  {/* Photo */}
                  <div className={[
                    "relative h-[84px] w-[148px] overflow-hidden rounded-lg bg-slate-50",
                    selectedRows.has(listing.id) ? "border-emerald-400 ring-2 ring-emerald-300/20 border" : "border border-slate-200/70"
                  ].join(" ")}>
                    {thumbnail ? (
                      <img src={thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                        No photo
                      </div>
                    )}
                    {getPhotoCount(listing) > 0 && (
                      <div className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                        {getPhotoCount(listing)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div>
                  {(() => {
                    const loc = getLocation(listing);
                    
                    // Build micro-facts line
                    const microFacts: string[] = [];
                    if (listing.annual_property_tax) {
                      microFacts.push(`Tax $${(listing.annual_property_tax / 1000).toFixed(1)}k/yr`);
                    }
                    if (listing.hoa_monthly) {
                      microFacts.push(`HOA $${listing.hoa_monthly}/mo`);
                    }
                    if (listing.year_built) {
                      microFacts.push(`Built ${listing.year_built}`);
                    }
                    const parking = listing.garage_spaces || listing.total_parking_spaces;
                    if (parking) {
                      microFacts.push(`${parking} pkg`);
                    }
                    const style = getPropertyStyle(listing);
                    if (style) {
                      microFacts.push(style);
                    }
                    
                      return (
                        <>
                          {/* Street + Status Badge Row */}
                          <div className="flex items-start justify-between gap-2">
                            <a
                              href="#"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                navigate(`/property/${listing.id}`, { state: { from: fromPath } });
                              }}
                              className="text-sm font-semibold text-slate-900 hover:text-emerald-600 transition-colors"
                            >
                              {loc.street}{listing.unit_number ? ` #${listing.unit_number}` : ""}
                            </a>
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {loc.city}{loc.city ? "," : ""} {loc.state}{loc.zip ? ` ${loc.zip}` : ""}
                          </div>

                          {loc.showNeighborhood && (
                            <div className="mt-0.5 text-xs text-slate-500">
                              {loc.neighborhood}
                            </div>
                          )}

                          {/* Listing Number + Status */}
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); navigate(`/property/${listing.id}`, { state: { from: fromPath } }); }}
                              className="text-[11px] font-mono text-slate-600 hover:text-emerald-600 transition-colors"
                            >
                              #{listing.listing_number}
                            </button>
                            {getStatusBadge(listing.status)}
                          </div>

                          {/* Micro-facts line */}
                          {microFacts.length > 0 && (
                            <div className="mt-1 flex items-center overflow-hidden whitespace-nowrap text-[11px] text-slate-500">
                              <span className="truncate">{microFacts.join(" • ")}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                </div>

                {/* Price */}
                <div>
                  <div className="text-sm font-semibold text-slate-900">{formatPrice(listing.price)}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {pricePerSqFt ? `$${pricePerSqFt}/sqft` : ""}
                  </div>
                </div>

                {/* Beds */}
                <div className="text-sm text-center text-slate-700">{listing.bedrooms || "-"}</div>

                {/* Baths */}
                <div className="text-sm text-center text-slate-700">{listing.bathrooms || "-"}</div>

                {/* SqFt: hidden at md, visible at lg+ */}
                <div className="hidden lg:block text-sm text-center text-slate-700">
                  {listing.square_feet?.toLocaleString() || "-"}
                </div>

                {/* DOM: hidden at md, visible at lg+ */}
                <div className="hidden lg:block text-sm text-center text-slate-700">
                  {getDaysOnMarket(listing.list_date)}
                </div>

                {/* Agent: hidden at md/lg, visible at xl+ */}
                <div className="hidden xl:block">
                  <div className="text-sm font-semibold text-slate-900 truncate max-w-[180px]">{listing.agent_name || ""}</div>
                  {listing.list_office && (
                    <div className="mt-0.5 text-xs text-slate-500 truncate max-w-[180px]">
                      {listing.list_office}
                    </div>
                  )}
                  {listing.list_agent_phone && formatPhoneNumber(listing.list_agent_phone) !== "—" && (
                    <div className="mt-0.5 text-xs text-slate-500">
                      {formatPhoneNumber(listing.list_agent_phone)}
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContactListing(listing);
                    }}
                    className="mt-1 text-xs text-slate-600 hover:text-emerald-600 transition-colors"
                  >
                    Contact
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-200 text-slate-700 hover:text-emerald-600 hover:bg-transparent hover:border-slate-300"
                    onClick={() => navigate(`/property/${listing.id}`, { state: { from: fromPath } })}
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span className="ml-2 hidden lg:inline">View</span>
                  </Button>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-200/70">
                  <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
                    {/* Left: photo preview */}
                    <div className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-3">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Preview
                      </div>
                      <div className="mt-3 h-[200px] rounded-lg overflow-hidden border border-slate-200/70 bg-slate-50">
                        {thumbnail ? (
                          <img src={thumbnail} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-400">
                            No photos available
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" className="border-slate-200 text-slate-700 hover:text-emerald-600 hover:bg-transparent hover:border-slate-300" onClick={(e) => { e.stopPropagation(); setContactListing(listing); }}>
                          Contact
                        </Button>
                        <Button size="sm" variant="outline" className="border-slate-200 text-slate-700 hover:text-emerald-600 hover:bg-transparent hover:border-slate-300" onClick={(e) => { e.stopPropagation(); navigate(`/property/${listing.id}`, { state: { from: fromPath } }); }}>
                          View Details
                        </Button>
                      </div>
                    </div>

                    {/* Right: quick facts */}
                    <div className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-3">
                      <div className="flex items-start justify-between gap-4">
                        {(() => {
                          const loc = getLocation(listing);
                          return (
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {loc.street}{listing.unit_number ? ` #${listing.unit_number}` : ""}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {loc.city}{loc.city ? "," : ""} {loc.state}{loc.zip ? ` ${loc.zip}` : ""}
                                {loc.showNeighborhood ? ` • ${loc.neighborhood}` : ""}
                              </div>
                            </div>
                          );
                        })()}
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-900">{formatPrice(listing.price)}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            DOM {getDaysOnMarket(listing.list_date)}
                          </div>
                        </div>
                      </div>

                      {/* Property Details */}
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <div className="rounded-lg border border-slate-200/70 bg-white p-3">
                          <div className="text-[11px] text-slate-500 uppercase tracking-wider">Beds</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">{listing.bedrooms || "—"}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200/70 bg-white p-3">
                          <div className="text-[11px] text-slate-500 uppercase tracking-wider">Baths</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">{listing.bathrooms || "—"}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200/70 bg-white p-3">
                          <div className="text-[11px] text-slate-500 uppercase tracking-wider">Sq Ft</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {listing.square_feet ? listing.square_feet.toLocaleString() : "—"}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200/70 bg-white p-3">
                          <div className="text-[11px] text-slate-500 uppercase tracking-wider">Status</div>
                          <div className="mt-1">{getStatusBadge(listing.status)}</div>
                        </div>
                        {getPropertyStyle(listing) && (
                          <div className="rounded-lg border border-slate-200/70 bg-white p-3">
                            <div className="text-[11px] text-slate-500 uppercase tracking-wider">Type</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{getPropertyStyle(listing)}</div>
                          </div>
                        )}
                        {listing.year_built && (
                          <div className="rounded-lg border border-slate-200/70 bg-white p-3">
                            <div className="text-[11px] text-slate-500 uppercase tracking-wider">Year Built</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{listing.year_built}</div>
                          </div>
                        )}
                        {listing.lot_size && (
                          <div className="rounded-lg border border-slate-200/70 bg-white p-3">
                            <div className="text-[11px] text-slate-500 uppercase tracking-wider">Lot Size</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{formatLotSize(listing.lot_size)}</div>
                          </div>
                        )}
                        {listing.total_parking_spaces && (
                          <div className="rounded-lg border border-slate-200/70 bg-white p-3">
                            <div className="text-[11px] text-slate-500 uppercase tracking-wider">Parking</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{listing.total_parking_spaces}</div>
                          </div>
                        )}
                        {listing.annual_property_tax && (
                          <div className="rounded-lg border border-slate-200/70 bg-white p-3">
                            <div className="text-[11px] text-slate-500 uppercase tracking-wider">Annual Tax</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">${listing.annual_property_tax.toLocaleString()}</div>
                          </div>
                        )}
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
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>

      {/* Contact Agent Dialog (controlled) */}
      {contactListing && (() => {
        const loc = getLocation(contactListing);
        const fullAddress = `${loc.street}${contactListing.unit_number ? ` #${contactListing.unit_number}` : ""}, ${loc.city} ${loc.state}`;
        return (
          <ContactAgentDialog
            listingId={contactListing.id}
            agentId={contactListing.agent_id}
            listingAddress={fullAddress}
            open={!!contactListing}
            onOpenChange={(open) => !open && setContactListing(null)}
            hideTrigger
          />
        );
      })()}
    </div>
  );
};

export default ListingResultsTable;

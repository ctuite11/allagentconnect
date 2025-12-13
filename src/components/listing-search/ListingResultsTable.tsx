import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, ExternalLink, MessageSquare, Users, Check, FileSpreadsheet, Eye, EyeOff, Bookmark, CalendarDays, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { FilterState } from "@/components/listing-search/ListingSearchFilters";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";

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

const formatAddress = (listing: Listing) => {
  let addr = listing.address;
  if (listing.unit_number) {
    addr += ` #${listing.unit_number}`;
  }
  return addr;
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
  const [hotSheetName, setHotSheetName] = useState("");
  const [savingHotSheet, setSavingHotSheet] = useState(false);

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

  // Build hot sheet criteria from filters
  const handleSaveHotSheet = async () => {
    if (!hotSheetName.trim()) {
      toast.error("Please enter a name for this hot sheet");
      return;
    }

    setSavingHotSheet(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to save hot sheets");
        return;
      }

      const criteria = {
        state: filters?.state,
        county: filters?.county,
        cities: filters?.selectedTowns,
        property_types: filters?.propertyTypes,
        min_price: filters?.priceMin ? parseInt(filters.priceMin) : null,
        max_price: filters?.priceMax ? parseInt(filters.priceMax) : null,
        bedrooms: filters?.bedsMin ? parseInt(filters.bedsMin) : null,
        bathrooms: filters?.bathsMin ? parseFloat(filters.bathsMin) : null,
        statuses: filters?.statuses,
      };

      const { error } = await supabase
        .from("hot_sheets")
        .insert({
          user_id: user.id,
          name: hotSheetName.trim(),
          criteria,
          is_active: true,
        });

      if (error) throw error;

      toast.success("Hot sheet saved! You'll be notified of new matching listings.");
      setHotSheetDialogOpen(false);
      setHotSheetName("");
    } catch (error: any) {
      console.error("Error saving hot sheet:", error);
      toast.error("Failed to save hot sheet");
    } finally {
      setSavingHotSheet(false);
    }
  };

  const toggleRowSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
      className={`cursor-pointer hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-600 whitespace-nowrap ${className}`}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown 
          className={`h-3 w-3 ${sortColumn === column ? "text-slate-900" : "text-slate-300"}`} 
        />
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full bg-slate-100" />
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-base font-medium text-slate-700">No listings found</p>
          <p className="text-sm text-slate-500 mt-1">Try adjusting your search filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
            className="h-9 px-4 text-sm font-medium border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            {selectedRows.size === displayedListings.length && displayedListings.length > 0 ? "Deselect All" : "Select All"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedRows.size === 0 && !showSelectedOnly}
            onClick={handleKeepSelected}
            className="h-9 px-4 text-sm font-medium border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
            className="h-9 px-4 text-sm font-medium border-slate-300 text-slate-700 hover:bg-slate-50"
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
            onClick={() => setHotSheetDialogOpen(true)}
            className="h-9 px-4 text-sm font-medium border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            Save as Hot Sheet
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Sort by:</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[150px] h-9 text-sm border-slate-300">
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

      {/* Results Table */}
      <div className="overflow-auto bg-white rounded-lg border border-slate-200">

        {/* Hot Sheet Dialog */}
        <Dialog open={hotSheetDialogOpen} onOpenChange={setHotSheetDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Save Search as Hot Sheet</DialogTitle>
              <DialogDescription>
                Get notified when new listings match your current filters
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="hotSheetName">Hot Sheet Name *</Label>
                <Input
                  id="hotSheetName"
                  placeholder="e.g., Boston 3BR Under 500k"
                  value={hotSheetName}
                  onChange={(e) => setHotSheetName(e.target.value)}
                />
              </div>
              {filters && (
                <div className="text-sm text-slate-500 space-y-1">
                  <p className="font-medium text-slate-700">Current filters:</p>
                  {filters.selectedTowns.length > 0 && (
                    <p>Towns: {filters.selectedTowns.join(", ")}</p>
                  )}
                  {filters.propertyTypes.length > 0 && (
                    <p>Types: {filters.propertyTypes.join(", ")}</p>
                  )}
                  {(filters.priceMin || filters.priceMax) && (
                    <p>Price: {filters.priceMin || "Any"} - {filters.priceMax || "Any"}</p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setHotSheetDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveHotSheet} disabled={savingHotSheet}>
                {savingHotSheet ? "Saving..." : "Save Hot Sheet"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-slate-200">
            <TableHead className="w-10 text-xs font-semibold text-slate-600">
              <div 
                className="w-4 h-4 border border-slate-300 rounded cursor-pointer flex items-center justify-center hover:bg-slate-100"
                onClick={toggleSelectAll}
              >
                {selectedRows.size === displayedListings.length && displayedListings.length > 0 && (
                  <Check className="w-3 h-3 text-slate-700" />
                )}
              </div>
            </TableHead>
            <TableHead className="w-28 text-xs font-semibold text-slate-600">Photo</TableHead>
            <SortableHeader column="address">Address</SortableHeader>
            <SortableHeader column="price">Price</SortableHeader>
            <TableHead className="text-xs font-semibold text-slate-600 text-right">$/SqFt</TableHead>
            <SortableHeader column="bedrooms" className="text-center">Beds</SortableHeader>
            <SortableHeader column="bathrooms" className="text-center">Baths</SortableHeader>
            <SortableHeader column="square_feet" className="text-right">SqFt</SortableHeader>
            <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
            <SortableHeader column="list_date" className="text-center">DOM</SortableHeader>
            <TableHead className="text-xs font-semibold text-slate-600">Agent</TableHead>
            <TableHead className="w-40"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayedListings.map(listing => {
            const thumbnail = getThumbnail(listing);
            const isOffMarket = listing.status === "off_market";
            const pricePerSqFt = getPricePerSqFt(listing.price, listing.square_feet);
            const openHouseInfo = getOpenHouseInfo(listing);
            
            return (
              <TableRow
                key={listing.id}
                className={`cursor-pointer transition-all group hover:bg-slate-50 hover:shadow-sm ${
                  isOffMarket ? "bg-rose-50/30" : ""
                } ${selectedRows.has(listing.id) ? "bg-blue-50" : ""}`}
                onClick={() => onRowClick(listing)}
              >
                {/* Checkbox */}
                <TableCell className="py-4 align-top" onClick={(e) => toggleRowSelection(listing.id, e)}>
                  <div 
                    className={`w-4 h-4 border rounded cursor-pointer flex items-center justify-center mt-1 ${
                      selectedRows.has(listing.id) 
                        ? "bg-slate-700 border-slate-700" 
                        : "border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {selectedRows.has(listing.id) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                </TableCell>

                {/* Thumbnail - 3x larger */}
                <TableCell className="py-4 align-top">
                  <div className="w-24 h-20 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 shadow-sm">
                    {thumbnail ? (
                      <img 
                        src={thumbnail} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Home className="w-8 h-8 text-slate-300" />
                      </div>
                    )}
                  </div>
                </TableCell>

                {/* Address with bottom info bar */}
                <TableCell className="py-4">
                  <div className="space-y-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 max-w-[240px] truncate">
                        {formatAddress(listing)}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {listing.city}, {listing.state} {listing.zip_code}
                        {listing.neighborhood && (
                          <span className="ml-1 text-slate-400">• {listing.neighborhood}</span>
                        )}
                      </div>
                    </div>
                    {/* Bottom info bar */}
                    <div className="flex items-center gap-3 text-xs">
                      {openHouseInfo?.hasPublicOpen && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                          <CalendarDays className="w-3.5 h-3.5" />
                          Open House
                        </span>
                      )}
                      {openHouseInfo?.hasBrokerOpen && (
                        <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                          <CalendarDays className="w-3.5 h-3.5" />
                          Broker Open
                        </span>
                      )}
                      <span className="text-xs text-slate-400 font-mono">
                        #{listing.listing_number}
                      </span>
                    </div>
                  </div>
                </TableCell>

                {/* Price */}
                <TableCell className="py-4 align-top">
                  <span className="text-base font-bold text-slate-900">
                    {formatPrice(listing.price)}
                  </span>
                </TableCell>

                {/* $/SqFt */}
                <TableCell className="py-4 align-top text-right">
                  <span className="text-sm text-slate-600">
                    {pricePerSqFt ? `$${pricePerSqFt.toLocaleString()}` : "-"}
                  </span>
                </TableCell>

                {/* Beds */}
                <TableCell className="text-sm text-center text-slate-700 py-4 align-top">
                  {listing.bedrooms || "-"}
                </TableCell>

                {/* Baths */}
                <TableCell className="text-sm text-center text-slate-700 py-4 align-top">
                  {listing.bathrooms || "-"}
                </TableCell>

                {/* SqFt */}
                <TableCell className="text-sm text-right text-slate-700 py-4 align-top">
                  {listing.square_feet?.toLocaleString() || "-"}
                </TableCell>

                {/* Status - Large and prominent */}
                <TableCell className="py-4 align-top">
                  {getStatusBadge(listing.status)}
                </TableCell>

                {/* DOM */}
                <TableCell className="text-sm text-center text-slate-600 py-4 align-top">
                  {getDaysOnMarket(listing.list_date)}
                </TableCell>

                {/* Agent */}
                <TableCell className="text-sm text-slate-600 truncate max-w-[140px] py-4 align-top">
                  {listing.agent_name || "-"}
                </TableCell>

                {/* Quick Actions */}
                <TableCell className="py-4 align-top" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs font-medium border-primary text-primary hover:bg-muted hover:text-primary"
                      title="Contact Agent"
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                      Contact
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => navigate(`/property/${listing.id}`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
};

export default ListingResultsTable;

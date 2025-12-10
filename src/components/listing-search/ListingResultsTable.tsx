import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, ExternalLink, MessageSquare, Users, Check, Share2, FileSpreadsheet, Eye, EyeOff, Bookmark } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { FilterState } from "@/components/listing-search/ListingSearchFilters";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

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

// Premium status badge with consistent styling
const getStatusBadge = (status: string) => {
  // Using design system colors for badges
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "bg-[hsl(142,76%,95%)]", text: "text-[hsl(142,76%,22%)]", label: "Active" },
    new: { bg: "bg-[hsl(142,76%,95%)]", text: "text-[hsl(142,76%,22%)]", label: "Active" },
    coming_soon: { bg: "bg-[hsl(45,93%,94%)]", text: "text-[hsl(32,95%,30%)]", label: "Coming Soon" },
    off_market: { bg: "bg-[hsl(270,91%,96%)]", text: "text-[hsl(271,91%,30%)]", label: "Off-Market" },
    back_on_market: { bg: "bg-[hsl(142,76%,95%)]", text: "text-[hsl(142,76%,22%)]", label: "Back on Market" },
    price_changed: { bg: "bg-[hsl(217,91%,95%)]", text: "text-[hsl(217,91%,35%)]", label: "Price Change" },
    under_agreement: { bg: "bg-[hsl(270,91%,96%)]", text: "text-[hsl(271,91%,30%)]", label: "Under Agreement" },
    pending: { bg: "bg-[hsl(270,91%,96%)]", text: "text-[hsl(271,91%,30%)]", label: "Pending" },
    sold: { bg: "bg-[hsl(220,14%,96%)]", text: "text-[hsl(220,9%,35%)]", label: "Sold" },
    withdrawn: { bg: "bg-[hsl(220,14%,96%)]", text: "text-[hsl(220,9%,46%)]", label: "Withdrawn" },
    expired: { bg: "bg-[hsl(220,14%,96%)]", text: "text-[hsl(220,9%,46%)]", label: "Expired" },
    cancelled: { bg: "bg-[hsl(220,14%,96%)]", text: "text-[hsl(220,9%,46%)]", label: "Cancelled" },
  };

  const config = statusConfig[status] || { bg: "bg-[hsl(220,14%,96%)]", text: "text-[hsl(220,9%,35%)]", label: status };

  return (
    <Badge 
      className={`${config.bg} ${config.text} border-0 text-[11px] font-medium px-2.5 py-1 whitespace-nowrap rounded-xl`}
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
            variant="secondary-outline"
            size="sm"
            onClick={toggleSelectAll}
            className="h-9 px-4 text-sm font-medium"
          >
            {selectedRows.size === displayedListings.length && displayedListings.length > 0 ? "Deselect All" : "Select All"}
          </Button>
          <Button
            variant="secondary-outline"
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
            variant="secondary-outline"
            size="sm"
            onClick={handleSaveSearch}
            className="h-9 px-4 text-sm font-medium"
          >
            <Bookmark className="h-4 w-4 mr-1.5" />
            Save Search
          </Button>
          <Button
            variant="secondary-outline"
            size="sm"
            disabled={selectedRows.size === 0}
            onClick={() => {
              if (selectedRows.size === 0) return;
              const listingIds = Array.from(selectedRows);
              const shareUrl = `${window.location.origin}/listing-search?ids=${listingIds.join(",")}`;
              navigator.clipboard.writeText(shareUrl);
              toast.success(`Copied link to ${selectedRows.size} listing${selectedRows.size > 1 ? 's' : ''}`);
            }}
            className="h-9 px-4 text-sm font-medium disabled:opacity-50"
          >
            <Share2 className="h-4 w-4 mr-1.5" />
            Share
          </Button>
          <Button
            variant="secondary-outline"
            size="sm"
            onClick={() => setHotSheetDialogOpen(true)}
            className="h-9 px-4 text-sm font-medium"
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
            <TableHead className="w-16 text-xs font-semibold text-slate-600">Photo</TableHead>
            <SortableHeader column="address">Address</SortableHeader>
            <SortableHeader column="price">Price</SortableHeader>
            <SortableHeader column="bedrooms" className="text-center">Beds</SortableHeader>
            <SortableHeader column="bathrooms" className="text-center">Baths</SortableHeader>
            <SortableHeader column="square_feet" className="text-right">SqFt</SortableHeader>
            <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
            <SortableHeader column="list_date" className="text-center">DOM</SortableHeader>
            <TableHead className="text-xs font-semibold text-slate-600">Agent</TableHead>
            <TableHead className="text-xs font-semibold text-slate-600 text-right">List #</TableHead>
            <TableHead className="w-32"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayedListings.map(listing => {
            const thumbnail = getThumbnail(listing);
            const isOffMarket = listing.status === "off_market";
            
            return (
              <TableRow
                key={listing.id}
                className={`cursor-pointer transition-all group hover:bg-[hsl(220,14%,98%)] hover:shadow-[0_1px_3px_hsl(0,0%,0%,0.06)] ${
                  isOffMarket ? "bg-[hsl(270,91%,98%)]" : ""
                } ${selectedRows.has(listing.id) ? "bg-[hsl(217,91%,97%)]" : ""}`}
                onClick={() => onRowClick(listing)}
              >
                {/* Checkbox */}
                <TableCell className="py-2" onClick={(e) => toggleRowSelection(listing.id, e)}>
                  <div 
                    className={`w-4 h-4 border rounded cursor-pointer flex items-center justify-center ${
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

                {/* Thumbnail */}
                <TableCell className="py-2">
                  <div className="w-12 h-12 rounded-md bg-slate-100 overflow-hidden flex-shrink-0">
                    {thumbnail ? (
                      <img 
                        src={thumbnail} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <div className="w-6 h-6 border-2 border-dashed border-slate-300 rounded" />
                      </div>
                    )}
                  </div>
                </TableCell>

                {/* Address */}
                <TableCell className="py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 max-w-[220px] truncate">
                      {formatAddress(listing)}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {listing.city}, {listing.state}
                    </div>
                  </div>
                </TableCell>

                {/* Price */}
                <TableCell className="py-3">
                  <span className="text-base font-bold text-slate-900">
                    {formatPrice(listing.price)}
                  </span>
                </TableCell>

                {/* Beds */}
                <TableCell className="text-sm text-center text-slate-700">
                  {listing.bedrooms || "-"}
                </TableCell>

                {/* Baths */}
                <TableCell className="text-sm text-center text-slate-700">
                  {listing.bathrooms || "-"}
                </TableCell>

                {/* SqFt */}
                <TableCell className="text-sm text-right text-slate-700">
                  {listing.square_feet?.toLocaleString() || "-"}
                </TableCell>

                {/* Status - Large and prominent */}
                <TableCell className="py-3">
                  {getStatusBadge(listing.status)}
                </TableCell>

                {/* DOM */}
                <TableCell className="text-sm text-center text-slate-600">
                  {getDaysOnMarket(listing.list_date)}
                </TableCell>

                {/* Agent */}
                <TableCell className="text-sm text-slate-600 truncate max-w-[140px]">
                  {listing.agent_name || "-"}
                </TableCell>

                {/* List # (far right, subdued) */}
                <TableCell className="text-xs text-right text-slate-400 font-mono">
                  {listing.listing_number}
                </TableCell>

                {/* Quick Actions */}
                <TableCell className="py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      onClick={() => navigate(`/property/${listing.id}`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      title="Contact Agent"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      title="Match to Buyer"
                    >
                      <Users className="h-4 w-4" />
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

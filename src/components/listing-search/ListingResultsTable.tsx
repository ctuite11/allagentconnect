import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Check } from "lucide-react";
import { toast } from "sonner";

import { FilterState } from "@/components/listing-search/ListingSearchFilters";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";
import SaveToHotSheetDialog from "@/components/SaveToHotSheetDialog";

import { SearchListingCard } from "@/components/listing-search/SearchListingCard";


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
  list_office_phone?: string;
  agent_phone?: string;
  agent_email?: string;
  description?: string | null;
  num_fireplaces?: number | null;
  virtual_tour_url?: string | null;
  video_url?: string | null;
  documents?: any;
  floors?: number | null;
  active_date?: string | null;
  condo_details?: any;
  price_range_min?: number | null;
  price_range_max?: number | null;
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
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState("date_new");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [hotSheetDialogOpen, setHotSheetDialogOpen] = useState(false);
  

  // Filter listings based on selected-only mode
  const displayedListings = showSelectedOnly
    ? listings.filter((l) => selectedRows.has(l.id))
    : listings;

  const toggleSelectAll = () => {
    if (selectedRows.size === displayedListings.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(displayedListings.map((l) => l.id)));
    }
  };

  const handleKeepSelected = () => {
    setShowSelectedOnly(!showSelectedOnly);
  };

  // Generate search summary for default name
  const searchSummary = useMemo(() => {
    const parts: string[] = [];
    if (filters?.selectedTowns && filters.selectedTowns.length > 0) {
      parts.push(
        filters.selectedTowns.slice(0, 2).join(", ") +
          (filters.selectedTowns.length > 2 ? ` +${filters.selectedTowns.length - 2}` : "")
      );
    } else if (filters?.state) {
      parts.push(filters.state);
    }
    if (filters?.bedsMin) parts.push(`${filters.bedsMin}+ Beds`);
    if (filters?.priceMin || filters?.priceMax) {
      const min = filters.priceMin ? `$${Math.round(parseInt(filters.priceMin) / 1000)}k` : "";
      const max = filters.priceMax ? `$${Math.round(parseInt(filters.priceMax) / 1000)}k` : "";
      if (min && max) parts.push(`${min}–${max}`);
      else if (min) parts.push(`${min}+`);
      else if (max) parts.push(`Up to ${max}`);
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
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-8 py-10 text-center">
          <p className="text-base font-medium text-zinc-900">No listings found</p>
          <p className="text-sm text-zinc-500 mt-1">Try adjusting your search filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sticky Action Bar */}
      <div className="sticky top-0 z-30 bg-white px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
            className="h-9 px-4 text-sm font-medium rounded-xl bg-white border-zinc-200 text-zinc-700 hover:text-emerald-600 hover:bg-transparent hover:border-zinc-300 transition-colors"
          >
            {selectedRows.size === displayedListings.length && displayedListings.length > 0
              ? "Deselect All"
              : "Select All"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedRows.size === 0 && !showSelectedOnly}
            onClick={handleKeepSelected}
            className="h-9 px-4 text-sm font-medium rounded-xl bg-white border-zinc-200 text-zinc-700 hover:text-emerald-600 hover:bg-transparent hover:border-zinc-300 transition-colors disabled:opacity-50"
          >
            {showSelectedOnly ? (
              <>
                <Check className="h-4 w-4 mr-1.5 text-[hsl(221,92%,51%)]" />
                Show All
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1.5 text-[hsl(221,92%,51%)]" />
                Keep Selected
              </>
            )}
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
            className="h-9 px-4 text-sm font-medium rounded-xl bg-white border-zinc-200 text-zinc-700 hover:text-emerald-600 hover:bg-transparent hover:border-zinc-300 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            Save as Hot Sheet
          </Button>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-zinc-500">Sort by:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px] h-9 text-sm rounded-xl border-zinc-200 bg-white focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-zinc-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-zinc-200 bg-white">
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
            <span className="text-sm text-zinc-500 ml-2 font-medium">
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
          <SearchListingCard
            key={listing.id}
            listing={listing}
            isSelected={selectedRows.has(listing.id)}
            onSelect={toggleRowSelection}
            onRowClick={onRowClick}
            fromPath={fromPath}
          />
        ))}
      </div>

      {/* DESKTOP: Card Stack (md+) */}
      <div className="hidden md:block px-5 pb-6 space-y-3">
        {displayedListings.map((listing) => (
          <SearchListingCard
            key={listing.id}
            listing={listing}
            isSelected={selectedRows.has(listing.id)}
            onSelect={toggleRowSelection}
            onRowClick={onRowClick}
            fromPath={fromPath}
          />
        ))}
      </div>
    </div>
  );
};

export default ListingResultsTable;

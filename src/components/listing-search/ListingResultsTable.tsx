import { Skeleton } from "@/components/ui/skeleton";
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
  selectedRows: Set<string>;
  onToggleSelect: (id: string, e?: React.SyntheticEvent) => void;
  fromPath?: string;
}

const ListingResultsTable = ({
  listings,
  loading,
  onRowClick,
  selectedRows,
  onToggleSelect,
  fromPath,
}: ListingResultsTableProps) => {
  if (loading) {
    return (
      <div className="space-y-3">
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
    <div className="space-y-3">
      {listings.map((listing) => (
        <SearchListingCard
          key={listing.id}
          listing={listing}
          isSelected={selectedRows.has(listing.id)}
          onSelect={onToggleSelect}
          onRowClick={onRowClick}
          fromPath={fromPath}
        />
      ))}
    </div>
  );
};

export default ListingResultsTable;

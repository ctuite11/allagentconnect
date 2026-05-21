import { SearchListingCard } from "@/components/listing-search/SearchListingCard";
import {
  listingAgentContactFromRow,
  listingEmailSubjectFromRow,
} from "@/lib/listingAgentContact";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";

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
  showAgentEmailContact?: boolean;
}

const ListingResultsTable = ({
  listings,
  loading,
  onRowClick,
  selectedRows,
  onToggleSelect,
  fromPath,
  showAgentEmailContact = false,
}: ListingResultsTableProps) => {
  if (loading) {
    return (
      <AacMonogramLoader variant="section" className="min-h-[280px] pt-4" message="Loading results..." />
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-14 sm:py-20">
        <div className="max-w-md rounded-xl border border-dashed border-neutral-200 bg-white px-8 py-9 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <p className="text-[15px] font-semibold text-neutral-900">No listings found</p>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">Try widening location, status, price, or other filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {listings.map((listing) => (
        <SearchListingCard
          key={listing.id}
          listing={listing}
          isSelected={selectedRows.has(listing.id)}
          onSelect={onToggleSelect}
          onRowClick={onRowClick}
          fromPath={fromPath}
          showAgentEmailContact={showAgentEmailContact}
          listingAgentContact={showAgentEmailContact ? listingAgentContactFromRow(listing) : null}
          listingEmailSubject={listingEmailSubjectFromRow(listing)}
        />
      ))}
    </div>
  );
};

export default ListingResultsTable;

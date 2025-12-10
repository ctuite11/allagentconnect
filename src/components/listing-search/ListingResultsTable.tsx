import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, ExternalLink, MessageSquare, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

const ListingResultsTable = ({
  listings,
  loading,
  sortColumn,
  sortDirection,
  onSort,
  onRowClick,
}: ListingResultsTableProps) => {
  const navigate = useNavigate();

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
    <div className="overflow-auto bg-white rounded-lg border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-slate-200">
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
          {listings.map(listing => {
            const thumbnail = getThumbnail(listing);
            const isOffMarket = listing.status === "off_market";
            
            return (
              <TableRow
                key={listing.id}
                className={`cursor-pointer transition-all group hover:bg-slate-50 hover:shadow-sm ${
                  isOffMarket ? "bg-rose-50/30" : ""
                }`}
                onClick={() => onRowClick(listing)}
              >
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
  );
};

export default ListingResultsTable;

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Heart, ArrowUpDown, ChevronRight, ExternalLink } from "lucide-react";
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

const getStatusBadge = (status: string) => {
  const statusStyles: Record<string, string> = {
    new: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    coming_soon: "bg-sky-500/10 text-sky-600 border-sky-500/20",
    off_market: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    pending: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    under_agreement: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    sold: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    back_on_market: "bg-teal-500/10 text-teal-600 border-teal-500/20",
    price_changed: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    extended: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    reactivated: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  };

  const labels: Record<string, string> = {
    new: "New",
    active: "Active",
    coming_soon: "Coming Soon",
    off_market: "Off-Market",
    pending: "Pending",
    under_agreement: "Under Agmt",
    sold: "Sold",
    back_on_market: "Back on Mkt",
    price_changed: "Price Chg",
    extended: "Extended",
    reactivated: "Reactivated",
  };

  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 whitespace-nowrap ${statusStyles[status] || ""}`}>
      {labels[status] || status}
    </Badge>
  );
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

  const SortableHeader = ({ column, children, className = "" }: { column: string; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={`cursor-pointer hover:bg-muted/50 transition-colors text-xs font-semibold whitespace-nowrap ${className}`}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortColumn === column ? "text-primary" : "text-muted-foreground/50"}`} />
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-16 text-muted-foreground">
        <div className="text-center">
          <p className="text-base font-medium">No listings found</p>
          <p className="text-sm mt-1">Try adjusting your search filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow className="hover:bg-transparent border-b-2">
            <SortableHeader column="listing_number">List #</SortableHeader>
            <SortableHeader column="address">Address</SortableHeader>
            <SortableHeader column="city">Town</SortableHeader>
            <SortableHeader column="price">Price</SortableHeader>
            <SortableHeader column="bedrooms" className="text-center">Beds</SortableHeader>
            <SortableHeader column="bathrooms" className="text-center">Baths</SortableHeader>
            <SortableHeader column="square_feet" className="text-right">SqFt</SortableHeader>
            <SortableHeader column="list_date" className="text-center">DOM</SortableHeader>
            <TableHead className="text-xs font-semibold">Status</TableHead>
            <TableHead className="text-xs font-semibold">Agent</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listings.map(listing => (
            <TableRow
              key={listing.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors group"
              onClick={() => onRowClick(listing)}
            >
              <TableCell className="text-xs font-mono text-muted-foreground">
                {listing.listing_number}
              </TableCell>
              <TableCell className="text-sm font-medium max-w-[220px] truncate">
                {formatAddress(listing)}
              </TableCell>
              <TableCell className="text-sm">{listing.city}</TableCell>
              <TableCell className="text-sm font-semibold">{formatPrice(listing.price)}</TableCell>
              <TableCell className="text-sm text-center">{listing.bedrooms || "-"}</TableCell>
              <TableCell className="text-sm text-center">{listing.bathrooms || "-"}</TableCell>
              <TableCell className="text-sm text-right">{listing.square_feet?.toLocaleString() || "-"}</TableCell>
              <TableCell className="text-sm text-center">{getDaysOnMarket(listing.list_date)}</TableCell>
              <TableCell>{getStatusBadge(listing.status)}</TableCell>
              <TableCell className="text-sm text-muted-foreground truncate max-w-[140px]">
                {listing.agent_name || "-"}
              </TableCell>
              <TableCell onClick={e => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => navigate(`/property/${listing.id}`)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ListingResultsTable;

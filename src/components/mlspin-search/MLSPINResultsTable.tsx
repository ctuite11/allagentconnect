import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Heart, ArrowUpDown, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ListingStatusBadge } from "@/components/ui/status-badge";

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
  buyer_match_count?: number;
}

interface MLSPINResultsTableProps {
  listings: Listing[];
  loading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onRowClick: (listing: Listing) => void;
  onMessageAgent: (listing: Listing) => void;
  onSaveListing: (listing: Listing) => void;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
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

// Status badge now uses centralized StatusBadge component

const MLSPINResultsTable = ({
  listings,
  loading,
  selectedIds,
  onSelectionChange,
  onRowClick,
  onMessageAgent,
  onSaveListing,
  sortColumn,
  sortDirection,
  onSort,
}: MLSPINResultsTableProps) => {
  const allSelected = listings.length > 0 && selectedIds.length === listings.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(listings.map(l => l.id));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const SortableHeader = ({ column, children }: { column: string; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 transition-colors text-xs font-semibold whitespace-nowrap"
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
      <div className="flex-1 p-4 space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">No listings found</p>
          <p className="text-xs mt-1">Try adjusting your search filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow className="hover:bg-transparent border-b-2">
            <TableHead className="w-8 px-2">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleSelectAll}
                className="h-3.5 w-3.5"
              />
            </TableHead>
            <SortableHeader column="listing_number">List #</SortableHeader>
            <SortableHeader column="address">Address</SortableHeader>
            <SortableHeader column="city">Town</SortableHeader>
            <SortableHeader column="price">Price</SortableHeader>
            <SortableHeader column="bedrooms">Beds</SortableHeader>
            <SortableHeader column="bathrooms">Baths</SortableHeader>
            <SortableHeader column="square_feet">SqFt</SortableHeader>
            <SortableHeader column="list_date">DOM</SortableHeader>
            <TableHead className="text-xs font-semibold">Status</TableHead>
            <TableHead className="text-xs font-semibold">Match</TableHead>
            <TableHead className="text-xs font-semibold">Agent</TableHead>
            <TableHead className="w-20 text-xs font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listings.map(listing => (
            <TableRow
              key={listing.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors group"
              onClick={() => onRowClick(listing)}
            >
              <TableCell className="px-2" onClick={e => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.includes(listing.id)}
                  onCheckedChange={() => toggleSelect(listing.id, { stopPropagation: () => {} } as React.MouseEvent)}
                  className="h-3.5 w-3.5"
                />
              </TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">
                {listing.listing_number}
              </TableCell>
              <TableCell className="text-xs font-medium max-w-[200px] truncate">
                {formatAddress(listing)}
              </TableCell>
              <TableCell className="text-xs">{listing.city}</TableCell>
              <TableCell className="text-xs font-semibold">{formatPrice(listing.price)}</TableCell>
              <TableCell className="text-xs text-center">{listing.bedrooms || "-"}</TableCell>
              <TableCell className="text-xs text-center">{listing.bathrooms || "-"}</TableCell>
              <TableCell className="text-xs text-right">{listing.square_feet?.toLocaleString() || "-"}</TableCell>
              <TableCell className="text-xs text-center">{getDaysOnMarket(listing.list_date)}</TableCell>
              <TableCell><ListingStatusBadge status={listing.status} size="sm" /></TableCell>
              <TableCell>
                {listing.buyer_match_count && listing.buyer_match_count > 0 ? (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted text-foreground">
                    {listing.buyer_match_count} match{listing.buyer_match_count > 1 ? "es" : ""}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                {listing.agent_name || "-"}
              </TableCell>
              <TableCell onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onMessageAgent(listing)}
                    title="Message Agent"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onSaveListing(listing)}
                    title="Save Listing"
                  >
                    <Heart className="h-3.5 w-3.5" />
                  </Button>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default MLSPINResultsTable;

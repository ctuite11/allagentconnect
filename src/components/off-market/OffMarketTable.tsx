import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, ArrowUpRight, Lock } from "lucide-react";
import { InterestScoreBadge } from "./InterestScoreBadge";
import type { OffMarketListing } from "@/pages/OffMarketDashboard";

interface OffMarketTableProps {
  listings: OffMarketListing[];
  onChangeStatus: (listing: OffMarketListing) => void;
  onViewListing: (id: string) => void;
  onEditListing: (id: string) => void;
}

export function OffMarketTable({
  listings,
  onChangeStatus,
  onViewListing,
  onEditListing,
}: OffMarketTableProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getPropertyTypeLabel = (type: string | null) => {
    if (!type) return "—";
    return type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  if (listings.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-lg">
        <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No off-market listings</h3>
        <p className="text-muted-foreground">
          Add your first private listing to start tracking interest.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[300px]">Property</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-center">Interest</TableHead>
            <TableHead>Days Private</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listings.map((listing) => (
            <TableRow key={listing.id} className="hover:bg-muted/30">
              <TableCell>
                <div className="flex items-start gap-3">
                  {listing.photos[0] ? (
                    <img
                      src={listing.photos[0]}
                      alt={listing.address}
                      className="w-16 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-12 bg-muted rounded flex items-center justify-center">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-foreground">{listing.address}</p>
                    <p className="text-sm text-muted-foreground">
                      {listing.city}, {listing.state} {listing.zip_code}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {listing.bedrooms && (
                        <span className="text-xs text-muted-foreground">{listing.bedrooms} bed</span>
                      )}
                      {listing.bathrooms && (
                        <span className="text-xs text-muted-foreground">{listing.bathrooms} bath</span>
                      )}
                      {listing.square_feet && (
                        <span className="text-xs text-muted-foreground">{listing.square_feet.toLocaleString()} sqft</span>
                      )}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span className="font-semibold text-foreground">{formatPrice(listing.price)}</span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {getPropertyTypeLabel(listing.property_type)}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <InterestScoreBadge
                  views={listing.view_count}
                  inquiries={listing.inquiry_count}
                  saves={listing.save_count}
                />
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground">
                  {formatDistanceToNow(new Date(listing.created_at), { addSuffix: false })}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onViewListing(listing.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEditListing(listing.id)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onChangeStatus(listing)}
                    className="text-amber-600 border-amber-300 hover:bg-amber-50"
                  >
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    Change Status
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

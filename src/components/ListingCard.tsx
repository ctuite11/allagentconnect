import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, Bath, Home, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ListingCardProps {
  listing: {
    id: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    price: number;
    property_type: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    square_feet: number | null;
    status: string;
  };
  onDelete: (id: string) => void;
}

const ListingCard = ({ listing, onDelete }: ListingCardProps) => {
  const navigate = useNavigate();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold mb-2">{listing.address}</h3>
            <div className="flex items-center text-muted-foreground text-sm mb-3">
              <MapPin className="w-4 h-4 mr-1" />
              {listing.city}, {listing.state} {listing.zip_code}
            </div>
          </div>
          <Badge variant={listing.status === "active" ? "default" : "secondary"}>
            {listing.status}
          </Badge>
        </div>

        <div className="text-2xl font-bold text-primary mb-4">
          {formatPrice(listing.price)}
        </div>

        <div className="flex gap-4 mb-4 text-sm text-muted-foreground">
          {listing.bedrooms && (
            <div className="flex items-center">
              <Bed className="w-4 h-4 mr-1" />
              {listing.bedrooms} beds
            </div>
          )}
          {listing.bathrooms && (
            <div className="flex items-center">
              <Bath className="w-4 h-4 mr-1" />
              {listing.bathrooms} baths
            </div>
          )}
          {listing.square_feet && (
            <div className="flex items-center">
              <Home className="w-4 h-4 mr-1" />
              {listing.square_feet.toLocaleString()} sqft
            </div>
          )}
        </div>

        {listing.property_type && (
          <Badge variant="outline" className="mb-4">
            {listing.property_type}
          </Badge>
        )}

        <div className="flex gap-2 mt-4">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() => navigate(`/edit-listing/${listing.id}`)}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(listing.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ListingCard;

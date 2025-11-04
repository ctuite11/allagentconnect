import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, Bath, Home, Edit, Trash2, Eye, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

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
    photos?: any;
    open_houses?: any;
    listing_type?: string | null;
    created_at?: string;
    listing_number?: string | null;
  };
  onDelete: (id: string) => void;
  viewMode?: 'grid' | 'list';
}

const ListingCard = ({ listing, onDelete, viewMode = 'grid' }: ListingCardProps) => {
  const navigate = useNavigate();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getFirstPhoto = () => {
    if (listing.photos && Array.isArray(listing.photos) && listing.photos.length > 0) {
      return listing.photos[0].url || listing.photos[0];
    }
    return null;
  };

  const hasUpcomingOpenHouse = () => {
    if (!listing.open_houses || !Array.isArray(listing.open_houses)) return false;
    const now = new Date();
    return listing.open_houses.some((oh: any) => {
      const ohDate = new Date(oh.date);
      return ohDate >= now;
    });
  };

  const getNextOpenHouse = () => {
    if (!listing.open_houses || !Array.isArray(listing.open_houses)) return null;
    const now = new Date();
    const upcoming = listing.open_houses
      .filter((oh: any) => new Date(oh.date) >= now)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return upcoming[0] || null;
  };

  const photoUrl = getFirstPhoto();
  const nextOpenHouse = getNextOpenHouse();

  if (viewMode === 'list') {
    return (
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <div className="flex gap-4 p-4">
          {/* Photo with Open House Banner */}
          <div className="relative w-32 h-32 flex-shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt={listing.address} className="w-full h-full object-cover rounded" />
            ) : (
              <div className="w-full h-full bg-muted rounded flex items-center justify-center">
                <Home className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            {nextOpenHouse && (
              <div className="absolute top-0 left-0 right-0 bg-green-600 text-white text-xs font-bold px-2 py-1 text-center">
                🎈 OPEN HOUSE
              </div>
            )}
            <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
              {listing.photos?.length || 0} Photos
            </div>
          </div>

          {/* Listing Info */}
          <div className="flex-1 grid grid-cols-12 gap-4">
            <div className="col-span-6">
              <h3 className="font-semibold mb-1">{listing.address}</h3>
              <div className="flex items-center text-muted-foreground text-sm mb-2">
                <MapPin className="w-3 h-3 mr-1" />
                {listing.city}, {listing.state} {listing.zip_code}
              </div>
              {listing.listing_number && (
                <div className="text-xs text-muted-foreground mb-2">
                  Listing #{listing.listing_number}
                </div>
              )}
              <div className="flex gap-3 text-sm text-muted-foreground">
                {listing.bedrooms && (
                  <span><Bed className="w-3 h-3 inline mr-1" />{listing.bedrooms}</span>
                )}
                {listing.bathrooms && (
                  <span><Bath className="w-3 h-3 inline mr-1" />{listing.bathrooms}</span>
                )}
                {listing.square_feet && (
                  <span><Home className="w-3 h-3 inline mr-1" />{listing.square_feet.toLocaleString()} sqft</span>
                )}
              </div>
            </div>

            <div className="col-span-2">
              <Badge variant={listing.status === "active" ? "default" : "secondary"} className="mb-2">
                {listing.status}
              </Badge>
              {listing.property_type && (
                <div className="text-xs text-muted-foreground">{listing.property_type}</div>
              )}
            </div>

            <div className="col-span-2 text-right">
              <div className="text-xl font-bold text-primary mb-1">
                {formatPrice(listing.price)}
              </div>
              <div className="text-xs text-muted-foreground">
                {listing.listing_type === 'for_rent' ? 'Rental' : 'Sale'}
              </div>
              {listing.created_at && (
                <div className="text-xs text-muted-foreground mt-1">
                  Listed: {format(new Date(listing.created_at), "MM/dd/yyyy")}
                </div>
              )}
            </div>

            <div className="col-span-2 flex flex-col gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/property/${listing.id}`)}
                className="w-full"
              >
                <Eye className="w-3 h-3 mr-1" />
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/edit-listing/${listing.id}`)}
                className="w-full"
              >
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(listing.id)}
                className="w-full"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
        {nextOpenHouse && (
          <div className="bg-green-50 border-t border-green-200 px-4 py-2 text-sm">
            <Calendar className="w-4 h-4 inline mr-2 text-green-600" />
            <span className="font-semibold text-green-700">Next Open House:</span>{" "}
            {format(new Date(nextOpenHouse.date), "EEEE, MMMM d, yyyy")} • {nextOpenHouse.start_time} - {nextOpenHouse.end_time}
            {nextOpenHouse.type && <span className="ml-2 text-green-600">({nextOpenHouse.type === 'public' ? 'Public' : 'Broker'})</span>}
          </div>
        )}
      </Card>
    );
  }

  // Grid view
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative aspect-[4/3]">
        {photoUrl ? (
          <img src={photoUrl} alt={listing.address} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Home className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        {nextOpenHouse && (
          <div className="absolute top-0 left-0 right-0 bg-green-600 text-white text-sm font-bold px-3 py-2 text-center">
            🎈 OPEN HOUSE - {format(new Date(nextOpenHouse.date), "MMM d")}
          </div>
        )}
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {listing.photos?.length || 0} Photos
        </div>
      </div>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold mb-2">{listing.address}</h3>
            <div className="flex items-center text-muted-foreground text-sm mb-3">
              <MapPin className="w-4 h-4 mr-1" />
              {listing.city}, {listing.state} {listing.zip_code}
            </div>
            {listing.listing_number && (
              <div className="text-xs text-muted-foreground">
                Listing #{listing.listing_number}
              </div>
            )}
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
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => navigate(`/property/${listing.id}`)}
          >
            <Eye className="w-4 h-4 mr-2" />
            View
          </Button>
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

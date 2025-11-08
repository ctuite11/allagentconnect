import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, Bath, Square, TrendingUp, Calendar } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface SoldListing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  photos: any;
  property_type: string | null;
  created_at: string;
  active_date: string | null;
  updated_at: string;
  listing_stats?: {
    cumulative_active_days: number;
  };
}

const RecentlySold = () => {
  const navigate = useNavigate();
  const [soldListings, setSoldListings] = useState<SoldListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentlySold();
  }, []);

  const fetchRecentlySold = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("listings")
        .select(`
          *,
          listing_stats (
            cumulative_active_days
          )
        `)
        .eq("status", "sold")
        .gte("updated_at", thirtyDaysAgo.toISOString())
        .order("updated_at", { ascending: false })
        .limit(6);

      if (error) throw error;
      setSoldListings(data || []);
    } catch (error) {
      console.error("Error fetching recently sold listings:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFirstPhoto = (photos: any) => {
    if (photos && Array.isArray(photos) && photos.length > 0) {
      return photos[0].url || photos[0];
    }
    return null;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getDaysOnMarket = (listing: SoldListing) => {
    if (listing.listing_stats?.cumulative_active_days) {
      return listing.listing_stats.cumulative_active_days;
    }
    // Fallback calculation
    const startDate = new Date(listing.active_date || listing.created_at);
    const endDate = new Date(listing.updated_at);
    return differenceInDays(endDate, startDate);
  };

  if (loading) {
    return null;
  }

  if (soldListings.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            <TrendingUp className="w-3 h-3 mr-1" />
            Market Activity
          </Badge>
          <h2 className="text-4xl font-bold mb-4">Recently Sold Properties</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            See what's selling in your area. These properties sold in the last 30 days.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {soldListings.map((listing) => {
            const photoUrl = getFirstPhoto(listing.photos);
            const daysOnMarket = getDaysOnMarket(listing);

            return (
              <Card
                key={listing.id}
                className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group"
                onClick={() => navigate(`/property/${listing.id}`)}
              >
                <div className="relative aspect-[4/3]">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={listing.address}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Square className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  <Badge className="absolute top-4 right-4 bg-green-600 text-white border-0">
                    SOLD
                  </Badge>
                </div>

                <CardContent className="p-6">
                  <div className="mb-3">
                    <div className="text-2xl font-bold text-primary mb-1">
                      {formatPrice(listing.price)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>{daysOnMarket} days on market</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 mb-4">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium">{listing.address}</div>
                      <div className="text-muted-foreground">
                        {listing.city}, {listing.state} {listing.zip_code}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {listing.bedrooms && (
                      <div className="flex items-center gap-1">
                        <Bed className="w-4 h-4" />
                        <span>{listing.bedrooms}</span>
                      </div>
                    )}
                    {listing.bathrooms && (
                      <div className="flex items-center gap-1">
                        <Bath className="w-4 h-4" />
                        <span>{listing.bathrooms}</span>
                      </div>
                    )}
                    {listing.square_feet && (
                      <div className="flex items-center gap-1">
                        <Square className="w-4 h-4" />
                        <span>{listing.square_feet.toLocaleString()} sqft</span>
                      </div>
                    )}
                  </div>

                  {listing.property_type && (
                    <div className="mt-3 pt-3 border-t">
                      <Badge variant="outline" className="text-xs">
                        {listing.property_type}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center">
          <Button
            size="lg"
            onClick={() => navigate("/browse")}
            className="gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            View All Properties
          </Button>
        </div>
      </div>
    </section>
  );
};

export default RecentlySold;

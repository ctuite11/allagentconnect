import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Bed, Bath, Square, Calendar, DollarSign } from "lucide-react";

interface Listing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  lot_size: number | null;
  year_built: number | null;
  price: number;
  description: string | null;
  attom_data: any;
  walk_score_data: any;
  schools_data: any;
  value_estimate: any;
}

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const { data, error } = await supabase
          .from("listings")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        setListing(data);
      } catch (error: any) {
        console.error("Error fetching listing:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchListing();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 mt-20">
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Listing not found</p>
              <div className="flex justify-center mt-4">
                <Button onClick={() => navigate("/")}>Back to Home</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 mt-20">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-3xl mb-2">${listing.price.toLocaleString()}</CardTitle>
                  <div className="flex items-center text-muted-foreground">
                    <MapPin className="h-4 w-4 mr-2" />
                    <span>{listing.address}, {listing.city}, {listing.state} {listing.zip_code}</span>
                  </div>
                </div>
                {listing.property_type && (
                  <Badge variant="secondary">{listing.property_type}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {listing.bedrooms && (
                  <div className="flex items-center gap-2">
                    <Bed className="h-5 w-5 text-muted-foreground" />
                    <span>{listing.bedrooms} Beds</span>
                  </div>
                )}
                {listing.bathrooms && (
                  <div className="flex items-center gap-2">
                    <Bath className="h-5 w-5 text-muted-foreground" />
                    <span>{listing.bathrooms} Baths</span>
                  </div>
                )}
                {listing.square_feet && (
                  <div className="flex items-center gap-2">
                    <Square className="h-5 w-5 text-muted-foreground" />
                    <span>{listing.square_feet.toLocaleString()} sq ft</span>
                  </div>
                )}
                {listing.year_built && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <span>Built {listing.year_built}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          {listing.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{listing.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Value Estimate */}
          {listing.value_estimate && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Value Estimate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {listing.value_estimate.estimate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated Value:</span>
                      <span className="font-semibold">${listing.value_estimate.estimate.toLocaleString()}</span>
                    </div>
                  )}
                  {listing.value_estimate.high && listing.value_estimate.low && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Range:</span>
                      <span>${listing.value_estimate.low.toLocaleString()} - ${listing.value_estimate.high.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Walk Score */}
          {listing.walk_score_data && (
            <Card>
              <CardHeader>
                <CardTitle>Walk Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {listing.walk_score_data.walkscore && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Walk Score:</span>
                      <Badge variant={listing.walk_score_data.walkscore >= 70 ? "default" : "secondary"}>
                        {listing.walk_score_data.walkscore}
                      </Badge>
                    </div>
                  )}
                  {listing.walk_score_data.description && (
                    <p className="text-sm text-muted-foreground">{listing.walk_score_data.description}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Nearby Schools */}
          {listing.schools_data && listing.schools_data.schools && listing.schools_data.schools.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Nearby Schools</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {listing.schools_data.schools.map((school: any, index: number) => (
                    <div key={index} className="flex justify-between items-start border-b pb-4 last:border-0">
                      <div>
                        <h4 className="font-semibold">{school.name}</h4>
                        <p className="text-sm text-muted-foreground">{school.type}</p>
                        {school.distance && (
                          <p className="text-sm text-muted-foreground">{school.distance} miles</p>
                        )}
                      </div>
                      {school.rating && (
                        <Badge variant="default">{school.rating}/10</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Button onClick={() => navigate("/")}>Back to Listings</Button>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;

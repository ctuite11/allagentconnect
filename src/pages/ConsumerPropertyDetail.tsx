import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MapPin, Bed, Bath, Square, Calendar, ArrowLeft, Home, FileText, Video, Globe, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import SocialShareMenu from "@/components/SocialShareMenu";
import FavoriteButton from "@/components/FavoriteButton";
import SaveToHotSheetDialog from "@/components/SaveToHotSheetDialog";

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
  status: string;
  listing_type: string;
  disclosures: string[] | null;
  property_features: string[] | null;
  amenities: string[] | null;
  additional_notes: string | null;
  photos: any[] | null;
  floor_plans: any[] | null;
}

const ConsumerPropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const { data, error } = await supabase
          .from("listings")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        
        // Cast the Json types to proper arrays
        if (data) {
          setListing({
            id: data.id,
            address: data.address,
            city: data.city,
            state: data.state,
            zip_code: data.zip_code,
            property_type: data.property_type,
            bedrooms: data.bedrooms,
            bathrooms: data.bathrooms,
            square_feet: data.square_feet,
            lot_size: data.lot_size,
            year_built: data.year_built,
            price: data.price,
            description: data.description,
            status: data.status,
            listing_type: data.listing_type,
            disclosures: Array.isArray(data.disclosures) ? (data.disclosures as string[]) : [],
            property_features: Array.isArray(data.property_features) ? (data.property_features as string[]) : [],
            amenities: Array.isArray(data.amenities) ? (data.amenities as string[]) : [],
            additional_notes: data.additional_notes,
            photos: Array.isArray(data.photos) ? (data.photos as any[]) : [],
            floor_plans: Array.isArray(data.floor_plans) ? (data.floor_plans as any[]) : [],
          } as Listing);
        }
      } catch (error: any) {
        console.error("Error fetching listing:", error);
        toast.error("Failed to load property details");
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

  const mainPhoto = listing.photos && listing.photos.length > 0 ? listing.photos[currentPhotoIndex].url : '/placeholder.svg';

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-4 mt-20">
        <div className="max-w-7xl mx-auto">
          {/* Hero Image Section */}
          <div className="relative mb-6">
            <div className="relative h-[500px] rounded-lg overflow-hidden">
              <img 
                src={mainPhoto} 
                alt={listing.address} 
                className="w-full h-full object-cover"
              />
              
              {/* Overlay buttons */}
              <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                <Button 
                  variant="secondary" 
                  size="lg"
                  onClick={() => navigate(-1)}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Search
                </Button>
                <div className="flex gap-2">
                  <SocialShareMenu
                    url={window.location.href}
                    title={`${listing.address}, ${listing.city}, ${listing.state}`}
                    description={`$${listing.price.toLocaleString()} - ${listing.bedrooms} bed, ${listing.bathrooms} bath`}
                  />
                  <FavoriteButton listingId={listing.id} />
                  <SaveToHotSheetDialog
                    currentSearch={{
                      min_price: listing.price * 0.8,
                      max_price: listing.price * 1.2,
                      bedrooms: listing.bedrooms || undefined,
                      bathrooms: listing.bathrooms || undefined,
                      property_type: listing.property_type || undefined,
                      listing_type: listing.listing_type,
                    }}
                  />
                </div>
              </div>

              {/* Status and Property Type Badges */}
              <div className="absolute bottom-4 left-4 flex gap-2">
                <Badge className="bg-green-600 text-white text-base px-4 py-2">
                  {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                </Badge>
                {listing.property_type && (
                  <Badge variant="secondary" className="text-base px-4 py-2">
                    {listing.property_type}
                  </Badge>
                )}
              </div>
            </div>

            {/* Media Tabs */}
            <Tabs defaultValue="photos" className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="photos" className="gap-2">
                  <Home className="w-4 h-4" />
                  Photos
                </TabsTrigger>
                <TabsTrigger value="floorplan" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Floorplan
                </TabsTrigger>
                <TabsTrigger value="video" className="gap-2">
                  <Video className="w-4 h-4" />
                  Video
                </TabsTrigger>
                <TabsTrigger value="website" className="gap-2">
                  <Globe className="w-4 h-4" />
                  Website
                </TabsTrigger>
              </TabsList>
              <TabsContent value="photos" className="mt-4">
                {listing.photos && listing.photos.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {listing.photos.map((photo: any, index: number) => (
                      <img
                        key={index}
                        src={photo.url}
                        alt={`Property ${index + 1}`}
                        className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setCurrentPhotoIndex(index)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No photos available</p>
                )}
              </TabsContent>
              <TabsContent value="floorplan" className="mt-4">
                {listing.floor_plans && listing.floor_plans.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {listing.floor_plans.map((plan: any, index: number) => (
                      <img
                        key={index}
                        src={plan.url}
                        alt={`Floor plan ${index + 1}`}
                        className="w-full h-auto rounded"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No floor plans available</p>
                )}
              </TabsContent>
              <TabsContent value="video">
                <p className="text-muted-foreground text-center py-8">No video available</p>
              </TabsContent>
              <TabsContent value="website">
                <p className="text-muted-foreground text-center py-8">No website link available</p>
              </TabsContent>
            </Tabs>
          </div>

          {/* Address and Price */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-start gap-3">
              <MapPin className="w-6 h-6 text-primary mt-1" />
              <div>
                <h1 className="text-3xl font-bold mb-1">{listing.address}</h1>
                <p className="text-xl text-muted-foreground">
                  {listing.city}, {listing.state} {listing.zip_code}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-primary">
                ${listing.price.toLocaleString()}
              </p>
              {listing.listing_type === 'for_rent' && (
                <p className="text-muted-foreground">/month</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Property Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Property Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {listing.bedrooms && (
                      <div className="flex flex-col items-center">
                        <Bed className="h-8 w-8 text-primary mb-2" />
                        <span className="text-2xl font-bold">{listing.bedrooms}</span>
                        <span className="text-sm text-muted-foreground">Bedrooms</span>
                      </div>
                    )}
                    {listing.bathrooms && (
                      <div className="flex flex-col items-center">
                        <Bath className="h-8 w-8 text-primary mb-2" />
                        <span className="text-2xl font-bold">{listing.bathrooms}</span>
                        <span className="text-sm text-muted-foreground">Bathrooms</span>
                      </div>
                    )}
                    {listing.square_feet && (
                      <div className="flex flex-col items-center">
                        <Square className="h-8 w-8 text-primary mb-2" />
                        <span className="text-2xl font-bold">{listing.square_feet.toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground">Sq Ft</span>
                      </div>
                    )}
                    {listing.year_built && (
                      <div className="flex flex-col items-center">
                        <Calendar className="h-8 w-8 text-primary mb-2" />
                        <span className="text-2xl font-bold">{listing.year_built}</span>
                        <span className="text-sm text-muted-foreground">Year Built</span>
                      </div>
                    )}
                  </div>
                  {listing.lot_size && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Lot Size:</span>
                        <span className="font-semibold">{listing.lot_size} acres</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Description */}
              {listing.description && (
                <Card>
                  <CardHeader>
                    <CardTitle>Property Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
                  </CardContent>
                </Card>
              )}

              {/* Property Features */}
              {listing.property_features && listing.property_features.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Property Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {listing.property_features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Amenities */}
              {listing.amenities && listing.amenities.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Amenities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {listing.amenities.map((amenity, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <span className="text-sm">{amenity}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Disclosures */}
              {listing.disclosures && listing.disclosures.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      Disclosures
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {listing.disclosures.map((disclosure, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                          <span>{disclosure}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Additional Notes */}
              {listing.additional_notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Additional Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">{listing.additional_notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar - Contact Information */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Interested in this property?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Contact an agent to schedule a viewing or learn more about this property.
                  </p>
                  <Button className="w-full" size="lg">
                    Contact Agent
                  </Button>
                  <Button variant="outline" className="w-full" size="lg">
                    Schedule Viewing
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Property Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Listing Type:</span>
                    <span className="font-semibold">
                      {listing.listing_type === 'for_sale' ? 'For Sale' : 'For Rent'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-semibold capitalize">{listing.status}</span>
                  </div>
                  {listing.property_type && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Property Type:</span>
                      <span className="font-semibold">{listing.property_type}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsumerPropertyDetail;

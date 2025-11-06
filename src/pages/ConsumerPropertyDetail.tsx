import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, MapPin, Bed, Bath, Square, Calendar, ArrowLeft, Home, FileText, Video, Globe, AlertCircle, DollarSign, Phone, Mail, GraduationCap, Footprints } from "lucide-react";
import { toast } from "sonner";
import SocialShareMenu from "@/components/SocialShareMenu";
import FavoriteButton from "@/components/FavoriteButton";
import SaveToHotSheetDialog from "@/components/SaveToHotSheetDialog";
import ScheduleShowingDialog from "@/components/ScheduleShowingDialog";
import ContactAgentDialog from "@/components/ContactAgentDialog";
import PropertyMap from "@/components/PropertyMap";

import { formatPhoneNumber } from "@/lib/phoneFormat";

interface AgentProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  cell_phone: string | null;
  title: string | null;
  headshot_url: string | null;
  company: string | null;
  office_name: string | null;
}

interface Listing {
  id: string;
  agent_id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number | null;
  longitude: number | null;
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
  commission_rate: number | null;
  commission_type: string | null;
  commission_notes: string | null;
  disclosures: string[] | null;
  property_features: string[] | null;
  amenities: string[] | null;
  additional_notes: string | null;
  photos: any[] | null;
  floor_plans: any[] | null;
  attom_data: any;
  walk_score_data: any;
  schools_data: any;
  value_estimate: any;
  listing_number?: string | null;
}

const ConsumerPropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: listingData, error: listingError } = await supabase
          .from("listings")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (listingError) throw listingError;
        
        if (listingData) {
          const listing = {
            ...listingData,
            disclosures: Array.isArray(listingData.disclosures) ? (listingData.disclosures as string[]) : [],
            property_features: Array.isArray(listingData.property_features) ? (listingData.property_features as string[]) : [],
            amenities: Array.isArray(listingData.amenities) ? (listingData.amenities as string[]) : [],
            photos: Array.isArray(listingData.photos) ? (listingData.photos as any[]) : [],
            floor_plans: Array.isArray(listingData.floor_plans) ? (listingData.floor_plans as any[]) : [],
          } as Listing;
          
          setListing(listing);

          // Fetch agent profile
          const { data: agentData, error: agentError } = await supabase
            .from("agent_profiles")
            .select("id, first_name, last_name, email, cell_phone, phone, title, company, office_name, headshot_url")
            .eq("id", listingData.agent_id)
            .maybeSingle();

          if (!agentError && agentData) {
            setAgent(agentData as AgentProfile);
          }
        }
      } catch (error: any) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load property details");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
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
                {listing.listing_number && (
                  <p className="text-sm text-muted-foreground font-mono mt-1">
                    Listing #{listing.listing_number}
                  </p>
                )}
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

          {/* Call to Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            <ScheduleShowingDialog 
              listingId={listing.id}
              listingAddress={`${listing.address}, ${listing.city}, ${listing.state}`}
            />
            <ContactAgentDialog 
              listingId={listing.id}
              agentId={listing.agent_id}
              listingAddress={`${listing.address}, ${listing.city}, ${listing.state}`}
            />
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => navigate(`/agent/${listing.agent_id}`)}
            >
              View Agent Profile
            </Button>
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

              {/* Map */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PropertyMap 
                    address={`${listing.address}, ${listing.city}, ${listing.state} ${listing.zip_code}`}
                    latitude={listing.latitude}
                    longitude={listing.longitude}
                  />
                </CardContent>
              </Card>

              {/* ATTOM Property Data */}
              {listing.attom_data && Object.keys(listing.attom_data).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Property Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {listing.attom_data.property_type && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Property Type:</span>
                        <span className="font-semibold">{listing.attom_data.property_type}</span>
                      </div>
                    )}
                    {listing.attom_data.stories && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Stories:</span>
                        <span className="font-semibold">{listing.attom_data.stories}</span>
                      </div>
                    )}
                    {listing.attom_data.parking_spaces && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Parking Spaces:</span>
                        <span className="font-semibold">{listing.attom_data.parking_spaces}</span>
                      </div>
                    )}
                    {listing.attom_data.zoning && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Zoning:</span>
                        <span className="font-semibold">{listing.attom_data.zoning}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Schools */}
              {listing.schools_data && listing.schools_data.schools && listing.schools_data.schools.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCap className="h-5 w-5" />
                      Nearby Schools
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {listing.schools_data.schools.slice(0, 5).map((school: any, index: number) => (
                      <div key={index} className="pb-3 border-b last:border-0 last:pb-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-semibold text-sm">{school.name}</h4>
                          {school.rating && (
                            <Badge variant="secondary">{school.rating}/10</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {school.level} • {school.distance} mi
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Listing Agent Card */}
              {agent && (
                <Card>
                  <CardHeader>
                    <CardTitle>Listing Agent</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4">
                      {agent.headshot_url && (
                        <img 
                          src={agent.headshot_url} 
                          alt={`${agent.first_name} ${agent.last_name}`}
                          className="w-32 h-40 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 space-y-3">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-lg">{agent.first_name} {agent.last_name}</h3>
                          {agent.title && (
                            <p className="text-sm text-muted-foreground">{agent.title}</p>
                          )}
                          {agent.company && (
                            <p className="text-sm text-muted-foreground">{agent.company}</p>
                          )}
                          {agent.office_name && (
                            <p className="text-xs text-muted-foreground">{agent.office_name}</p>
                          )}
                        </div>
                        <div className="space-y-2 text-sm">
                          {(agent.cell_phone || agent.phone) && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <a href={`tel:${agent.cell_phone || agent.phone}`} className="hover:underline">
                                {formatPhoneNumber(agent.cell_phone || agent.phone)}
                              </a>
                            </div>
                          )}
                          {agent.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <a href={`mailto:${agent.email}`} className="hover:underline break-all">
                                {agent.email}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={() => navigate(`/agent/${agent.id}`)}
                    >
                      View Profile
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Commission Information */}
              {listing.commission_rate && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Buyer Agent Compensation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-2">
                      <p className="text-3xl font-bold text-primary">
                        {listing.commission_type === 'percentage' 
                          ? `${listing.commission_rate}%` 
                          : `$${listing.commission_rate.toLocaleString()}`}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Offered to buyer agents who bring the buyer
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Property Information */}
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

              {/* Walk Score */}
              {listing.walk_score_data && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Footprints className="h-5 w-5" />
                      Walk Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {listing.walk_score_data.walkscore && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm">Walk Score</span>
                          <span className="text-2xl font-bold text-primary">{listing.walk_score_data.walkscore}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{listing.walk_score_data.description}</p>
                      </div>
                    )}
                    {listing.walk_score_data.transit && (
                      <div className="pt-2 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Transit Score</span>
                          <span className="text-xl font-bold">{listing.walk_score_data.transit.score}</span>
                        </div>
                      </div>
                    )}
                    {listing.walk_score_data.bike && (
                      <div className="pt-2 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Bike Score</span>
                          <span className="text-xl font-bold">{listing.walk_score_data.bike.score}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsumerPropertyDetail;

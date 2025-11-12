import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, MapPin, Bed, Bath, Square, Calendar, DollarSign, ArrowLeft, Home, FileText, Video, Globe, Lock, Phone, Mail, AlertCircle, GraduationCap, Footprints, Image, Cloud } from "lucide-react";
import { toast } from "sonner";
import SocialShareMenu from "@/components/SocialShareMenu";
import FavoriteButton from "@/components/FavoriteButton";
import SaveToHotSheetDialog from "@/components/SaveToHotSheetDialog";
import MatchingBuyerAgents from "@/components/MatchingBuyerAgents";
import ScheduleShowingDialog from "@/components/ScheduleShowingDialog";
import ContactAgentDialog from "@/components/ContactAgentDialog";
import BuyerAgentCompensationInfo from "@/components/BuyerAgentCompensationInfo";
import PropertyMap from "@/components/PropertyMap";
import PhotoGalleryDialog from "@/components/PhotoGalleryDialog";
import AdBanner from "@/components/AdBanner";
import { ShareListingDialog } from "@/components/ShareListingDialog";

import { formatPhoneNumber } from "@/lib/phoneFormat";
import { useListingView } from "@/hooks/useListingView";

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
  showing_instructions: string | null;
  lockbox_code: string | null;
  appointment_required: boolean | null;
  showing_contact_name: string | null;
  showing_contact_phone: string | null;
  disclosures: string[] | null;
  property_features: string[] | null;
  amenities: string[] | null;
  additional_notes: string | null;
  photos: any[] | null;
  floor_plans: any[] | null;
  documents: any[] | null;
  attom_data: any;
  walk_score_data: any;
  schools_data: any;
  value_estimate: any;
  listing_number?: string | null;
  created_at?: string;
  active_date?: string | null;
  condo_details?: any;
  multi_family_details?: any;
  commercial_details?: any;
  annual_property_tax?: number | null;
  tax_year?: number | null;
  tax_assessment_value?: number | null;
  num_fireplaces?: number | null;
  garage_spaces?: number | null;
  total_parking_spaces?: number | null;
}

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAgent, setIsAgent] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryTab, setGalleryTab] = useState("photos");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Track listing view
  useListingView(id);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        
        // Check if user is an agent by checking if they have an agent profile
        const { data: agentProfile } = await supabase
          .from("agent_profiles")
          .select("id")
          .eq("id", session.user.id)
          .maybeSingle();
        
        setIsAgent(!!agentProfile);
      }
    };

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
            ...data,
            disclosures: Array.isArray(data.disclosures) ? (data.disclosures as string[]) : [],
            property_features: Array.isArray(data.property_features) ? (data.property_features as string[]) : [],
            amenities: Array.isArray(data.amenities) ? (data.amenities as string[]) : [],
            photos: Array.isArray(data.photos) ? (data.photos as any[]) : [],
            floor_plans: Array.isArray(data.floor_plans) ? (data.floor_plans as any[]) : [],
            documents: Array.isArray(data.documents) ? (data.documents as any[]) : [],
          } as Listing);

          // Fetch agent profile
          if (data.agent_id) {
            const { data: profile } = await supabase
              .from("agent_profiles")
              .select("id, first_name, last_name, email, cell_phone, phone, title, company, headshot_url, logo_url")
              .eq("id", data.agent_id)
              .maybeSingle();
            
            if (profile) {
              setAgentProfile(profile);
            }
          }
        }
      } catch (error: any) {
        console.error("Error fetching listing:", error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
    if (id) {
      fetchListing();
    }
  }, [id]);

  const handleRefreshData = async () => {
    if (!id) return;
    
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('auto-fetch-property-data', {
        body: { listing_id: id }
      });

      if (error) throw error;

      toast.success("Property data refreshed successfully");
      
      // Refetch the listing to show updated data
      const { data, error: fetchError } = await supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      if (data) {
        setListing({
          ...data,
          disclosures: Array.isArray(data.disclosures) ? (data.disclosures as string[]) : [],
          property_features: Array.isArray(data.property_features) ? (data.property_features as string[]) : [],
          amenities: Array.isArray(data.amenities) ? (data.amenities as string[]) : [],
          photos: Array.isArray(data.photos) ? (data.photos as any[]) : [],
          floor_plans: Array.isArray(data.floor_plans) ? (data.floor_plans as any[]) : [],
          documents: Array.isArray(data.documents) ? (data.documents as any[]) : [],
        } as Listing);
      }
    } catch (error: any) {
      console.error("Error refreshing property data:", error);
      toast.error("Failed to refresh property data");
    } finally {
      setRefreshing(false);
    }
  };


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

              {/* View All Media Button */}
              <div className="absolute bottom-4 right-4">
                <Button
                  variant="secondary"
                  size="lg"
                  className="gap-2"
                  onClick={() => {
                    setGalleryTab("photos");
                    setGalleryIndex(currentPhotoIndex);
                    setGalleryOpen(true);
                  }}
                >
                  <Image className="w-4 h-4" />
                  View All Photos & Media
                </Button>
              </div>
            </div>

            {/* Photo Gallery Dialog */}
            <PhotoGalleryDialog
              open={galleryOpen}
              onOpenChange={setGalleryOpen}
              photos={listing.photos || []}
              floorPlans={listing.floor_plans || []}
              videos={[]}
              virtualTours={[]}
              initialTab={galleryTab}
              initialIndex={galleryIndex}
            />
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
                <div className="flex items-center gap-2 mt-1">
                  {listing.listing_number && (
                    <p className="text-sm text-muted-foreground font-mono">
                      Listing #{listing.listing_number}
                    </p>
                  )}
                  {(listing.active_date || listing.created_at) && (
                    <>
                      {listing.listing_number && (
                        <span className="text-sm text-muted-foreground">•</span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {(() => {
                          const marketDate = listing.active_date || listing.created_at;
                          const activeDate = new Date(marketDate!);
                          const today = new Date();
                          const diffTime = Math.abs(today.getTime() - activeDate.getTime());
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} on market`;
                        })()}
                      </Badge>
                    </>
                  )}
                </div>
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

          {/* Schedule Showing and Contact Section */}
          <div className="mb-6">
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
              {isAgent && (
                <ShareListingDialog 
                  listingId={listing.id}
                  listingAddress={`${listing.address}, ${listing.city}, ${listing.state}`}
                />
              )}
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate(`/agent/${listing.agent_id}`)}
              >
                View Agent Profile
              </Button>
              {currentUser?.id === listing.agent_id && (
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={handleRefreshData}
                  disabled={refreshing}
                  className="gap-2"
                >
                  {refreshing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <Cloud className="w-4 h-4" />
                      Refresh Data
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Agent and Commission Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Listing Agent Card */}
              {agentProfile && (
                <Card>
                  <CardHeader>
                    <CardTitle>Listing Agent</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-4">
                      {agentProfile.headshot_url && (
                        <img 
                          src={agentProfile.headshot_url} 
                          alt={`${agentProfile.first_name} ${agentProfile.last_name}`}
                          className="w-32 h-40 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 space-y-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-lg">{agentProfile.first_name} {agentProfile.last_name}</p>
                          {agentProfile.title && (
                            <p className="text-sm text-muted-foreground">{agentProfile.title}</p>
                          )}
                          {agentProfile.company && (
                            <p className="text-sm text-muted-foreground">{agentProfile.company}</p>
                          )}
                        </div>
                        <div className="space-y-2 text-sm">
                          {(agentProfile.cell_phone || agentProfile.phone) && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 flex-shrink-0" />
                              <a href={`tel:${agentProfile.cell_phone || agentProfile.phone}`} className="text-primary hover:underline">
                                {formatPhoneNumber(agentProfile.cell_phone || agentProfile.phone)}
                              </a>
                            </div>
                          )}
                          {agentProfile.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 flex-shrink-0" />
                              <a href={`mailto:${agentProfile.email}`} className="text-primary hover:underline break-all">
                                {agentProfile.email}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                      {agentProfile.logo_url && (
                        <img 
                          src={agentProfile.logo_url} 
                          alt={`${agentProfile.company || 'Company'} logo`}
                          className="w-20 h-20 object-contain flex-shrink-0"
                        />
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => navigate(`/agent/${listing.agent_id}`)}
                    >
                      View Full Profile
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Buyer Agent Commission */}
              {isAgent && listing.commission_rate && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-6 w-6" />
                      Buyer Agent Compensation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center">
                    <div className="flex items-center justify-center gap-2 py-2">
                      <p className="text-3xl font-bold text-primary">
                        {listing.commission_type === 'flat_fee' 
                          ? `$${listing.commission_rate.toLocaleString()}`
                          : `${listing.commission_rate}%`
                        }
                      </p>
                      <BuyerAgentCompensationInfo />
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Offered to cooperating buyer agents
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Matching Buyer Agents - Visible to everyone */}
            {listing.city && listing.state && (
              <MatchingBuyerAgents 
                listingCity={listing.city}
                listingState={listing.state}
                listingZipCode={listing.zip_code}
                listingAgentId={listing.agent_id}
              />
            )}
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
                  {listing.lot_size && !(listing.property_type?.toLowerCase().includes("condo")) && (
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

              {/* Unit Features */}
              {(listing.disclosures?.find((d: string) => d.startsWith('Floors:')) || 
                (listing.num_fireplaces !== null && listing.num_fireplaces !== undefined) ||
                (listing.condo_details?.hoa_fee)) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Unit Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {listing.disclosures?.find((d: string) => d.startsWith('Floors:')) && (
                        <div>
                          <p className="text-sm text-muted-foreground">Number of Floors</p>
                          <p className="font-semibold">{listing.disclosures.find((d: string) => d.startsWith('Floors:'))?.replace('Floors: ', '')}</p>
                        </div>
                      )}
                      {listing.num_fireplaces !== null && listing.num_fireplaces !== undefined && (
                        <div>
                          <p className="text-sm text-muted-foreground">Fireplaces</p>
                          <p className="font-semibold">{listing.num_fireplaces}</p>
                        </div>
                      )}
                      {listing.condo_details?.hoa_fee && (
                        <div>
                          <p className="text-sm text-muted-foreground">HOA/Condo Fee</p>
                          <p className="font-semibold">
                            ${parseFloat(listing.condo_details.hoa_fee).toLocaleString()}/{listing.condo_details.hoa_fee_frequency || 'monthly'}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Property Tax */}
              {(listing.annual_property_tax || listing.tax_year || listing.tax_assessment_value) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Property Tax</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {listing.annual_property_tax && (
                        <div>
                          <p className="text-sm text-muted-foreground">Annual Property Tax</p>
                          <p className="font-semibold">${parseFloat(listing.annual_property_tax.toString()).toLocaleString()}</p>
                        </div>
                      )}
                      {listing.tax_assessment_value && (
                        <div>
                          <p className="text-sm text-muted-foreground">Assessed Value</p>
                          <p className="font-semibold">${parseFloat(listing.tax_assessment_value.toString()).toLocaleString()}</p>
                        </div>
                      )}
                      {listing.tax_year && (
                        <div>
                          <p className="text-sm text-muted-foreground">Fiscal Year</p>
                          <p className="font-semibold">{listing.tax_year}</p>
                        </div>
                      )}
                      {listing.disclosures?.find((d: string) => d.startsWith('Residential Exemption:')) && (
                        <div>
                          <p className="text-sm text-muted-foreground">Residential Exemption</p>
                          <p className="font-semibold">{listing.disclosures.find((d: string) => d.startsWith('Residential Exemption:'))?.replace('Residential Exemption: ', '')}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Basement Details */}
              {listing.disclosures?.some((d: string) => d.startsWith('Basement Type:') || d.startsWith('Basement Features:') || d.startsWith('Basement Floor Type:')) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Basement Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {listing.disclosures.find((d: string) => d.startsWith('Basement Type:')) && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Basement Type</p>
                        <p className="font-semibold">{listing.disclosures.find((d: string) => d.startsWith('Basement Type:'))?.replace('Basement Type: ', '')}</p>
                      </div>
                    )}
                    {listing.disclosures.find((d: string) => d.startsWith('Basement Features:')) && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-3">Basement Features</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {listing.disclosures.find((d: string) => d.startsWith('Basement Features:'))?.replace('Basement Features: ', '').split(', ').map((feature: string, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="text-sm">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {listing.disclosures.find((d: string) => d.startsWith('Basement Floor Type:')) && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-3">Floor Type</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {listing.disclosures.find((d: string) => d.startsWith('Basement Floor Type:'))?.replace('Basement Floor Type: ', '').split(', ').map((type: string, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="text-sm">{type}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Foundation & Building Details */}
              {listing.disclosures?.some((d: string) => d.startsWith('Lead Paint:') || d.startsWith('Handicap Access:') || d.startsWith('Foundation:')) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Foundation & Building Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {listing.disclosures.find((d: string) => d.startsWith('Lead Paint:')) && (
                        <div>
                          <p className="text-sm text-muted-foreground">Lead Paint</p>
                          <p className="font-semibold">{listing.disclosures.find((d: string) => d.startsWith('Lead Paint:'))?.replace('Lead Paint: ', '')}</p>
                        </div>
                      )}
                      {listing.disclosures.find((d: string) => d.startsWith('Handicap Access:')) && (
                        <div>
                          <p className="text-sm text-muted-foreground">Handicap Access</p>
                          <p className="font-semibold">{listing.disclosures.find((d: string) => d.startsWith('Handicap Access:'))?.replace('Handicap Access: ', '')}</p>
                        </div>
                      )}
                    </div>
                    {listing.disclosures.find((d: string) => d.startsWith('Foundation:')) && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-3">Foundation</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {listing.disclosures.find((d: string) => d.startsWith('Foundation:'))?.replace('Foundation: ', '').split(', ').map((type: string, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="text-sm">{type}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Parking & Garage Information */}
              {(listing.garage_spaces || listing.total_parking_spaces || listing.disclosures?.some((d: string) => d.startsWith('Parking Features:') || d.startsWith('Parking Comments:') || d.startsWith('Garage Features:') || d.startsWith('Garage Comments:'))) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Parking & Garage</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {listing.total_parking_spaces && (
                        <div>
                          <p className="text-sm text-muted-foreground">Total Parking Spaces</p>
                          <p className="font-semibold">{listing.total_parking_spaces}</p>
                        </div>
                      )}
                      {listing.garage_spaces !== undefined && listing.garage_spaces !== null && (
                        <div>
                          <p className="text-sm text-muted-foreground">Garage Spaces</p>
                          <p className="font-semibold">{listing.garage_spaces}</p>
                        </div>
                      )}
                    </div>
                    
                    {listing.disclosures?.find((d: string) => d.startsWith('Parking Features:')) && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-3">Parking Features</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {listing.disclosures.find((d: string) => d.startsWith('Parking Features:'))?.replace('Parking Features: ', '').split(', ').map((feature: string, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="text-sm">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {listing.disclosures?.find((d: string) => d.startsWith('Parking Comments:')) && (
                      <div className="pt-4 border-t">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Parking Comments</p>
                        <p className="text-sm">{listing.disclosures.find((d: string) => d.startsWith('Parking Comments:'))?.replace('Parking Comments: ', '')}</p>
                      </div>
                    )}
                    
                    {listing.disclosures?.find((d: string) => d.startsWith('Garage Features:')) && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-3">Garage Features</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {listing.disclosures.find((d: string) => d.startsWith('Garage Features:'))?.replace('Garage Features: ', '').split(', ').map((feature: string, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="text-sm">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {listing.disclosures?.find((d: string) => d.startsWith('Garage Comments:')) && (
                      <div className="pt-4 border-t">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Garage Comments</p>
                        <p className="text-sm">{listing.disclosures.find((d: string) => d.startsWith('Garage Comments:'))?.replace('Garage Comments: ', '')}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Lot Information */}
              {!(listing.property_type?.toLowerCase().includes("condo")) && listing.disclosures?.some((d: string) => d.startsWith('Lot Size Source:') || d.startsWith('Lot Description:')) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Lot Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {listing.disclosures.find((d: string) => d.startsWith('Lot Size Source:')) && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Lot Size Source</p>
                        <p className="font-semibold">{listing.disclosures.find((d: string) => d.startsWith('Lot Size Source:'))?.replace('Lot Size Source: ', '')}</p>
                      </div>
                    )}
                    {listing.disclosures?.find((d: string) => d.startsWith('Lot Description:')) && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-3">Lot Description</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {listing.disclosures.find((d: string) => d.startsWith('Lot Description:'))?.replace('Lot Description: ', '').split(', ').map((desc: string, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="text-sm">{desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Condominium Details */}
              {listing.property_type === "Condominium" && listing.condo_details && (
                <Card>
                  <CardHeader>
                    <CardTitle>Condominium Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {listing.condo_details.unit_number && (
                        <div>
                          <p className="text-sm text-muted-foreground">Unit Number</p>
                          <p className="font-semibold">{listing.condo_details.unit_number}</p>
                        </div>
                      )}
                      {listing.condo_details.floor_level && (
                        <div>
                          <p className="text-sm text-muted-foreground">Floor Level</p>
                          <p className="font-semibold">{listing.condo_details.floor_level}</p>
                        </div>
                      )}
                      {listing.condo_details.total_units && (
                        <div>
                          <p className="text-sm text-muted-foreground">Total Units</p>
                          <p className="font-semibold">{listing.condo_details.total_units}</p>
                        </div>
                      )}
                    </div>
                    
                    {listing.condo_details.hoa_fee && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground">HOA Fee</p>
                        <p className="font-semibold">
                          ${parseFloat(listing.condo_details.hoa_fee).toLocaleString()}/{listing.condo_details.hoa_fee_frequency || 'month'}
                        </p>
                      </div>
                    )}

                    {listing.condo_details.pet_policy && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground">Pet Policy</p>
                        <p className="font-semibold capitalize">{listing.condo_details.pet_policy.replace('_', ' ')}</p>
                      </div>
                    )}

                    {listing.condo_details.building_amenities && listing.condo_details.building_amenities.length > 0 && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-3">Building Amenities</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {listing.condo_details.building_amenities.map((amenity: string, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="text-sm">{amenity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Multi-Family Details */}
              {listing.property_type === "Multi-Family" && listing.multi_family_details && (
                <Card>
                  <CardHeader>
                    <CardTitle>Multi-Family Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {listing.multi_family_details.number_of_units && (
                        <div>
                          <p className="text-sm text-muted-foreground">Number of Units</p>
                          <p className="font-semibold">{listing.multi_family_details.number_of_units}</p>
                        </div>
                      )}
                      {listing.multi_family_details.parking_per_unit && (
                        <div>
                          <p className="text-sm text-muted-foreground">Parking Per Unit</p>
                          <p className="font-semibold">{listing.multi_family_details.parking_per_unit}</p>
                        </div>
                      )}
                      {listing.multi_family_details.occupancy_status && (
                        <div>
                          <p className="text-sm text-muted-foreground">Occupancy Status</p>
                          <p className="font-semibold capitalize">{listing.multi_family_details.occupancy_status.replace('_', ' ')}</p>
                        </div>
                      )}
                    </div>

                    {listing.multi_family_details.unit_breakdown && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-2">Unit Breakdown</p>
                        <p className="text-sm whitespace-pre-wrap">{listing.multi_family_details.unit_breakdown}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                      {listing.multi_family_details.current_monthly_income && (
                        <div>
                          <p className="text-sm text-muted-foreground">Current Monthly Income</p>
                          <p className="font-semibold text-green-600">
                            ${parseFloat(listing.multi_family_details.current_monthly_income).toLocaleString()}
                          </p>
                        </div>
                      )}
                      {listing.multi_family_details.potential_monthly_income && (
                        <div>
                          <p className="text-sm text-muted-foreground">Potential Monthly Income</p>
                          <p className="font-semibold text-blue-600">
                            ${parseFloat(listing.multi_family_details.potential_monthly_income).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>

                    {listing.multi_family_details.laundry_type && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground">Laundry</p>
                        <p className="font-semibold capitalize">{listing.multi_family_details.laundry_type.replace('_', ' ')}</p>
                      </div>
                    )}

                    {listing.multi_family_details.separate_utilities && listing.multi_family_details.separate_utilities.length > 0 && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-3">Separate Utilities</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {listing.multi_family_details.separate_utilities.map((utility: string, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="text-sm">{utility}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Commercial Details */}
              {listing.property_type === "Commercial" && listing.commercial_details && (
                <Card>
                  <CardHeader>
                    <CardTitle>Commercial Property Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {listing.commercial_details.space_type && (
                        <div>
                          <p className="text-sm text-muted-foreground">Space Type</p>
                          <p className="font-semibold capitalize">{listing.commercial_details.space_type.replace('_', ' ')}</p>
                        </div>
                      )}
                      {listing.commercial_details.lease_type && (
                        <div>
                          <p className="text-sm text-muted-foreground">Lease Type</p>
                          <p className="font-semibold capitalize">{listing.commercial_details.lease_type.replace('_', ' ')}</p>
                        </div>
                      )}
                      {listing.commercial_details.zoning && (
                        <div>
                          <p className="text-sm text-muted-foreground">Zoning</p>
                          <p className="font-semibold">{listing.commercial_details.zoning}</p>
                        </div>
                      )}
                    </div>

                    {listing.commercial_details.lease_rate && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground">Lease Rate</p>
                        <p className="font-semibold text-lg text-primary">
                          ${parseFloat(listing.commercial_details.lease_rate).toLocaleString()} 
                          {listing.commercial_details.lease_rate_per && 
                            ` ${listing.commercial_details.lease_rate_per.replace('_', ' ')}`}
                        </p>
                      </div>
                    )}

                    {(listing.commercial_details.lease_term_min || listing.commercial_details.lease_term_max) && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground">Lease Term</p>
                        <p className="font-semibold">
                          {listing.commercial_details.lease_term_min && listing.commercial_details.lease_term_max 
                            ? `${listing.commercial_details.lease_term_min} - ${listing.commercial_details.lease_term_max} months`
                            : listing.commercial_details.lease_term_min 
                            ? `${listing.commercial_details.lease_term_min}+ months`
                            : `Up to ${listing.commercial_details.lease_term_max} months`}
                        </p>
                      </div>
                    )}

                    {listing.commercial_details.current_tenant && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground">Current Tenant</p>
                        <p className="font-semibold">{listing.commercial_details.current_tenant}</p>
                      </div>
                    )}

                    {listing.commercial_details.lease_expiration && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground">Lease Expiration</p>
                        <p className="font-semibold">
                          {new Date(listing.commercial_details.lease_expiration).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t">
                      {listing.commercial_details.ceiling_height && (
                        <div>
                          <p className="text-sm text-muted-foreground">Ceiling Height</p>
                          <p className="font-semibold">{listing.commercial_details.ceiling_height} ft</p>
                        </div>
                      )}
                      {listing.commercial_details.loading_docks !== null && listing.commercial_details.loading_docks !== undefined && (
                        <div>
                          <p className="text-sm text-muted-foreground">Loading Docks</p>
                          <p className="font-semibold">{listing.commercial_details.loading_docks}</p>
                        </div>
                      )}
                      {listing.commercial_details.power_available && (
                        <div>
                          <p className="text-sm text-muted-foreground">Power Available</p>
                          <p className="font-semibold">{listing.commercial_details.power_available}</p>
                        </div>
                      )}
                    </div>

                    {listing.commercial_details.allowed_business_types && listing.commercial_details.allowed_business_types.length > 0 && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-3">Allowed Business Types</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {listing.commercial_details.allowed_business_types.map((type: string, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="text-sm">{type}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {listing.commercial_details.tenant_responsibilities && listing.commercial_details.tenant_responsibilities.length > 0 && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-3">Tenant Responsibilities</p>
                        <div className="grid grid-cols-2 gap-2">
                          {listing.commercial_details.tenant_responsibilities.map((resp: string, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="text-sm">{resp}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {listing.commercial_details.additional_features && listing.commercial_details.additional_features.length > 0 && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-3">Additional Features</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {listing.commercial_details.additional_features.map((feature: string, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="text-sm">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Disclosures & Legal Information */}
              {(listing.disclosures?.some((d: string) => d.startsWith('Seller Disclosure:') || d.startsWith('Disclosures:') || d.startsWith('Exclusions:')) || listing.additional_notes) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      Disclosures & Important Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {listing.disclosures?.find((d: string) => d.startsWith('Seller Disclosure:')) && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Seller Disclosure</p>
                        <p className="font-semibold">{listing.disclosures.find((d: string) => d.startsWith('Seller Disclosure:'))?.replace('Seller Disclosure: ', '')}</p>
                      </div>
                    )}
                    {listing.disclosures?.find((d: string) => d.startsWith('Disclosures:')) && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-2">Additional Disclosures</p>
                        <p className="text-sm whitespace-pre-wrap">{listing.disclosures.find((d: string) => d.startsWith('Disclosures:'))?.replace('Disclosures: ', '')}</p>
                      </div>
                    )}
                    {listing.disclosures?.find((d: string) => d.startsWith('Exclusions:')) && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-2">Exclusions</p>
                        <p className="text-sm whitespace-pre-wrap">{listing.disclosures.find((d: string) => d.startsWith('Exclusions:'))?.replace('Exclusions: ', '')}</p>
                      </div>
                    )}
                    {listing.additional_notes?.includes('Broker Comments:') && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-2">Broker Comments</p>
                        <p className="text-sm whitespace-pre-wrap">{listing.additional_notes.split('Broker Comments:')[1]?.trim()}</p>
                      </div>
                    )}
                    {listing.disclosures && listing.disclosures.filter((d: string) => 
                      !d.startsWith('Seller Disclosure:') && 
                      !d.startsWith('Disclosures:') && 
                      !d.startsWith('Exclusions:') &&
                      !d.startsWith('Residential Exemption:') &&
                      !d.startsWith('Floors:') &&
                      !d.startsWith('Basement Type:') &&
                      !d.startsWith('Basement Features:') &&
                      !d.startsWith('Basement Floor Type:') &&
                      !d.startsWith('Lead Paint:') &&
                      !d.startsWith('Handicap Access:') &&
                      !d.startsWith('Foundation:') &&
                      !d.startsWith('Parking Features:') &&
                      !d.startsWith('Parking Comments:') &&
                      !d.startsWith('Garage Features:') &&
                      !d.startsWith('Garage Comments:') &&
                      !d.startsWith('Lot Size Source:') &&
                      !d.startsWith('Lot Description:')
                    ).length > 0 && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-3">Other Disclosures</p>
                        <div className="space-y-2">
                          {listing.disclosures.filter((d: string) => 
                            !d.startsWith('Seller Disclosure:') && 
                            !d.startsWith('Disclosures:') && 
                            !d.startsWith('Exclusions:') &&
                            !d.startsWith('Residential Exemption:') &&
                            !d.startsWith('Floors:') &&
                            !d.startsWith('Basement Type:') &&
                            !d.startsWith('Basement Features:') &&
                            !d.startsWith('Basement Floor Type:') &&
                            !d.startsWith('Lead Paint:') &&
                            !d.startsWith('Handicap Access:') &&
                            !d.startsWith('Foundation:') &&
                            !d.startsWith('Parking Features:') &&
                            !d.startsWith('Parking Comments:') &&
                            !d.startsWith('Garage Features:') &&
                            !d.startsWith('Garage Comments:') &&
                            !d.startsWith('Lot Size Source:') &&
                            !d.startsWith('Lot Description:')
                          ).map((disclosure, index) => (
                            <div key={index} className="flex items-start gap-2 text-sm">
                              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                              <span>{disclosure}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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

            {/* Sidebar */}
            <div className="space-y-6">
              {/* AGENT ONLY INFORMATION */}
              {isAgent && (
                <>
                  <Card className="border-primary/50">
                    <CardHeader className="bg-primary/5">
                      <CardTitle className="flex items-center gap-2 text-primary">
                        <Lock className="w-5 h-5" />
                        Agent Only Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      {/* Buyer Agent Compensation */}
                      {(listing.commission_rate || listing.commission_notes) && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">Buyer Agent Compensation</h4>
                            <BuyerAgentCompensationInfo />
                          </div>
                          {listing.commission_rate && (
                            <p className="text-sm text-muted-foreground">
                              {listing.commission_type === 'percentage' 
                                ? `${listing.commission_rate}%` 
                                : `$${listing.commission_rate.toLocaleString()}`}
                            </p>
                          )}
                          {listing.commission_notes && (
                            <p className="text-sm text-muted-foreground mt-1">{listing.commission_notes}</p>
                          )}
                          <Separator className="mt-4" />
                        </div>
                      )}

                      {/* Showing Instructions */}
                      {(listing.showing_instructions || listing.lockbox_code || listing.showing_contact_name) && (
                        <div>
                          <h4 className="font-semibold mb-2">Showing Instructions</h4>
                          {listing.showing_instructions && (
                            <p className="text-sm text-muted-foreground mb-2">{listing.showing_instructions}</p>
                          )}
                          {listing.appointment_required && (
                            <Badge variant="outline" className="mb-2">Appointment Required</Badge>
                          )}
                          {listing.lockbox_code && (
                            <div className="flex items-center gap-2 text-sm">
                              <Lock className="w-4 h-4" />
                              <span className="font-mono">{listing.lockbox_code}</span>
                            </div>
                          )}
                          {listing.showing_contact_name && (
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="w-4 h-4" />
                                <span>{listing.showing_contact_name}</span>
                              </div>
                              {listing.showing_contact_phone && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground ml-6">
                                  {formatPhoneNumber(listing.showing_contact_phone)}
                                </div>
                              )}
                            </div>
                          )}
                          <Separator className="mt-4" />
                        </div>
                      )}

                      {/* Documents */}
                      {listing.documents && listing.documents.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">Documents</h4>
                          <div className="space-y-2">
                            {listing.documents.map((doc: any, index: number) => (
                              <a
                                key={index}
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                              >
                                <FileText className="w-4 h-4" />
                                {doc.name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Contact Listing Agent Button */}
                      <div className="pt-4">
                        <ContactAgentDialog 
                          listingId={listing.id}
                          agentId={listing.agent_id}
                          listingAddress={`${listing.address}, ${listing.city}, ${listing.state}`}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Property Data Cards */}
              {listing.value_estimate && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <DollarSign className="h-5 w-5" />
                      Value Estimate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {listing.value_estimate.estimate && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Estimated:</span>
                          <span className="font-semibold">${listing.value_estimate.estimate.toLocaleString()}</span>
                        </div>
                      )}
                      {listing.value_estimate.high && listing.value_estimate.low && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Range:</span>
                          <span className="text-sm">${listing.value_estimate.low.toLocaleString()} - ${listing.value_estimate.high.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
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

              {/* Walk Score */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Footprints className="h-5 w-5" />
                    Walk Score
                  </CardTitle>
                </CardHeader>
                 <CardContent>
                   {listing.walk_score_data ? (
                     <div className="space-y-3">
                       {listing.walk_score_data.walkscore && (
                         <div className="flex justify-between items-center">
                           <span className="text-sm text-muted-foreground">Score:</span>
                           <Badge variant={listing.walk_score_data.walkscore >= 70 ? "default" : "secondary"}>
                             {listing.walk_score_data.walkscore}
                           </Badge>
                         </div>
                       )}
                       {listing.walk_score_data.description && (
                         <p className="text-sm text-muted-foreground">{listing.walk_score_data.description}</p>
                       )}
                     </div>
                   ) : listing.attom_data?.walk_score ? (
                     <div className="space-y-3">
                       <div className="flex justify-between items-center">
                         <span className="text-sm text-muted-foreground">Score:</span>
                         <Badge variant={listing.attom_data.walk_score >= 70 ? "default" : "secondary"}>
                           {listing.attom_data.walk_score}
                         </Badge>
                       </div>
                       {listing.attom_data.walk_score_description && (
                         <p className="text-sm text-muted-foreground">{listing.attom_data.walk_score_description}</p>
                       )}
                     </div>
                   ) : (
                     <p className="text-sm text-muted-foreground">Walk score data not available. ATTOM API needs to be called to fetch this data.</p>
                   )}
                 </CardContent>
              </Card>

              {/* Nearby Schools */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    Nearby Schools
                  </CardTitle>
                </CardHeader>
                 <CardContent>
                   {listing.schools_data && listing.schools_data.schools && listing.schools_data.schools.length > 0 ? (
                     <div className="space-y-3">
                       {listing.schools_data.schools.slice(0, 3).map((school: any, index: number) => (
                         <div key={index} className="flex justify-between items-start border-b pb-3 last:border-0 last:pb-0">
                           <div className="flex-1">
                             <h4 className="font-semibold text-sm">{school.name}</h4>
                             <p className="text-xs text-muted-foreground">{school.type}</p>
                             {school.distance && (
                               <p className="text-xs text-muted-foreground">{school.distance} mi</p>
                             )}
                           </div>
                           {school.rating && (
                             <Badge variant="default" className="text-xs">{school.rating}/10</Badge>
                           )}
                         </div>
                       ))}
                     </div>
                   ) : listing.attom_data?.schools && Array.isArray(listing.attom_data.schools) && listing.attom_data.schools.length > 0 ? (
                     <div className="space-y-3">
                       {listing.attom_data.schools.slice(0, 3).map((school: any, index: number) => (
                         <div key={index} className="flex justify-between items-start border-b pb-3 last:border-0 last:pb-0">
                           <div className="flex-1">
                             <h4 className="font-semibold text-sm">{school.name}</h4>
                             <p className="text-xs text-muted-foreground">{school.type || school.level}</p>
                             {school.distance && (
                               <p className="text-xs text-muted-foreground">{school.distance} mi</p>
                             )}
                           </div>
                           {school.rating && (
                             <Badge variant="default" className="text-xs">{school.rating}/10</Badge>
                           )}
                         </div>
                       ))}
                     </div>
                   ) : (
                     <p className="text-sm text-muted-foreground">School data not available. ATTOM API needs to be called to fetch this data.</p>
                   )}
                  </CardContent>
              </Card>

              {/* Vendor Advertisement */}
              <AdBanner placementZone="listing_sidebar" className="mt-4" />

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, MapPin, Bed, Bath, Square, Calendar, ArrowLeft, Home, FileText, Video, Globe, AlertCircle, DollarSign, Phone, Mail, GraduationCap, Footprints, ChevronLeft, ChevronRight, Maximize2, Share2, Expand } from "lucide-react";
import { toast } from "sonner";
import SocialShareMenu from "@/components/SocialShareMenu";
import FavoriteButton from "@/components/FavoriteButton";
import SaveToHotSheetDialog from "@/components/SaveToHotSheetDialog";
import ScheduleShowingDialog from "@/components/ScheduleShowingDialog";
import ContactAgentDialog from "@/components/ContactAgentDialog";
import BuyerAgentCompensationInfo from "@/components/BuyerAgentCompensationInfo";
import PropertyMap from "@/components/PropertyMap";
import AdBanner from "@/components/AdBanner";
import { buildDisplayAddress } from "@/lib/utils";
import { ShareListingDialog } from "@/components/ShareListingDialog";
import PhotoGalleryDialog from "@/components/PhotoGalleryDialog";

import { formatPhoneNumber } from "@/lib/phoneFormat";
import { useListingView } from "@/hooks/useListingView";
import { PropertyMetaTags } from "@/components/PropertyMetaTags";
import { ListingDetailSections } from "@/components/ListingDetailSections";
import { PropertyDetailRightColumn } from "@/components/PropertyDetailRightColumn";
import { getListingPublicUrl, getListingShareUrl } from "@/lib/getPublicUrl";

interface AgentProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  cell_phone: string | null;
  title: string | null;
  headshot_url: string | null;
  logo_url: string | null;
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
  neighborhood?: string | null;
  video_url?: string | null;
  virtual_tour_url?: string | null;
  property_website_url?: string | null;
}

const ConsumerPropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isAgent, setIsAgent] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  // Track listing view
  useListingView(id);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check if current user is an agent
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: agentProfile } = await supabase
            .from("agent_profiles")
            .select("id")
            .eq("id", session.user.id)
            .maybeSingle();
          
          setIsAgent(!!agentProfile);
        }

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
            .select("id, first_name, last_name, email, cell_phone, phone, title, company, office_name, headshot_url, logo_url")
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

  const handlePrevPhoto = () => {
    if (listing?.photos && listing.photos.length > 0) {
      setCurrentPhotoIndex((prev) => 
        prev === 0 ? listing.photos.length - 1 : prev - 1
      );
    }
  };

  const handleNextPhoto = () => {
    if (listing?.photos && listing.photos.length > 0) {
      setCurrentPhotoIndex((prev) => 
        prev === listing.photos.length - 1 ? 0 : prev + 1
      );
    }
  };

  const handleShareLink = async () => {
    const shareUrl = getListingShareUrl(id!);
    const { trackShare } = await import("@/lib/trackShare");
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: listing?.address || 'Property Listing',
          text: `Check out this property: ${listing?.address}`,
          url: shareUrl,
        });
        await trackShare(id!, 'native');
        return;
      } catch (error) {
        // User cancelled or share failed, fall back to clipboard
      }
    }
    
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");
    await trackShare(id!, 'copy_link');
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

  // Helper to handle both string and object photo formats
  const getPhotoUrl = (photo: any): string => {
    if (typeof photo === 'string') return photo;
    return photo?.url || '/placeholder.svg';
  };

  const mainPhoto = listing.photos && listing.photos.length > 0 
    ? getPhotoUrl(listing.photos[currentPhotoIndex]) 
    : '/placeholder.svg';
  const canonicalUrl = getListingPublicUrl(id!);

  return (
    <div className="min-h-screen bg-background">
      <PropertyMetaTags
        address={listing.address}
        city={listing.city}
        state={listing.state}
        price={listing.price}
        bedrooms={listing.bedrooms}
        bathrooms={listing.bathrooms}
        description={listing.description}
        photo={mainPhoto}
        listingType={listing.listing_type}
        listingId={id!}
      />
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-24" style={{ maxWidth: '1600px' }}>
        <div className="mx-auto">
          {/* Hero Image Section with Carousel Controls */}
          <div className="relative mb-6">
            <div className="relative h-[500px] rounded-lg overflow-hidden group">
              <img 
                src={mainPhoto} 
                alt={listing.address} 
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setGalleryOpen(true)}
              />
              
              {/* Carousel Arrow Controls - Always Visible */}
              {listing.photos && listing.photos.length > 1 && (
                <>
                  <button
                    onClick={handlePrevPhoto}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all z-10"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={handleNextPhoto}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all z-10"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
              
              {/* Expand Button */}
              <button
                onClick={() => setGalleryOpen(true)}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all z-10"
                aria-label="Expand gallery"
              >
                <Expand className="w-5 h-5" />
              </button>
              
              {/* Photo Counter */}
              {listing.photos && listing.photos.length > 0 && (
                <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm z-10">
                  {currentPhotoIndex + 1} / {listing.photos.length}
                </div>
              )}
              
              {/* Overlay buttons */}
              <div className="absolute top-4 left-4 flex gap-2 z-10">
                <button
                  onClick={() => navigate("/browse")}
                  className="p-2 rounded-md bg-white/90 hover:bg-white transition-colors text-muted-foreground hover:text-foreground shadow-md"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
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
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-6 h-6 text-primary mt-1" />
              <div>
                <h1 className="text-3xl font-bold mb-1">{buildDisplayAddress(listing)}</h1>
                <p className="text-xl text-muted-foreground">
                  {listing.city}, {listing.state} {listing.zip_code}
                </p>
                {(listing.neighborhood || listing.attom_data?.neighborhood) && (
                  <div className="mt-1">
                    <Badge variant="secondary" className="text-sm">
                      {listing.neighborhood || listing.attom_data?.neighborhood}
                    </Badge>
                  </div>
                )}
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

          {/* Action Bar */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button variant="outline" size="sm" onClick={handleShareLink} className="gap-2">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
            {listing.video_url && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.open(listing.video_url!, '_blank')}
                className="gap-2"
              >
                <Video className="w-4 h-4" />
                Video
              </Button>
            )}
            {listing.virtual_tour_url && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.open(listing.virtual_tour_url!, '_blank')}
                className="gap-2"
              >
                <Maximize2 className="w-4 h-4" />
                Virtual Tour
              </Button>
            )}
            {listing.property_website_url && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.open(listing.property_website_url!, '_blank')}
                className="gap-2"
              >
                <Globe className="w-4 h-4" />
                Property Website
              </Button>
            )}
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

              {/* Property Features - combined from property_features + amenities, deduplicated */}
              {(() => {
                const features = listing.property_features || [];
                const amenities = listing.amenities || [];
                const combined = [...new Set([...features, ...amenities])];
                if (combined.length === 0) return null;
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle>Property Features</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {combined.map((feature, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            <span className="text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
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
                      {listing.garage_spaces && (
                        <div>
                          <p className="text-sm text-muted-foreground">Garage Spaces</p>
                          <p className="font-semibold">{listing.garage_spaces}</p>
                        </div>
                      )}
                    </div>
                    {listing.disclosures?.find((d: string) => d.startsWith('Parking Comments:')) && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-2">Parking Comments</p>
                        <p className="text-sm">{listing.disclosures.find((d: string) => d.startsWith('Parking Comments:'))?.replace('Parking Comments: ', '')}</p>
                      </div>
                    )}
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
                    {listing.disclosures?.find((d: string) => d.startsWith('Garage Comments:')) && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-2">Garage Comments</p>
                        <p className="text-sm">{listing.disclosures.find((d: string) => d.startsWith('Garage Comments:'))?.replace('Garage Comments: ', '')}</p>
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

              {/* MLS-Style Detail Sections */}
              <ListingDetailSections 
                listing={listing} 
                agent={agent}
                isAgentView={false}
              />

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

            {/* Sidebar - Right Column */}
            <PropertyDetailRightColumn 
              listing={listing} 
              agent={agent}
              isAgentView={false}
            />
            
            {/* Additional Sidebar Items */}
            <div className="space-y-6">
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

              {/* Vendor Advertisement */}
              <AdBanner placementZone="listing_sidebar" className="mt-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Photo Gallery Dialog */}
      {listing && listing.photos && (
        <PhotoGalleryDialog
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          photos={listing.photos}
          floorPlans={listing.floor_plans || []}
          initialIndex={currentPhotoIndex}
        />
      )}
    </div>
  );
};

export default ConsumerPropertyDetail;

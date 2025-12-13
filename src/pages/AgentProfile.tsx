import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Loader2, 
  Home, 
  Star, 
  Gift,
  TrendingUp,
  Quote,
  HomeIcon
} from "lucide-react";
import { toast } from "sonner";
import ContactAgentProfileDialog from "@/components/ContactAgentProfileDialog";
import AgentProfileHeader from "@/components/AgentProfileHeader";

const generateVCard = (agent: AgentProfile) => {
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${agent.first_name} ${agent.last_name}`,
    `N:${agent.last_name};${agent.first_name};;;`,
    `EMAIL:${agent.email}`,
    agent.cell_phone ? `TEL;TYPE=CELL:${agent.cell_phone}` : '',
    agent.office_phone ? `TEL;TYPE=WORK:${agent.office_phone}` : '',
    agent.title ? `TITLE:${agent.title}` : '',
    agent.company ? `ORG:${agent.company}` : '',
    agent.office_address ? `ADR;TYPE=WORK:;;${agent.office_address};;;;` : '',
    agent.social_links?.website ? `URL:${agent.social_links.website}` : '',
    agent.social_links?.linkedin ? `X-SOCIALPROFILE;TYPE=linkedin:${agent.social_links.linkedin}` : '',
    'END:VCARD'
  ].filter(line => line).join('\n');
  
  const blob = new Blob([vcard], { type: 'text/vcard' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${agent.first_name}_${agent.last_name}.vcf`;
  link.click();
  window.URL.revokeObjectURL(url);
};

interface AgentProfile {
  id: string;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string;
  phone: string | null;
  cell_phone: string | null;
  office_phone: string | null;
  company: string | null;
  office_name: string | null;
  office_address: string | null;
  office_city: string | null;
  office_state: string | null;
  office_zip: string | null;
  bio: string | null;
  buyer_incentives: string | null;
  seller_incentives: string | null;
  headshot_url: string | null;
  logo_url: string | null;
  social_links: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    website?: string;
  } | null;
  receive_buyer_alerts: boolean;
  aac_id?: string | null;
  header_background_type?: string;
  header_background_value?: string;
  header_image_url?: string;
  agent_county_preferences: {
    county_id: string;
    counties: {
      name: string;
      state: string;
    };
  }[];
}

interface Testimonial {
  id: string;
  client_name: string;
  client_title: string | null;
  testimonial_text: string;
  rating: number | null;
  created_at: string;
}

const AgentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgentProfile();
  }, [id]);

  const fetchAgentProfile = async () => {
    try {
      setLoading(true);

      const { data: agentData, error: agentError } = await supabase
        .from("agent_profiles")
        .select(`
          *,
          agent_county_preferences (
            county_id,
            counties (name, state)
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (agentError) throw agentError;
      if (!agentData) {
        toast.error("Agent not found");
        navigate("/our-agents");
        return;
      }

      setAgent(agentData as AgentProfile);

      const { data: listingsData, error: listingsError } = await supabase
        .from("listings")
        .select("*")
        .eq("agent_id", id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(6);

      if (listingsError) throw listingsError;
      setListings(listingsData || []);

      const { data: testimonialsData, error: testimonialsError } = await supabase
        .from("testimonials")
        .select("*")
        .eq("agent_id", id)
        .order("created_at", { ascending: false });

      if (testimonialsError) throw testimonialsError;
      setTestimonials(testimonialsData || []);
    } catch (error: any) {
      console.error("Error fetching agent profile:", error);
      toast.error("Failed to load agent profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh] mt-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 mt-20">
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Agent not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Premium Header - Extends to very top (behind nav) */}
      <div className="pt-16">
        <AgentProfileHeader 
          agent={agent} 
          onSaveContact={() => generateVCard(agent)} 
        />

        {/* Main Content */}
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-10">
          <div className="max-w-3xl space-y-12">
            {/* About Me Section */}
            {agent.bio && (
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  About Me
                </h2>
                <div className="max-w-prose">
                  <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {agent.bio}
                  </p>
                </div>
              </section>
            )}

            {/* Client Incentives Section */}
            {(agent.buyer_incentives || agent.seller_incentives) && (
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  Client Incentives
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {agent.buyer_incentives && (
                    <Card className="border shadow-sm rounded-xl bg-accent/5">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-accent/10 flex-shrink-0">
                            <Gift className="h-5 w-5 text-accent" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-1.5">Buyer Incentives</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                              {agent.buyer_incentives}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {agent.seller_incentives && (
                    <Card className="border shadow-sm rounded-xl bg-card">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-muted flex-shrink-0">
                            <TrendingUp className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-1.5">Seller Incentives</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                              {agent.seller_incentives}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </section>
            )}

            {/* Client Testimonials Section */}
            {testimonials.length > 0 && (
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  Client Testimonials
                </h2>
                <div className="space-y-4">
                  {testimonials.slice(0, 3).map((testimonial) => (
                    <Card key={testimonial.id} className="border shadow-md rounded-xl overflow-hidden">
                      <CardContent className="p-6 relative">
                        <Quote className="absolute top-4 right-4 h-8 w-8 text-muted-foreground/20" />
                        {testimonial.rating && (
                          <div className="flex gap-0.5 mb-3">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < testimonial.rating!
                                    ? "text-amber-500 fill-amber-500"
                                    : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                        <p className="text-foreground/80 italic leading-relaxed pr-8">
                          "{testimonial.testimonial_text}"
                        </p>
                        <p className="mt-4 text-sm font-semibold text-foreground">
                          — {testimonial.client_name}
                        </p>
                        {testimonial.client_title && (
                          <p className="text-xs text-muted-foreground">
                            {testimonial.client_title}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Active Listings Section - Full Width */}
        <div className="bg-muted/30 border-t border-border/40">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-12">
            <h2 className="text-2xl font-semibold text-foreground mb-6 text-center">
              {agent.first_name}'s Listings
            </h2>
            
            {listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                  <HomeIcon className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <p className="text-lg text-muted-foreground mb-2">
                  This agent currently has no active listings.
                </p>
                <p className="text-muted-foreground mb-6">
                  Browse available homes or contact the agent directly.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={() => navigate('/browse')}>
                    <Home className="h-4 w-4 mr-2" />
                    Browse Properties
                  </Button>
                  <ContactAgentProfileDialog 
                    agentId={agent.id}
                    agentName={`${agent.first_name} ${agent.last_name}`}
                    agentEmail={agent.email}
                  />
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((listing) => (
                  <Card 
                    key={listing.id} 
                    className="cursor-pointer hover:shadow-lg transition-all duration-300 border overflow-hidden group bg-card"
                    onClick={() => navigate(`/property/${listing.id}`)}
                  >
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={listing.photos && listing.photos.length > 0 ? listing.photos[0].url : '/placeholder.svg'}
                        alt={listing.address}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <Badge className="absolute top-3 right-3 bg-accent text-accent-foreground">
                        {listing.listing_type === 'for_sale' ? 'For Sale' : 'For Rent'}
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <p className="text-2xl font-bold text-primary mb-2">
                        ${listing.price.toLocaleString()}
                      </p>
                      <p className="font-semibold text-foreground text-sm mb-1 truncate">
                        {listing.address}
                      </p>
                      <p className="text-sm text-muted-foreground mb-3">
                        {listing.city}, {listing.state} {listing.zip_code}
                      </p>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        {listing.bedrooms && (
                          <span>{listing.bedrooms} bed</span>
                        )}
                        {listing.bathrooms && (
                          <span>{listing.bathrooms} bath</span>
                        )}
                        {listing.square_feet && (
                          <span>{listing.square_feet.toLocaleString()} sqft</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AgentProfile;

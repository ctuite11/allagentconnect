import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  Phone, 
  ArrowLeft, 
  Loader2, 
  Home, 
  Star, 
  Globe, 
  Linkedin, 
  Facebook, 
  Twitter, 
  Instagram, 
  Download,
  Users,
  ShieldCheck,
  Gift,
  TrendingUp,
  Quote,
  HomeIcon
} from "lucide-react";
import { toast } from "sonner";
import ContactAgentProfileDialog from "@/components/ContactAgentProfileDialog";
import { formatPhoneNumber } from "@/lib/phoneFormat";

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

  const hasSocialLinks = agent.social_links && Object.values(agent.social_links).some(link => link);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="pt-20">
        {/* Back Button */}
        <div className="max-w-6xl mx-auto px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Hero Header Section - Compass-style 3-column layout */}
        <div className="border-b border-border/40 bg-card">
          <div className="max-w-6xl mx-auto px-6 py-10">
            <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_180px] gap-8 lg:gap-12">
              
              {/* LEFT COLUMN: Photo + Buttons + Social Icons */}
              <div className="flex flex-col items-center lg:items-start">
                {/* Agent Photo */}
                <div className="w-44 h-44 lg:w-52 lg:h-52 rounded-lg overflow-hidden bg-muted shadow-md">
                  {agent.headshot_url ? (
                    <img 
                      src={agent.headshot_url} 
                      alt={`${agent.first_name} ${agent.last_name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                      <span className="text-4xl font-bold text-primary">
                        {agent.first_name[0]}{agent.last_name[0]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2.5 w-full max-w-[200px] mt-5">
                  <ContactAgentProfileDialog 
                    agentId={agent.id}
                    agentName={`${agent.first_name} ${agent.last_name}`}
                    agentEmail={agent.email}
                  />
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => generateVCard(agent)}
                  >
                    <Download className="h-4 w-4" />
                    Save Contact
                  </Button>
                </div>

                {/* Social Media Section */}
                {hasSocialLinks && (
                  <div className="mt-6 w-full max-w-[200px]">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Social Media</p>
                    <div className="flex flex-col gap-2">
                      {agent.social_links?.facebook && (
                        <a 
                          href={agent.social_links.facebook} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center">
                            <Facebook className="h-4 w-4" />
                          </div>
                          <span>Facebook</span>
                        </a>
                      )}
                      {agent.social_links?.instagram && (
                        <a 
                          href={agent.social_links.instagram} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center">
                            <Instagram className="h-4 w-4" />
                          </div>
                          <span>Instagram</span>
                        </a>
                      )}
                      {agent.social_links?.linkedin && (
                        <a 
                          href={agent.social_links.linkedin} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center">
                            <Linkedin className="h-4 w-4" />
                          </div>
                          <span>LinkedIn</span>
                        </a>
                      )}
                      {agent.social_links?.twitter && (
                        <a 
                          href={agent.social_links.twitter} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center">
                            <Twitter className="h-4 w-4" />
                          </div>
                          <span>X (Twitter)</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* CENTER COLUMN: Agent Details */}
              <div className="text-center lg:text-left">
                <h1 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
                  {agent.first_name} {agent.last_name}
                </h1>
                
                {agent.title && (
                  <p className="text-lg text-muted-foreground mt-1">
                    {agent.title}
                  </p>
                )}

                {agent.company && (
                  <p className="text-muted-foreground mt-0.5">
                    {agent.company}
                  </p>
                )}

                {agent.aac_id && (
                  <p className="text-sm text-muted-foreground/70 mt-2">
                    Agent ID: {agent.aac_id}
                  </p>
                )}
                
                {/* Contact Information */}
                <div className="mt-6 space-y-2">
                  {agent.email && (
                    <a 
                      href={`mailto:${agent.email}`} 
                      className="block text-foreground hover:text-primary transition-colors"
                    >
                      {agent.email}
                    </a>
                  )}
                  
                  <div className="flex flex-col lg:flex-row gap-1 lg:gap-4 text-muted-foreground">
                    {agent.office_phone && agent.office_phone.trim() && (
                      <a href={`tel:${agent.office_phone}`} className="hover:text-primary transition-colors">
                        O: {formatPhoneNumber(agent.office_phone)}
                      </a>
                    )}
                    {agent.cell_phone && agent.cell_phone.trim() && (
                      <a href={`tel:${agent.cell_phone}`} className="hover:text-primary transition-colors">
                        M: {formatPhoneNumber(agent.cell_phone)}
                      </a>
                    )}
                  </div>

                  {agent.social_links?.website && (
                    <a 
                      href={agent.social_links.website.startsWith('http') ? agent.social_links.website : `https://${agent.social_links.website}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline mt-2"
                    >
                      <Globe className="h-4 w-4" />
                      {agent.social_links.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  )}
                </div>

                {/* CTA Button for Desktop - centered in this column */}
                <div className="mt-6 hidden lg:block">
                  <Button size="lg" className="px-8">
                    Work with {agent.first_name}
                  </Button>
                </div>
              </div>

              {/* RIGHT COLUMN: Logo + Badges */}
              <div className="flex flex-col items-center lg:items-end justify-start gap-4">
                {agent.logo_url && (
                  <img 
                    src={agent.logo_url} 
                    alt="Company logo" 
                    className="h-14 max-w-[140px] object-contain opacity-90"
                  />
                )}
                <div className="flex flex-col gap-2 items-center lg:items-end">
                  <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs rounded-full border-primary/30 bg-primary/5 text-primary">
                    <Users className="h-3 w-3" />
                    DirectConnect Friendly
                  </Badge>
                  <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs rounded-full border-accent/30 bg-accent/5 text-accent">
                    <ShieldCheck className="h-3 w-3" />
                    Verified Agent
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_180px] gap-8 lg:gap-12">
            {/* Left spacer for alignment */}
            <div className="hidden lg:block" />

            {/* Center content area */}
            <div className="space-y-12">
              {/* About Me Section */}
              {agent.bio && (
                <section>
                  <h2 className="text-2xl font-semibold text-foreground mb-4">
                    About {agent.first_name}
                  </h2>
                  <div className="max-w-2xl">
                    <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {agent.bio}
                    </p>
                  </div>
                </section>
              )}

              {/* Client Testimonials Section */}
              {testimonials.length > 0 && (
                <section>
                  <h2 className="text-2xl font-semibold text-foreground mb-4">
                    Client Testimonials
                  </h2>
                  <div className="space-y-4 max-w-2xl">
                    {testimonials.slice(0, 3).map((testimonial) => (
                      <Card key={testimonial.id} className="border shadow-sm rounded-xl overflow-hidden">
                        <CardContent className="p-5">
                          {testimonial.rating && (
                            <div className="flex gap-0.5 mb-3">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < testimonial.rating!
                                      ? "text-foreground fill-foreground"
                                      : "text-muted-foreground/30"
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                          <p className="text-foreground/80 italic leading-relaxed">
                            "{testimonial.testimonial_text}"
                          </p>
                          <p className="mt-3 text-sm font-semibold text-foreground">
                            -{testimonial.client_name}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* Incentives Section */}
              {(agent.buyer_incentives || agent.seller_incentives) && (
                <section>
                  <h2 className="text-2xl font-semibold text-foreground mb-4">
                    Client Incentives
                  </h2>
                  <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
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
                      <Card className="border shadow-sm rounded-xl bg-primary/5">
                        <CardContent className="p-5">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
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
            </div>

            {/* Right spacer */}
            <div className="hidden lg:block" />
          </div>
        </div>

        {/* Active Listings Section - Full Width */}
        <div className="bg-muted/30 border-t border-border/40">
          <div className="max-w-6xl mx-auto px-6 py-12">
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

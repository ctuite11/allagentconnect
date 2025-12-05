import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="min-h-screen bg-secondary/30">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-24">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Hero Header Section */}
        <Card className="mb-8 overflow-hidden shadow-lg border-0">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
              {/* Left Column - Photo & Save Contact */}
              <div className="flex flex-col items-center lg:items-start flex-shrink-0">
                <div className="w-40 h-40 md:w-44 md:h-44 rounded-full overflow-hidden border-4 border-primary/20 shadow-lg">
                  {agent.headshot_url ? (
                    <img 
                      src={agent.headshot_url} 
                      alt={`${agent.first_name} ${agent.last_name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                      <span className="text-5xl font-bold text-primary">
                        {agent.first_name[0]}{agent.last_name[0]}
                      </span>
                    </div>
                  )}
                </div>
                {agent.aac_id && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Agent ID: {agent.aac_id}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2 rounded-full px-5"
                  onClick={() => generateVCard(agent)}
                >
                  <Download className="h-4 w-4" />
                  Save Contact
                </Button>
              </div>
              
              {/* Middle Column - Name, Title, Contact Info, CTAs */}
              <div className="flex-1 text-center lg:text-left">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                  {agent.first_name} {agent.last_name}
                </h1>
                
                {(agent.title || agent.company) && (
                  <p className="text-lg text-muted-foreground mb-4">
                    {agent.title}{agent.title && agent.company && ' • '}{agent.company}
                  </p>
                )}
                
                <div className="space-y-2 mb-6">
                  {agent.office_phone && agent.office_phone.trim() && (
                    <div className="flex items-center justify-center lg:justify-start gap-3 text-foreground">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${agent.office_phone}`} className="hover:text-primary transition-colors">
                        Office: {formatPhoneNumber(agent.office_phone)}
                      </a>
                    </div>
                  )}
                  {agent.cell_phone && agent.cell_phone.trim() && (
                    <div className="flex items-center justify-center lg:justify-start gap-3 text-foreground">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${agent.cell_phone}`} className="hover:text-primary transition-colors">
                        Cell: {formatPhoneNumber(agent.cell_phone)}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center justify-center lg:justify-start gap-3 text-foreground">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${agent.email}`} className="hover:text-primary transition-colors">
                      {agent.email}
                    </a>
                  </div>
                </div>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-4">
                  <ContactAgentProfileDialog 
                    agentId={agent.id}
                    agentName={`${agent.first_name} ${agent.last_name}`}
                    agentEmail={agent.email}
                  />
                  {agent.social_links?.website && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      asChild
                    >
                      <a 
                        href={agent.social_links.website.startsWith('http') ? agent.social_links.website : `https://${agent.social_links.website}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <Globe className="h-4 w-4" />
                        Visit My Website
                      </a>
                    </Button>
                  )}
                </div>

                {/* Social Links */}
                {agent.social_links && Object.values(agent.social_links).some(link => link) && (
                  <div className="flex gap-2 justify-center lg:justify-start">
                    {agent.social_links.linkedin && (
                      <a href={agent.social_links.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-[#0A66C2] hover:bg-[#004182] text-white transition-colors">
                        <Linkedin className="h-4 w-4" />
                      </a>
                    )}
                    {agent.social_links.facebook && (
                      <a href={agent.social_links.facebook} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-[#1877F2] hover:bg-[#166FE5] text-white transition-colors">
                        <Facebook className="h-4 w-4" />
                      </a>
                    )}
                    {agent.social_links.twitter && (
                      <a href={agent.social_links.twitter} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-foreground hover:bg-foreground/80 text-background transition-colors">
                        <Twitter className="h-4 w-4" />
                      </a>
                    )}
                    {agent.social_links.instagram && (
                      <a href={agent.social_links.instagram} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 hover:from-purple-700 hover:via-pink-600 hover:to-orange-500 text-white transition-colors">
                        <Instagram className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column - Logo & Badges */}
              <div className="flex flex-col items-center lg:items-end gap-4 flex-shrink-0">
                {agent.logo_url && (
                  <img 
                    src={agent.logo_url} 
                    alt="Company logo" 
                    className="h-16 md:h-20 object-contain"
                  />
                )}
                <div className="flex flex-col gap-2">
                  <Badge variant="outline" className="gap-2 px-4 py-1.5 rounded-full border-primary/30 bg-primary/5 text-primary">
                    <Users className="h-3.5 w-3.5" />
                    DirectConnect Friendly
                  </Badge>
                  <Badge variant="outline" className="gap-2 px-4 py-1.5 rounded-full border-accent/30 bg-accent/5 text-accent">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verified Agent
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div id="agent-main-content" className="space-y-8">
          {/* Bio Section */}
          {agent.bio && (
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Bio</h2>
              <Card className="shadow-md border-0">
                <CardContent className="p-6 md:p-8">
                  <p className="text-foreground leading-relaxed text-lg whitespace-pre-wrap">
                    {agent.bio}
                  </p>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Incentives Section */}
          {(agent.buyer_incentives || agent.seller_incentives) && (
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Incentives</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {agent.buyer_incentives && (
                  <Card className="shadow-md border-0 overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-accent/10 flex-shrink-0">
                          <Gift className="h-6 w-6 text-accent" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-foreground mb-2">Buyer Incentives</h3>
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {agent.buyer_incentives}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {agent.seller_incentives && (
                  <Card className="shadow-md border-0 overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-primary/10 flex-shrink-0">
                          <TrendingUp className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-foreground mb-2">Seller Incentives</h3>
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
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

          {/* Testimonials Section */}
          {testimonials.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Client Testimonials</h2>
              <div className="grid gap-6">
                {testimonials.map((testimonial) => (
                  <Card key={testimonial.id} className="shadow-md border-0">
                    <CardContent className="p-6 md:p-8">
                      {testimonial.rating && (
                        <div className="flex gap-1 mb-4">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-5 w-5 ${
                                i < testimonial.rating!
                                  ? "text-yellow-500 fill-yellow-500"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                      )}
                      <div className="flex gap-3 mb-4">
                        <Quote className="h-8 w-8 text-primary/20 flex-shrink-0 transform rotate-180" />
                        <p className="text-foreground text-lg italic leading-relaxed">
                          {testimonial.testimonial_text}
                        </p>
                      </div>
                      <div className="ml-11">
                        <p className="font-bold text-foreground">{testimonial.client_name}</p>
                        {testimonial.client_title && (
                          <p className="text-sm text-muted-foreground">{testimonial.client_title}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Active Listings Section */}
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Active Listings ({listings.length})
            </h2>
            <Card className="shadow-md border-0">
              <CardContent className="p-6 md:p-8">
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
                        className="cursor-pointer hover:shadow-lg transition-all duration-300 border overflow-hidden group"
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
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AgentProfile;

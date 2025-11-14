import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Phone, Building2, MapPin, ArrowLeft, Loader2, Home, Star, Briefcase, Globe, Linkedin, Facebook, Twitter, Instagram, DollarSign, Award, Download } from "lucide-react";
import { toast } from "sonner";
import ContactAgentProfileDialog from "@/components/ContactAgentProfileDialog";

import { formatPhoneNumber } from "@/lib/phoneFormat";

const formatPhoneNumber_OLD = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

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
  
  // Scroll to main content section after saving contact
  setTimeout(() => {
    const mainContent = document.getElementById('agent-main-content');
    if (mainContent) {
      const yOffset = -100; // Account for fixed navigation
      const y = mainContent.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, 200);
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

      // Fetch agent profile
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

      // Fetch agent's active listings
      const { data: listingsData, error: listingsError } = await supabase
        .from("listings")
        .select("*")
        .eq("agent_id", id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(6);

      if (listingsError) throw listingsError;
      setListings(listingsData || []);

      // Fetch testimonials
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
          <Loader2 className="h-8 w-8 animate-spin" />
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
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Hero Section with Agent Contact Information */}
        <div className="bg-gradient-to-br from-primary/5 via-background to-secondary/5 rounded-xl p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-8 items-start mb-8">
            {/* Headshot and Agent ID */}
            <div className="flex-shrink-0">
              <div className="w-48 h-64 rounded-lg overflow-hidden border-4 border-background shadow-xl">
                {agent.headshot_url ? (
                  <img 
                    src={agent.headshot_url} 
                    alt={`${agent.first_name} ${agent.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                    <span className="text-6xl font-bold text-primary">
                      {agent.first_name[0]}{agent.last_name[0]}
                    </span>
                  </div>
                )}
              </div>
              {agent.aac_id && (
                <div className="mt-3 text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    <span className="font-semibold">Agent Id:</span> {agent.aac_id}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full"
                    onClick={() => generateVCard(agent)}
                  >
                    <Download className="h-4 w-4" />
                    Save Contact
                  </Button>
                </div>
              )}
            </div>
            
            {/* Contact Information - Simple Text Layout */}
            <div className="flex-1 space-y-0">
              <div className="flex items-start justify-between mb-1">
                <h1 className="text-3xl font-bold">
                  {agent.first_name} {agent.last_name}
                </h1>
                {agent.logo_url && (
                  <img src={agent.logo_url} alt="Company logo" className="h-28 object-contain" />
                )}
              </div>
              
              {agent.title && (
                <p className="text-lg text-muted-foreground">
                  <span className="font-semibold">Title:</span> {agent.title}
                </p>
              )}
              
              
              
              {agent.office_phone && agent.office_phone.trim() && (
                <p className="text-lg text-muted-foreground">
                  <span className="font-semibold">Office:</span>{' '}
                  <a href={`tel:${agent.office_phone}`} className="hover:text-primary transition-colors">
                    {formatPhoneNumber(agent.office_phone)}
                  </a>
                </p>
              )}
              {agent.cell_phone && agent.cell_phone.trim() && (
                <p className="text-lg text-muted-foreground">
                  <span className="font-semibold">Cell:</span>{' '}
                  <a href={`tel:${agent.cell_phone}`} className="hover:text-primary transition-colors">
                    {formatPhoneNumber(agent.cell_phone)}
                  </a>
                </p>
              )}
              
              <p className="text-lg text-muted-foreground">
                <span className="font-semibold">Email:</span>{' '}
                <a href={`mailto:${agent.email}`} className="hover:text-primary transition-colors">
                  {agent.email}
                </a>
              </p>

              {agent.social_links?.website && (
                <p className="text-lg text-muted-foreground">
                  <span className="font-semibold">My website:</span>{' '}
                  <a href={agent.social_links.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    {agent.social_links.website}
                  </a>
                </p>
              )}

              <div className="flex flex-wrap gap-3 pt-4">
                <ContactAgentProfileDialog 
                  agentId={agent.id}
                  agentName={`${agent.first_name} ${agent.last_name}`}
                  agentEmail={agent.email}
                />
              </div>

              {agent.social_links && Object.values(agent.social_links).some(link => link) && (
                <div className="pt-2">
                  <div className="flex gap-3">
                    {agent.social_links.website && (
                      <a href={agent.social_links.website} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
                        <Globe className="h-5 w-5" />
                      </a>
                    )}
                    {agent.social_links.linkedin && (
                      <a href={agent.social_links.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white transition-colors">
                        <Linkedin className="h-5 w-5" />
                      </a>
                    )}
                    {agent.social_links.facebook && (
                      <a href={agent.social_links.facebook} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#1877F2] hover:bg-[#166FE5] text-white transition-colors">
                        <Facebook className="h-5 w-5" />
                      </a>
                    )}
                    {agent.social_links.twitter && (
                      <a href={agent.social_links.twitter} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-black hover:bg-gray-800 text-white transition-colors">
                        <Twitter className="h-5 w-5" />
                      </a>
                    )}
                    {agent.social_links.instagram && (
                      <a href={agent.social_links.instagram} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 hover:from-purple-700 hover:via-pink-600 hover:to-orange-500 text-white transition-colors">
                        <Instagram className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Main Content */}
        <div id="agent-main-content" className="space-y-6">
          {/* Bio Section */}
          {agent.bio && (
            <Card>
              <CardHeader>
                <CardTitle>About Me</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{agent.bio}</p>
              </CardContent>
            </Card>
          )}

          {/* Incentives Section */}
          {(agent.buyer_incentives || agent.seller_incentives) && (
            <div className="grid md:grid-cols-2 gap-6">
              {agent.buyer_incentives && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <DollarSign className="h-5 w-5 text-accent" />
                      Buyer Incentives
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{agent.buyer_incentives}</p>
                  </CardContent>
                </Card>
              )}
              {agent.seller_incentives && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <DollarSign className="h-5 w-5 text-accent" />
                      Seller Incentives
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{agent.seller_incentives}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Testimonials Section */}
          {testimonials.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  Client Testimonials
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {testimonials.map((testimonial) => (
                    <Card key={testimonial.id} className="border-l-4 border-l-primary/50">
                      <CardContent className="pt-6">
                        {testimonial.rating && (
                          <div className="flex gap-1 mb-2">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < testimonial.rating!
                                    ? "text-yellow-500 fill-yellow-500"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                        <p className="text-muted-foreground italic mb-3">"{testimonial.testimonial_text}"</p>
                        <div className="text-sm">
                          <p className="font-semibold">{testimonial.client_name}</p>
                          {testimonial.client_title && (
                            <p className="text-muted-foreground">{testimonial.client_title}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Listings Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Active Listings ({listings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {listings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No active listings at this time
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {listings.map((listing) => (
                    <Card key={listing.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/property/${listing.id}`)}>
                      <div className="relative h-48 overflow-hidden rounded-t-lg">
                        <img
                          src={listing.photos && listing.photos.length > 0 ? listing.photos[0].url : '/placeholder.svg'}
                          alt={listing.address}
                          className="w-full h-full object-cover"
                        />
                        <Badge className="absolute top-2 right-2 bg-accent">
                          {listing.listing_type === 'for_sale' ? 'For Sale' : 'For Rent'}
                        </Badge>
                      </div>
                      <CardContent className="pt-4">
                        <p className="text-2xl font-bold text-primary mb-2">
                          ${listing.price.toLocaleString()}
                        </p>
                        <p className="font-semibold text-sm mb-1">{listing.address}</p>
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
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AgentProfile;

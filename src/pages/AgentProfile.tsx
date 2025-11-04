import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, Building2, MapPin, ArrowLeft, Loader2, Home } from "lucide-react";
import { toast } from "sonner";
import ContactAgentProfileDialog from "@/components/ContactAgentProfileDialog";

interface AgentProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
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

const AgentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [listings, setListings] = useState<any[]>([]);
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

      setAgent(agentData);

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
      <div className="container mx-auto px-4 py-8 mt-20">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Agent Info Card */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-center w-24 h-24 mx-auto bg-primary/10 rounded-full mb-4">
                  <span className="text-3xl font-bold text-primary">
                    {agent.first_name[0]}{agent.last_name[0]}
                  </span>
                </div>
                <CardTitle className="text-center text-2xl">
                  {agent.first_name} {agent.last_name}
                </CardTitle>
                {agent.aac_id && (
                  <div className="text-center text-sm text-muted-foreground font-mono">
                    {agent.aac_id}
                  </div>
                )}
                {agent.company && (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>{agent.company}</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <a href={`mailto:${agent.email}`} className="text-primary hover:underline break-all">
                      {agent.email}
                    </a>
                  </div>

                  {agent.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <a href={`tel:${agent.phone}`} className="text-primary hover:underline">
                        {agent.phone}
                      </a>
                    </div>
                  )}
                </div>

                <Separator />

                {agent.agent_county_preferences && agent.agent_county_preferences.length > 0 && (
                  <div>
                    <div className="flex items-start gap-2 mb-3">
                      <MapPin className="h-5 w-5 flex-shrink-0 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-semibold mb-2">Service Areas</p>
                        <div className="flex flex-wrap gap-2">
                          {agent.agent_county_preferences.map((pref: any) => (
                            <Badge key={pref.county_id} variant="secondary">
                              {pref.counties.name}, {pref.counties.state}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {agent.receive_buyer_alerts && (
                  <Badge variant="outline" className="w-full justify-center">
                    Accepting Buyer Inquiries
                  </Badge>
                )}

                <ContactAgentProfileDialog 
                  agentId={agent.id}
                  agentName={`${agent.first_name} ${agent.last_name}`}
                  agentEmail={agent.email}
                />
              </CardContent>
            </Card>
          </div>

          {/* Listings Grid */}
          <div className="lg:col-span-2">
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
                          <Badge className="absolute top-2 right-2 bg-green-600">
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
      </div>
      <Footer />
    </div>
  );
};

export default AgentProfile;

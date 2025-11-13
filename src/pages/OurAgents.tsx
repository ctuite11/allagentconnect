import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Phone, Building2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

import { formatPhoneNumber } from "@/lib/phoneFormat";

const OurAgents = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    fetchAgents();
  }, []);


  const fetchAgents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("agent_profiles")
        .select(`
          *,
          agent_county_preferences (
            county_id,
            counties (name, state)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAgents(data || []);
    } catch (error: any) {
      toast.error("Failed to load agents");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter((agent) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      agent.first_name?.toLowerCase().includes(query) ||
      agent.last_name?.toLowerCase().includes(query) ||
      agent.company?.toLowerCase().includes(query) ||
      agent.email?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Meet Our Professional Agents
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Connect with experienced real estate professionals ready to help you find your perfect property
            </p>
            
            <div className="max-w-md mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <Input
                  type="text"
                  placeholder="Search agents by name, company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Agents Grid */}
        <section className="py-12 bg-muted/30">
          <div className="container mx-auto px-4">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading agents...</p>
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery ? "No agents found matching your search" : "No agents available"}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6 text-sm text-muted-foreground">
                  {filteredAgents.length} {filteredAgents.length === 1 ? "agent" : "agents"} available
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAgents.map((agent) => (
                    <Card key={agent.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <Avatar className="w-32 h-32 mx-auto mb-4">
                          <AvatarImage src={agent.headshot_url} alt={`${agent.first_name} ${agent.last_name}`} />
                          <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
                            {agent.first_name?.[0]}{agent.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <CardTitle className="text-center">
                          {agent.first_name} {agent.last_name}
                        </CardTitle>
                        {agent.title && (
                          <p className="text-sm text-muted-foreground text-center mt-1">
                            {agent.title}
                          </p>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {agent.company && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <span className="truncate font-medium">{agent.company}</span>
                          </div>
                        )}
                        
                        <a 
                          href={`mailto:${agent.email}`}
                          className="flex items-center gap-2 text-sm hover:text-primary transition-colors group"
                        >
                          <Mail className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-primary" />
                          <span className="truncate">{agent.email}</span>
                        </a>
                        
                        {agent.phone && (
                          <a 
                            href={`tel:${agent.phone}`}
                            className="flex items-center gap-2 text-sm hover:text-primary transition-colors group"
                          >
                            <Phone className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-primary" />
                            <span>{formatPhoneNumber(agent.phone)}</span>
                          </a>
                        )}

                        {agent.agent_county_preferences && agent.agent_county_preferences.length > 0 && (
                          <div className="pt-2 border-t">
                            <div className="flex items-start gap-2 text-sm">
                              <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-xs text-muted-foreground mb-1">Service Areas:</p>
                                <div className="flex flex-wrap gap-1">
                                  {agent.agent_county_preferences.slice(0, 3).map((pref: any) => (
                                    <span
                                      key={pref.county_id}
                                      className="inline-block bg-primary/10 text-primary text-xs px-2 py-1 rounded"
                                    >
                                      {pref.counties.name}, {pref.counties.state}
                                    </span>
                                  ))}
                                  {agent.agent_county_preferences.length > 3 && (
                                    <span className="text-xs text-muted-foreground px-2 py-1">
                                      +{agent.agent_county_preferences.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <Button className="w-full mt-4" onClick={() => navigate(`/agent/${agent.id}`)}>
                          View Profile
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Are You a Real Estate Agent?
            </h2>
            <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
              Join All Agent Connect and connect with buyers actively searching for properties in your area
            </p>
            <Button size="lg" variant="secondary" onClick={() => navigate("/auth")}>
              Register as an Agent
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default OurAgents;
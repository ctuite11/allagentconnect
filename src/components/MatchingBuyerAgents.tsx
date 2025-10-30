import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Phone, Mail, MapPin, Building, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  agent_county_preferences: {
    county_id: string;
    counties: {
      name: string;
      state: string;
    };
  }[];
}

interface MatchingBuyerAgentsProps {
  listingCity: string;
  listingState: string;
  listingZipCode: string;
}

const MatchingBuyerAgents = ({ listingCity, listingState, listingZipCode }: MatchingBuyerAgentsProps) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatchingAgents();
  }, [listingCity, listingState]);

  const fetchMatchingAgents = async () => {
    try {
      setLoading(true);
      
      // First, find the county for this listing's city
      const { data: countyData, error: countyError } = await supabase
        .from("counties")
        .select("id, name, state")
        .eq("state", listingState)
        .ilike("name", `%${listingCity.split(" ")[0]}%`);

      if (countyError) throw countyError;

      if (!countyData || countyData.length === 0) {
        setAgents([]);
        setLoading(false);
        return;
      }

      const countyIds = countyData.map(c => c.id);

      // Find agents who have preferences for these counties
      const { data: agentData, error: agentError } = await supabase
        .from("agent_profiles")
        .select(`
          *,
          agent_county_preferences!inner (
            county_id,
            counties (name, state)
          )
        `)
        .in("agent_county_preferences.county_id", countyIds)
        .eq("receive_buyer_alerts", true);

      if (agentError) throw agentError;

      setAgents(agentData || []);
    } catch (error: any) {
      console.error("Error fetching matching agents:", error);
      toast.error("Failed to load matching agents");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Matching Buyer Agents</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (agents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Matching Buyer Agents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No buyer agents currently matching this location area.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Matching Buyer Agents ({agents.length})</CardTitle>
        <p className="text-sm text-muted-foreground">
          Agents interested in {listingCity}, {listingState} {listingZipCode}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {agents.map((agent) => (
          <Card key={agent.id} className="border-2">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {agent.first_name} {agent.last_name}
                    </h3>
                    {agent.company && (
                      <div className="flex items-center gap-2 mt-1">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{agent.company}</span>
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary">Active Buyer Agent</Badge>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a href={`mailto:${agent.email}`} className="text-primary hover:underline">
                      {agent.email}
                    </a>
                  </div>

                  {agent.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <a href={`tel:${agent.phone}`} className="text-primary hover:underline">
                        {agent.phone}
                      </a>
                    </div>
                  )}

                  {agent.agent_county_preferences && agent.agent_county_preferences.length > 0 && (
                    <div className="pt-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 flex-shrink-0 mt-1 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">Service Areas:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {agent.agent_county_preferences.map((pref: any) => (
                              <Badge key={pref.county_id} variant="outline" className="text-xs">
                                {pref.counties.name}, {pref.counties.state}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Button 
                  className="w-full mt-2" 
                  onClick={() => {
                    window.location.href = `mailto:${agent.email}?subject=Property Inquiry - ${listingCity}, ${listingState}`;
                  }}
                >
                  Contact Agent
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};

export default MatchingBuyerAgents;

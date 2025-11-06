import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  headshot_url: string | null;
}

interface MatchingBuyerAgentsProps {
  listingCity: string;
  listingState: string;
  listingZipCode: string;
}

const MatchingBuyerAgents = ({ listingCity, listingState, listingZipCode }: MatchingBuyerAgentsProps) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMatchingAgents();
  }, [listingCity, listingState]);

  const fetchMatchingAgents = async () => {
    try {
      setLoading(true);
      
      // Get all counties for the listing state
      const { data: stateCounties, error: countiesError } = await supabase
        .from("counties")
        .select("id, name")
        .eq("state", listingState);

      if (countiesError) throw countiesError;

      // Try to infer county by naive city-name match first (best-effort)
      const cityFirstWord = listingCity?.split(" ")[0] ?? "";
      let targetCountyIds: string[] = [];
      if (stateCounties && cityFirstWord) {
        targetCountyIds = stateCounties
          .filter(c => c.name.toLowerCase().includes(cityFirstWord.toLowerCase()))
          .map(c => c.id);
      }

      // Fallback: if we couldn't infer a specific county, use ALL counties in the state
      if (!targetCountyIds || targetCountyIds.length === 0) {
        targetCountyIds = (stateCounties || []).map(c => c.id);
      }

      // Find agents who have preferences for these counties (limit to 8)
      const { data: agentData, error: agentError } = await supabase
        .from("agent_profiles")
        .select(`
          id,
          first_name,
          last_name,
          headshot_url,
          agent_county_preferences!inner (
            county_id
          )
        `)
        .in("agent_county_preferences.county_id", targetCountyIds)
        .eq("receive_buyer_alerts", true)
        .limit(8);

      if (agentError) throw agentError;

      const mappedAgents: Agent[] = ((agentData as any[]) || []).map((a) => ({
        id: a.id,
        first_name: a.first_name,
        last_name: a.last_name,
        headshot_url: a.headshot_url,
      }));

      let finalAgents: Agent[] = mappedAgents;

      // Fallback: if no county-preference matches, show agents who opted into buyer alerts (state-agnostic)
      if (!finalAgents || finalAgents.length === 0) {
        const { data: fallbackAgents, error: fallbackError } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, headshot_url")
          .eq("receive_buyer_alerts", true)
          .limit(8);
        if (fallbackError) throw fallbackError;
        const mappedFallback: Agent[] = ((fallbackAgents as any[]) || []).map((a) => ({
          id: a.id,
          first_name: a.first_name,
          last_name: a.last_name,
          headshot_url: a.headshot_url,
        }));
        finalAgents = mappedFallback;
      }

      setAgents(finalAgents);
    } catch (error: any) {
      console.error("Error fetching matching agents:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (agents.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Matching Buyer Agents in {listingCity}, {listingState}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => navigate(`/agent/${agent.id}`)}
              className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer"
            >
              <Avatar className="h-16 w-16">
                <AvatarImage src={agent.headshot_url || undefined} alt={`${agent.first_name} ${agent.last_name}`} />
                <AvatarFallback>{agent.first_name[0]}{agent.last_name[0]}</AvatarFallback>
              </Avatar>
              <p className="text-sm font-medium text-center">
                {agent.first_name} {agent.last_name}
              </p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default MatchingBuyerAgents;

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users, Phone, ExternalLink, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const DEFAULT_BROKERAGE_LOGO_URL = "/placeholder.svg";

interface BuyerAgent {
  id: string;
  first_name: string;
  last_name: string;
  headshot_url: string | null;
  logo_url: string | null;
  company: string | null;
  title: string | null;
  cell_phone: string | null;
  phone: string | null;
  social_links: {
    website?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
  } | null;
}

interface BuyerAgentShowcaseProps {
  listingZip: string;
  listingId: string;
}

export const BuyerAgentShowcase = ({ listingZip, listingId }: BuyerAgentShowcaseProps) => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<BuyerAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBuyerAgents = async () => {
      try {
        // Get agents who have this ZIP in their coverage areas
        const { data: coverageData } = await supabase
          .from("agent_buyer_coverage_areas")
          .select("agent_id")
          .eq("zip_code", listingZip)
          .limit(20);

        if (coverageData && coverageData.length > 0) {
          const agentIds = [...new Set(coverageData.map(c => c.agent_id))];
          
          const { data: agentData } = await supabase
            .from("agent_profiles")
            .select("id, first_name, last_name, headshot_url, logo_url, company, title, cell_phone, phone, social_links")
            .in("id", agentIds);

          if (agentData) {
            // Shuffle and take 3, seeded by listingId + date for daily rotation
            const today = new Date().toISOString().split('T')[0];
            const seed = `${listingId}-${today}`;
            const shuffled = shuffleWithSeed(agentData as BuyerAgent[], seed);
            setAgents(shuffled.slice(0, 3));
          }
        }
      } catch (error) {
        console.error("Error fetching buyer agents:", error);
      } finally {
        setLoading(false);
      }
    };

    if (listingZip) {
      fetchBuyerAgents();
    }
  }, [listingZip, listingId]);

  // Simple seeded shuffle
  const shuffleWithSeed = (array: BuyerAgent[], seed: string): BuyerAgent[] => {
    const shuffled = [...array];
    let seedNum = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    for (let i = shuffled.length - 1; i > 0; i--) {
      seedNum = (seedNum * 9301 + 49297) % 233280;
      const j = Math.floor((seedNum / 233280) * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
  };

  const getAgentWebsite = (agent: BuyerAgent): string | null => {
    if (!agent.social_links) return null;
    const socialLinks = typeof agent.social_links === 'string' 
      ? JSON.parse(agent.social_links) 
      : agent.social_links;
    return socialLinks?.website || null;
  };

  if (loading || agents.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="w-5 h-5" />
          Buyer's Agents in This Area
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {agents.map((agent) => {
          const websiteUrl = getAgentWebsite(agent);
          
          return (
            <div
              key={agent.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <Avatar className="w-12 h-12">
                {agent.headshot_url ? (
                  <AvatarImage src={agent.headshot_url} />
                ) : (
                  <AvatarFallback className="bg-muted text-foreground">
                    {agent.first_name[0]}{agent.last_name[0]}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">
                  {agent.first_name} {agent.last_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {agent.company || "Brokerage"}
                </p>
                {websiteUrl && (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                  >
                    <Globe className="w-3 h-3" />
                    Website
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                {(agent.cell_phone || agent.phone) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    asChild
                  >
                    <a href={`tel:${agent.cell_phone || agent.phone}`}>
                      <Phone className="w-4 h-4" />
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/agent/${agent.id}`)}
                  className="text-xs"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Profile
                </Button>
              </div>
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground text-center pt-2 border-t">
          Agents shown serve this area. Selection is random; this is not a paid placement.
          You are free to work with any agent of your choice.
        </p>
      </CardContent>
    </Card>
  );
};

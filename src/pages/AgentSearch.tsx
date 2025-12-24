import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";
import { toast } from "sonner";
import AgentSearchFilters from "@/components/agent-search/AgentSearchFilters";
import AgentMarketplaceGrid from "@/components/agent-search/AgentMarketplaceGrid";

const AgentSearch = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("");

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      
      // Fetch agents with county preferences
      const { data: agentData, error: agentError } = await supabase
        .from("agent_profiles")
        .select(`
          *,
          agent_county_preferences (
            county_id,
            counties (id, name, state)
          )
        `)
        .eq("receive_buyer_alerts", true)
        .order("created_at", { ascending: false });

      if (agentError) throw agentError;

      setAgents(agentData || []);
    } catch (error: any) {
      toast.error("Failed to load agents");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedState("");
  };

  // Get unique states from agents
  const uniqueStates = [...new Set(
    agents.flatMap(agent => 
      agent.agent_county_preferences?.map((pref: any) => pref.counties?.state).filter(Boolean) || []
    )
  )].sort();

  // Filter agents
  const filteredAgents = agents.filter((agent) => {
    // Text search (name, city, brokerage)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesText =
        agent.first_name?.toLowerCase().includes(query) ||
        agent.last_name?.toLowerCase().includes(query) ||
        agent.company?.toLowerCase().includes(query) ||
        agent.office_name?.toLowerCase().includes(query) ||
        agent.office_city?.toLowerCase().includes(query);

      if (!matchesText) return false;
    }

    // State filter
    if (selectedState) {
      const agentStates = agent.agent_county_preferences?.map((pref: any) => pref.counties?.state) || [];
      if (!agentStates.includes(selectedState)) return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <main className="flex-1 pt-16">
        {/* Header Section */}
        <section className="bg-card border-b border-border py-10">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <Users className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Find an Agent</h1>
                  <p className="text-muted-foreground mt-1">
                    Browse verified agents and the incentives they offer to buyers and sellers.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg border border-border">
                <Users className="h-4 w-4 text-emerald-600" />
                <span className="text-lg font-bold text-foreground">{filteredAgents.length}</span>
                <span className="text-sm text-muted-foreground">agents</span>
              </div>
            </div>
          </div>
        </section>

        {/* Simplified Filters */}
        <AgentSearchFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedState={selectedState}
          setSelectedState={setSelectedState}
          states={uniqueStates}
          onClearFilters={handleClearFilters}
          hasActiveFilters={!!(searchQuery || selectedState)}
        />

        {/* Explainer Line */}
        <section className="py-4">
          <div className="max-w-6xl mx-auto px-4">
            <p className="text-sm text-muted-foreground text-center">
              Agents in All Agent Connect may offer rebates, credits, or referral incentives. Terms vary by market.
            </p>
          </div>
        </section>

        {/* Agent Grid */}
        <section className="py-6">
          <div className="max-w-6xl mx-auto px-4">
            <AgentMarketplaceGrid
              agents={filteredAgents}
              loading={loading}
            />
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 bg-primary text-primary-foreground">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold mb-3">Are You a Real Estate Agent?</h2>
            <p className="text-base mb-6 opacity-90 max-w-xl mx-auto">
              Join All Agent Connect and showcase your incentives to buyers and sellers
              actively searching for agents.
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate("/auth?mode=register")}
            >
              Register as an Agent
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AgentSearch;

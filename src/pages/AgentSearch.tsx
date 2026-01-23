import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AgentSearchFilters from "@/components/agent-search/AgentSearchFilters";
import AgentMarketplaceGrid from "@/components/agent-search/AgentMarketplaceGrid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AgentSearch = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCompany, setSelectedCompany] = useState<string>("All");

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      
      // Get verified agent IDs (already excludes hidden agents via the RPC)
      const { data: verifiedIds, error: verifiedError } = await supabase
        .rpc("get_verified_agent_ids");
      
      if (verifiedError) throw verifiedError;
      
      const verifiedIdSet = new Set((verifiedIds || []).map((r: { user_id: string }) => r.user_id));
      
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

      // Filter to only verified (and not hidden) agents
      const visibleAgents = (agentData || []).filter(
        (agent) => verifiedIdSet.has(agent.id)
      );
      setAgents(visibleAgents);
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
    setSelectedCompany("All");
  };

  // Get unique companies from agents
  const companies = useMemo(() => {
    return Array.from(
      new Set(
        agents
          .map((a) => (a.company || a.office_name || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [agents]);

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

    // Company filter
    if (selectedCompany !== "All") {
      const co = (agent.company || agent.office_name || "").trim();
      if (co !== selectedCompany) return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1">
        {/* Header */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          <PageHeader
            title="Find an Agent"
            subtitle="Browse verified agents and the incentives they offer to buyers and sellers."
            className="mb-8"
          />
        </div>

        {/* Filters Row */}
        <div className="max-w-6xl mx-auto px-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <AgentSearchFilters
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedState={selectedState}
              setSelectedState={setSelectedState}
              states={uniqueStates}
              onClearFilters={handleClearFilters}
              hasActiveFilters={!!(searchQuery || selectedState || selectedCompany !== "All")}
            />
            
            {/* Company Filter */}
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="w-[200px] bg-white border-zinc-200">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company} value={company}>
                    {company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

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

        {/* Secondary CTA - Register as Agent (below grid, smaller, not competing) */}
        <section className="py-8 border-t border-border">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Are you a real estate agent? Showcase your incentives to buyers and sellers.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-neutral-700 border-neutral-300 hover:bg-neutral-50"
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

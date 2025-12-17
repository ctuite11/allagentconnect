import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";
import { toast } from "sonner";
import AgentSearchFilters from "@/components/agent-search/AgentSearchFilters";
import AgentSearchTable from "@/components/agent-search/AgentSearchTable";
import { PageTitle } from "@/components/ui/page-title";

const AgentSearch = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const [counties, setCounties] = useState<any[]>([]);
  const [showBuyerIncentivesOnly, setShowBuyerIncentivesOnly] = useState(false);
  const [showListingAgentsOnly, setShowListingAgentsOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<"a-z" | "z-a" | "listings">("a-z");

  useEffect(() => {
    fetchCounties();
    fetchAgents();
  }, []);

  const fetchCounties = async () => {
    try {
      const { data, error } = await supabase
        .from("counties")
        .select("*")
        .order("name");
      
      if (error) throw error;
      setCounties(data || []);
    } catch (error: any) {
      console.error("Error fetching counties:", error);
    }
  };

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

      // Fetch listing counts per agent
      const { data: listingCounts, error: listingError } = await supabase
        .from("listings")
        .select("agent_id")
        .eq("status", "active");

      if (listingError) throw listingError;

      // Count listings per agent
      const countMap: Record<string, number> = {};
      listingCounts?.forEach((listing) => {
        countMap[listing.agent_id] = (countMap[listing.agent_id] || 0) + 1;
      });

      // Merge counts into agent data
      const enrichedAgents = (agentData || []).map((agent) => ({
        ...agent,
        active_listings_count: countMap[agent.id] || 0,
      }));

      setAgents(enrichedAgents);
    } catch (error: any) {
      toast.error("Failed to load agents");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCounty = (countyId: string) => {
    setSelectedCounties((prev) =>
      prev.includes(countyId)
        ? prev.filter((id) => id !== countyId)
        : [...prev, countyId]
    );
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCounties([]);
    setShowBuyerIncentivesOnly(false);
    setShowListingAgentsOnly(false);
    setSortOrder("a-z");
  };

  // Filter agents
  const filteredAgents = agents.filter((agent) => {
    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesText =
        agent.first_name?.toLowerCase().includes(query) ||
        agent.last_name?.toLowerCase().includes(query) ||
        agent.company?.toLowerCase().includes(query) ||
        agent.email?.toLowerCase().includes(query);

      if (!matchesText) return false;
    }

    // County filter
    if (selectedCounties.length > 0) {
      const agentCounties =
        agent.agent_county_preferences?.map((pref: any) => pref.counties?.id) || [];
      const hasMatchingCounty = selectedCounties.some((countyId) =>
        agentCounties.includes(countyId)
      );
      if (!hasMatchingCounty) return false;
    }

    // Buyer incentives filter
    if (showBuyerIncentivesOnly && !agent.buyer_incentives) {
      return false;
    }

    // Listing agents filter
    if (showListingAgentsOnly && (agent.active_listings_count || 0) === 0) {
      return false;
    }

    return true;
  });

  // Sort agents
  const sortedAgents = [...filteredAgents].sort((a, b) => {
    if (sortOrder === "listings") {
      return (b.active_listings_count || 0) - (a.active_listings_count || 0);
    }
    
    const nameA = `${a.last_name} ${a.first_name}`.toLowerCase();
    const nameB = `${b.last_name} ${b.first_name}`.toLowerCase();

    if (sortOrder === "a-z") {
      return nameA.localeCompare(nameB);
    } else {
      return nameB.localeCompare(nameA);
    }
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <main className="flex-1 pt-16">
        {/* Compact Header */}
        <section className="bg-card border-b border-border py-6">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-muted border border-border flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <PageTitle>Agent Directory</PageTitle>
                <p className="text-sm text-muted-foreground">
                  Find agents, view listings, and connect for deals
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sticky Filter Bar */}
        <AgentSearchFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedCounties={selectedCounties}
          toggleCounty={toggleCounty}
          counties={counties}
          showBuyerIncentivesOnly={showBuyerIncentivesOnly}
          setShowBuyerIncentivesOnly={setShowBuyerIncentivesOnly}
          showListingAgentsOnly={showListingAgentsOnly}
          setShowListingAgentsOnly={setShowListingAgentsOnly}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          onClearFilters={handleClearFilters}
          resultCount={sortedAgents.length}
        />

        {/* Table View */}
        <section className="py-6">
          <div className="container mx-auto px-4">
            <AgentSearchTable
              agents={sortedAgents}
              loading={loading}
              sortOrder={sortOrder}
              onSortChange={setSortOrder}
            />
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold mb-3">Are You a Real Estate Agent?</h2>
            <p className="text-base mb-6 opacity-90 max-w-xl mx-auto">
              Join All Agent Connect and get matched with buyers actively searching
              for properties in your area
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate("/auth")}
            >
              Register as an Agent
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AgentSearch;

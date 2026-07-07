import { useState, useEffect, useMemo, useCallback } from "react";
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

const PAGE_SIZE = 24;

const AgentSearch = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCompany, setSelectedCompany] = useState<string>("All");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchAgents();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedState, selectedCompany]);

  // Scroll to top when page changes (pagination doesn't change route)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    // AppShell uses an inner scroll container; scroll it too
    const scrollers = document.querySelectorAll<HTMLElement>(".overflow-y-auto");
    scrollers.forEach((el) => el.scrollTo({ top: 0, behavior: "smooth" }));
  }, [page]);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      
      const { data: verifiedIds, error: verifiedError } = await supabase
        .rpc("get_verified_agent_ids");
      
      if (verifiedError) throw verifiedError;
      
      const verifiedIdSet = new Set((verifiedIds || []).map((r: { user_id: string }) => r.user_id));
      
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

  const companies = useMemo(() => {
    return Array.from(
      new Set(
        agents
          .map((a) => (a.company || a.office_name || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [agents]);

  const uniqueStates = [...new Set(
    agents.flatMap(agent => 
      agent.agent_county_preferences?.map((pref: any) => pref.counties?.state).filter(Boolean) || []
    )
  )].sort();

  const filteredAgents = agents.filter((agent) => {
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
    if (selectedState) {
      const agentStates = agent.agent_county_preferences?.map((pref: any) => pref.counties?.state) || [];
      if (!agentStates.includes(selectedState)) return false;
    }
    if (selectedCompany !== "All") {
      const co = (agent.company || agent.office_name || "").trim();
      if (co !== selectedCompany) return false;
    }
    return true;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / PAGE_SIZE));
  const paginatedAgents = filteredAgents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Copy protection handlers
  const blockEvent = useCallback((e: React.ClipboardEvent | React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const blockKeyboard = useCallback((e: React.KeyboardEvent) => {
    // Block Cmd/Ctrl+A (select all) and Cmd/Ctrl+C (copy)
    if ((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A" || e.key === "c" || e.key === "C")) {
      e.preventDefault();
    }
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col bg-background select-none"
      onCopy={blockEvent}
      onCut={blockEvent}
      onPaste={blockEvent}
      onContextMenu={blockEvent}
      onKeyDown={blockKeyboard}
    >
      <main className="flex-1">
        {/* Header */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          <PageHeader
            title="Find a Trusted Agent"
            subtitle="Search your network by city, specialty, or name"
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

        {/* Agent Grid — paginated */}
        <section className="py-6">
          <div className="max-w-6xl mx-auto px-4">
            <AgentMarketplaceGrid
              agents={paginatedAgents}
              loading={loading}
            />

            {/* Pagination controls */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-3">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
};

export default AgentSearch;

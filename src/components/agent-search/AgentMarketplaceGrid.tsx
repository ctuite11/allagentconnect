import AgentMarketplaceCard from "./AgentMarketplaceCard";

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  cell_phone?: string;
  company?: string;
  buyer_incentives?: string;
  seller_incentives?: string;
  headshot_url?: string;
  office_name?: string;
  office_city?: string;
  office_state?: string;
  agent_county_preferences?: any[];
}

interface AgentMarketplaceGridProps {
  agents: Agent[];
  loading: boolean;
}

const AgentMarketplaceGrid = ({ agents, loading }: AgentMarketplaceGridProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading agents...</p>
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <p className="text-lg text-muted-foreground">No agents found matching your criteria</p>
          <p className="text-sm text-muted-foreground">Try adjusting your search</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {agents.map((agent, index) => (
        <AgentMarketplaceCard
          key={agent.id}
          agent={agent}
          agentIndex={index}
        />
      ))}
    </div>
  );
};

export default AgentMarketplaceGrid;

import AgentMarketplaceCard from "./AgentMarketplaceCard";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";

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
    return <AacMonogramLoader variant="section" message="Loading agents…" className="py-16 sm:py-20" />;
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
         />
      ))}
    </div>
  );
};

export default AgentMarketplaceGrid;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Mail, 
  Phone, 
  Building2, 
  ChevronRight, 
  Gift,
  Home,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import ContactAgentProfileDialog from "@/components/ContactAgentProfileDialog";
import AgentIntelDrawer from "./AgentIntelDrawer";


interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  buyer_incentives?: string;
  headshot_url?: string;
  aac_id: string;
  office_name?: string;
  active_listings_count?: number;
  agent_county_preferences?: any[];
}

interface AgentSearchTableProps {
  agents: Agent[];
  loading: boolean;
  sortOrder: "a-z" | "z-a" | "listings";
  onSortChange: (sort: "a-z" | "z-a" | "listings") => void;
}

const AgentSearchTable = ({ agents, loading, sortOrder, onSortChange }: AgentSearchTableProps) => {
  const navigate = useNavigate();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleRowClick = (agent: Agent) => {
    setSelectedAgent(agent);
    setDrawerOpen(true);
  };

  const getSortIcon = (column: string) => {
    if (column === "name") {
      if (sortOrder === "a-z") return <ArrowUp className="h-3.5 w-3.5" />;
      if (sortOrder === "z-a") return <ArrowDown className="h-3.5 w-3.5" />;
    }
    if (column === "listings" && sortOrder === "listings") {
      return <ArrowDown className="h-3.5 w-3.5" />;
    }
    return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
  };

  const handleNameSort = () => {
    if (sortOrder === "a-z") onSortChange("z-a");
    else onSortChange("a-z");
  };

  const handleListingsSort = () => {
    onSortChange("listings");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
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
          <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[280px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium hover:bg-transparent gap-1.5"
                  onClick={handleNameSort}
                >
                  Agent
                  {getSortIcon("name")}
                </Button>
              </TableHead>
              <TableHead className="hidden md:table-cell">Brokerage</TableHead>
              <TableHead className="hidden lg:table-cell">Service Areas</TableHead>
              <TableHead className="hidden xl:table-cell w-[180px]">Incentives</TableHead>
              <TableHead className="w-[100px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium hover:bg-transparent gap-1.5"
                  onClick={handleListingsSort}
                >
                  Listings
                  {getSortIcon("listings")}
                </Button>
              </TableHead>
              <TableHead className="w-[180px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => {
              const agentName = `${agent.first_name} ${agent.last_name}`;
              const initials = `${agent.first_name?.[0] || ''}${agent.last_name?.[0] || ''}`;
              const serviceAreas = agent.agent_county_preferences?.slice(0, 2) || [];
              const hasMoreAreas = (agent.agent_county_preferences?.length || 0) > 2;

              return (
                <TableRow
                  key={agent.id}
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => handleRowClick(agent)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-border">
                        {agent.headshot_url && <AvatarImage src={agent.headshot_url} alt={agentName} />}
                        <AvatarFallback className="text-sm font-medium bg-muted text-foreground">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{agentName}</p>
                        <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate max-w-[180px]">{agent.company || agent.office_name || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {serviceAreas.map((pref: any) => (
                        <Badge key={pref.county_id} variant="secondary" className="text-xs font-normal">
                          {pref.counties?.name}
                        </Badge>
                      ))}
                      {hasMoreAreas && (
                        <Badge variant="outline" className="text-xs font-normal">
                          +{(agent.agent_county_preferences?.length || 0) - 2}
                        </Badge>
                      )}
                      {serviceAreas.length === 0 && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {agent.buyer_incentives ? (
                      <div className="flex items-center gap-1.5">
                        <Gift className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                        <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {agent.buyer_incentives}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {(agent.active_listings_count ?? 0) > 0 ? (
                      <Badge className="bg-blue-600 hover:bg-blue-700 gap-1">
                        <Home className="h-3 w-3" />
                        {agent.active_listings_count}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <ContactAgentProfileDialog
                        agentId={agent.id}
                        agentName={agentName}
                        agentEmail={agent.email}
                        buttonText="Message"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(agent);
                        }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AgentIntelDrawer
        agent={selectedAgent}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
};

export default AgentSearchTable;

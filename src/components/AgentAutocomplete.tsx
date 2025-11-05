import { useState, useEffect, useRef } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  headshot_url?: string;
  title?: string;
  phone?: string;
}

interface AgentAutocompleteProps {
  onAgentSelect: (agent: AgentProfile) => void;
  excludeAgentIds?: string[];
  placeholder?: string;
}

const AgentAutocomplete = ({ onAgentSelect, excludeAgentIds = [], placeholder = "Search agents..." }: AgentAutocompleteProps) => {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<AgentProfile[]>([]);
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);
  const commandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAgents();
  }, [excludeAgentIds]);

  useEffect(() => {
    if (search) {
      const filtered = agents.filter(agent => {
        const fullName = `${agent.first_name} ${agent.last_name}`.toLowerCase();
        const email = agent.email.toLowerCase();
        const searchLower = search.toLowerCase();
        return fullName.includes(searchLower) || email.includes(searchLower);
      });
      setFilteredAgents(filtered);
    } else {
      setFilteredAgents(agents);
    }
  }, [search, agents]);

  const loadAgents = async () => {
    try {
      let query = supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, email, headshot_url, title, phone")
        .order("first_name");

      if (excludeAgentIds.length > 0) {
        query = query.not("id", "in", `(${excludeAgentIds.join(",")})`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAgents(data || []);
      setFilteredAgents(data || []);
    } catch (error: any) {
      console.error("Error loading agents:", error);
    }
  };

  const handleSelect = (agent: AgentProfile) => {
    setSelectedAgent(agent);
    onAgentSelect(agent);
    setSearch("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <Command ref={commandRef} className="rounded-lg border shadow-md">
        <CommandInput
          placeholder={placeholder}
          value={search}
          onValueChange={setSearch}
          onFocus={() => setOpen(true)}
        />
        {open && (
          <CommandList className="absolute top-full left-0 right-0 z-50 mt-1 max-h-[300px] overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
            <CommandEmpty>No agents found.</CommandEmpty>
            <CommandGroup>
              {filteredAgents.map((agent) => (
                <CommandItem
                  key={agent.id}
                  value={agent.id}
                  onSelect={() => handleSelect(agent)}
                  className="flex items-center gap-3 p-3 cursor-pointer"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={agent.headshot_url} />
                    <AvatarFallback>
                      {agent.first_name[0]}{agent.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {agent.first_name} {agent.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {agent.title || agent.email}
                    </p>
                    {agent.phone && (
                      <p className="text-xs text-muted-foreground">
                        {agent.phone}
                      </p>
                    )}
                  </div>
                  {selectedAgent?.id === agent.id && (
                    <Check className="h-4 w-4" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        )}
      </Command>
    </div>
  );
};

export default AgentAutocomplete;

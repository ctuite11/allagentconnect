import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/ui/AgentAvatar";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MapPin, Building2, CheckCircle2, Shield, Send, MessageSquare, UserPlus, Check } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


interface Agent {
  id: string;
  aac_id?: string;
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
  // Verification comes from agent_settings
  agent_settings?: {
    agent_status?: string;
  };
}

interface AgentMarketplaceCardProps {
  agent: Agent;
  isOnline?: boolean;
}


const AgentMarketplaceCard = ({ agent, isOnline }: AgentMarketplaceCardProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const fullName = `${agent.first_name} ${agent.last_name}`;
  
  // Location display
  const locationDisplay = agent.office_city && agent.office_state 
    ? `${agent.office_city}, ${agent.office_state}`
    : agent.agent_county_preferences?.[0]?.counties 
      ? `${agent.agent_county_preferences[0].counties.name}, ${agent.agent_county_preferences[0].counties.state}`
      : null;

  const handleSaveToContacts = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to save contacts");
        return;
      }

      // Check for duplicate
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("agent_id", user.id)
        .eq("email", agent.email)
        .maybeSingle();

      if (existing) {
        toast.info("This agent is already in your contacts");
        setSaved(true);
        return;
      }

      const { error } = await supabase
        .from("clients")
        .insert({
          agent_id: user.id,
          first_name: agent.first_name,
          last_name: agent.last_name,
          email: agent.email,
          phone: agent.cell_phone || agent.phone || null,
          client_type: "agent",
          source: "network",
          agent_user_id: agent.id,
        });

      if (error) throw error;
      toast.success(`${fullName} saved to your contacts`);
      setSaved(true);
    } catch (error: any) {
      console.error("Error saving to contacts:", error);
      toast.error("Failed to save contact");
    } finally {
      setSaving(false);
    }
  };


  return (
    <Card className="group overflow-hidden border bg-card transition-all duration-300 ease-out hover:shadow-lg hover:-translate-y-1 hover:border-neutral-300">
      <div className="p-5">
        {/* Photo + Name Row */}
        <div className="flex items-center gap-4 mb-4">
          <AgentAvatar
            name={fullName}
            headshotUrl={agent.headshot_url ?? null}
            size="xl"
            isOnline={isOnline}
            avatarClassName="rounded-xl border-2 border-border shadow-sm ring-2 ring-border ring-offset-2 ring-offset-background"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-foreground leading-tight truncate">
              {fullName}
            </h3>
            {locationDisplay && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{locationDisplay}</span>
              </div>
            )}
          </div>
        </div>

        {/* Brokerage */}
        {(agent.company || agent.office_name) && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
            <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{agent.company || agent.office_name}</span>
          </div>
        )}


        {/* Trust Signal */}
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium mb-4">
          <Shield className="h-3.5 w-3.5" />
          <span>AAC Verified Agent</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white gap-1.5"
            size="sm"
            onClick={() => navigate(`/agent/${agent.aac_id || agent.id}`, { state: { from: location.pathname } })}
          >
            <Send className="h-3.5 w-3.5" />
            Refer Client
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/agent/${agent.aac_id || agent.id}`, { state: { from: location.pathname } });
            }}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Message
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={handleSaveToContacts}
                disabled={saving || saved}
              >
                {saved ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {saved ? "Saved to Contacts" : "Save to Contacts"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </Card>
  );
};

export default AgentMarketplaceCard;

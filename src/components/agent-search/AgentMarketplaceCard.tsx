import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Phone, Mail, MessageSquare, MapPin, Building2, CheckCircle2, Gift, Percent, Handshake, DollarSign } from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import ContactAgentProfileDialog from "@/components/ContactAgentProfileDialog";
import { useAuthRole } from "@/hooks/useAuthRole";
import { findOrCreateConversation } from "@/lib/startConversation";
import { toast } from "sonner";

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
  // Verification comes from agent_settings
  agent_settings?: {
    agent_status?: string;
  };
}

interface AgentMarketplaceCardProps {
  agent: Agent;
  agentIndex?: number;
}

// Determine the primary incentive badge for an agent
// AAC rule: all badges use emerald (primary) or neutral (secondary) only
const getIncentiveBadge = (agent: Agent): { label: string; icon: React.ReactNode; color: string } | null => {
  const buyerIncentives = agent.buyer_incentives?.toLowerCase() || "";
  const sellerIncentives = agent.seller_incentives?.toLowerCase() || "";
  
  // Primary style for monetary incentives
  const primaryStyle = "bg-emerald-50 text-emerald-800 border-emerald-200";
  // Secondary style for non-monetary incentives
  const secondaryStyle = "bg-neutral-50 text-neutral-800 border-neutral-200";
  
  // Check for rebate keywords (primary - monetary)
  if (buyerIncentives.includes("rebate") || buyerIncentives.includes("cash back")) {
    return { 
      label: "Buyer Rebate Available", 
      icon: <DollarSign className="h-3 w-3" />,
      color: primaryStyle
    };
  }
  
  // Check for seller credit (primary - monetary)
  if (sellerIncentives.includes("credit") || sellerIncentives.includes("closing")) {
    return { 
      label: "Seller Credit Offered", 
      icon: <Gift className="h-3 w-3" />,
      color: primaryStyle
    };
  }
  
  // Check for flexible commission (primary - monetary)
  if (buyerIncentives.includes("commission") || sellerIncentives.includes("commission") || 
      buyerIncentives.includes("flexible") || sellerIncentives.includes("flexible")) {
    return { 
      label: "Flexible Commission", 
      icon: <Percent className="h-3 w-3" />,
      color: primaryStyle
    };
  }
  
  // Check for referral friendly (secondary - non-monetary)
  if (buyerIncentives.includes("referral") || sellerIncentives.includes("referral")) {
    return { 
      label: "Referral Friendly", 
      icon: <Handshake className="h-3 w-3" />,
      color: secondaryStyle
    };
  }
  
  // If has any incentives text, show generic (primary)
  if (agent.buyer_incentives || agent.seller_incentives) {
    return { 
      label: "Incentives Available", 
      icon: <Gift className="h-3 w-3" />,
      color: primaryStyle
    };
  }
  
  return null;
};

const AgentMarketplaceCard = ({ agent, agentIndex = 999 }: AgentMarketplaceCardProps) => {
  const navigate = useNavigate();
  const { user, role } = useAuthRole();
  const [isStartingChat, setIsStartingChat] = useState(false);
  
  const viewerId = user?.id;
  const canMessage = !!viewerId && (role === "agent" || role === "admin") && viewerId !== agent.id;
  
  const fullName = `${agent.first_name} ${agent.last_name}`;
  const initials = `${agent.first_name?.[0] || ""}${agent.last_name?.[0] || ""}`.toUpperCase();
  const phoneNumber = agent.cell_phone || agent.phone;
  
  // Location display
  const locationDisplay = agent.office_city && agent.office_state 
    ? `${agent.office_city}, ${agent.office_state}`
    : agent.agent_county_preferences?.[0]?.counties 
      ? `${agent.agent_county_preferences[0].counties.name}, ${agent.agent_county_preferences[0].counties.state}`
      : null;

  // Verified badge logic - must be based on actual verification status, not profile completeness
  const isVerified = agent.agent_settings?.agent_status === 'verified';

  // Get incentive badge
  const incentiveBadge = getIncentiveBadge(agent);

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (phoneNumber) {
      window.location.href = `tel:${phoneNumber}`;
    }
  };

  const handleMessageClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!viewerId || isStartingChat) return;
    
    setIsStartingChat(true);
    try {
      const convoId = await findOrCreateConversation(viewerId, agent.id);
      if (convoId) {
        navigate(`/messages/${convoId}`);
      } else {
        toast.error("Couldn't start message. Please try again.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't start message. Please try again.");
    } finally {
      setIsStartingChat(false);
    }
  };

  return (
    <Card className="group overflow-hidden border bg-card transition-all duration-300 ease-out hover:shadow-lg hover:-translate-y-1 hover:border-neutral-300">
      <div className="p-5">
        {/* Photo + Name Row */}
        <div className="flex items-center gap-4 mb-4">
          <Avatar className="h-16 w-16 border-2 border-border shadow-sm ring-2 ring-border ring-offset-2 ring-offset-background">
            <AvatarImage src={agent.headshot_url} alt={fullName} />
            <AvatarFallback className="bg-muted text-foreground font-semibold text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg text-foreground leading-tight truncate">
                {fullName}
              </h3>
              {isVerified && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5 text-emerald-600 text-xs font-medium cursor-help">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Verified
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Verified AAC agent — incentives listed directly by the agent.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>

        {/* Brokerage + Market */}
        <div className="space-y-1.5 mb-4">
          {(agent.company || agent.office_name) && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{agent.company || agent.office_name}</span>
            </div>
          )}
          {locationDisplay && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{locationDisplay}</span>
            </div>
          )}
        </div>

        {/* Incentive Badge - hidden per AAC policy */}
        {false && incentiveBadge && (
          <div className="mb-4">
            <Badge 
              variant="outline" 
              className={`${incentiveBadge.color} gap-1.5 px-3 py-1 text-xs font-medium`}
            >
              {incentiveBadge.icon}
              {incentiveBadge.label}
            </Badge>
          </div>
        )}

        {/* Contact Icons - Secondary */}
        <div className="flex items-center gap-2 mb-4">
          {phoneNumber && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-neutral-50 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-700 transition-all duration-200"
              onClick={handlePhoneClick}
              title={formatPhoneNumber(phoneNumber)}
            >
              <Phone className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-neutral-50 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-700 transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `mailto:${agent.email}`;
            }}
            title={agent.email}
          >
            <Mail className="h-4 w-4" />
          </Button>
          {canMessage && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-neutral-50 text-neutral-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
              onClick={handleMessageClick}
              disabled={isStartingChat}
              aria-busy={isStartingChat}
              title={isStartingChat ? "Opening…" : "Message"}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Primary CTA */}
        <Button 
          className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"
          onClick={() => navigate(`/agent/${agent.id}`)}
        >
          View Incentives
        </Button>
      </div>
    </Card>
  );
};

export default AgentMarketplaceCard;

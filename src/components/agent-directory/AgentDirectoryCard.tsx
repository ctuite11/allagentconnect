import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Mail, MessageSquare, MapPin, Building2 } from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface AgentDirectoryCardProps {
  agent: {
    id: string;
    first_name: string;
    last_name: string;
    title?: string;
    company?: string;
    email: string;
    phone?: string;
    cell_phone?: string;
    headshot_url?: string;
    office_name?: string;
    buyer_incentives?: string;
    updated_at?: string;
    social_links?: {
      website?: string;
      instagram?: string;
      linkedin?: string;
    };
    // Enriched data for agent mode
    activeListingsCount?: number;
    comingSoonCount?: number;
    offMarketCount?: number;
    last12MonthsSales?: number;
    buyerMatchCount?: number;
    serviceAreas?: string[];
    specialties?: string[];
  };
  isAgentMode: boolean;
  onMessage?: (agentId: string) => void;
}

const AgentDirectoryCard = ({ agent, isAgentMode, onMessage }: AgentDirectoryCardProps) => {
  const navigate = useNavigate();
  const fullName = `${agent.first_name} ${agent.last_name}`;
  const initials = `${agent.first_name?.[0] || ""}${agent.last_name?.[0] || ""}`.toUpperCase();
  const phoneNumber = agent.cell_phone || agent.phone;
  // Only show ONE primary service area
  const primaryArea = agent.serviceAreas?.[0] || null;

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (phoneNumber) {
      window.location.href = `tel:${phoneNumber}`;
    }
  };

  const handleEmailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `mailto:${agent.email}`;
  };

  const handleMessageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMessage?.(agent.id);
  };

  return (
    <Card className="group overflow-hidden border bg-card hover:shadow-lg transition-all duration-200">
      <div className="p-5">
        {/* Large Profile Photo */}
        <div className="flex justify-center mb-4">
          <Avatar className="h-24 w-24 border-2 border-border shadow-sm">
            <AvatarImage src={agent.headshot_url} alt={fullName} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-2xl">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Full Name - Never Truncated */}
        <h3 className="font-semibold text-lg text-foreground text-center leading-tight">
          {fullName}
        </h3>

        {/* Brokerage */}
        {(agent.company || agent.office_name) && (
          <div className="flex items-center justify-center gap-1.5 mt-2 text-sm text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-center">{agent.company || agent.office_name}</span>
          </div>
        )}

        {/* ONE Primary Service Area Only */}
        {primaryArea && (
          <div className="flex items-center justify-center gap-1.5 mt-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{primaryArea}</span>
          </div>
        )}

        {/* Colored Contact Icons */}
        <div className="flex items-center justify-center gap-3 mt-4">
          {phoneNumber && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900"
              onClick={handlePhoneClick}
              title={formatPhoneNumber(phoneNumber)}
            >
              <Phone className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900"
            onClick={handleEmailClick}
            title={agent.email}
          >
            <Mail className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700 dark:bg-purple-950 dark:text-purple-400 dark:hover:bg-purple-900"
            onClick={handleMessageClick}
            title="Send Message"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>

        {/* View Profile Button */}
        <div className="mt-5">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate(`/agent/${agent.id}`)}
          >
            View Profile
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default AgentDirectoryCard;
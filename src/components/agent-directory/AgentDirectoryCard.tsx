import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  MapPin, 
  Building2, 
  Home, 
  Clock,
  TrendingUp,
  Users,
  Briefcase
} from "lucide-react";
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
  const initials = `${agent.first_name?.[0] || ""}${agent.last_name?.[0] || ""}`.toUpperCase();
  const phoneNumber = agent.cell_phone || agent.phone;

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
    <Card className="group overflow-hidden border bg-card hover:shadow-md transition-shadow">
      <div className="p-4">
        {/* Top row: Photo + Basic Info + Quick Actions */}
        <div className="flex gap-4">
          {/* Agent Photo - Smaller */}
          <Avatar className="h-16 w-16 flex-shrink-0 border-2 border-border">
            <AvatarImage src={agent.headshot_url} alt={`${agent.first_name} ${agent.last_name}`} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Name, Title, Brokerage */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {agent.first_name} {agent.last_name}
            </h3>
            {agent.title && (
              <p className="text-sm text-muted-foreground truncate">{agent.title}</p>
            )}
            {(agent.company || agent.office_name) && (
              <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{agent.company || agent.office_name}</span>
              </div>
            )}
          </div>

          {/* Quick Action Icons */}
          <div className="flex items-start gap-1">
            {phoneNumber && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={handlePhoneClick}
                title={formatPhoneNumber(phoneNumber)}
              >
                <Phone className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={handleEmailClick}
              title={agent.email}
            >
              <Mail className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={handleMessageClick}
              title="Send Message"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Service Areas */}
        {agent.serviceAreas && agent.serviceAreas.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <MapPin className="h-3 w-3" />
              <span>Service Areas</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {agent.serviceAreas.slice(0, 3).map((area, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs font-normal">
                  {area}
                </Badge>
              ))}
              {agent.serviceAreas.length > 3 && (
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                  +{agent.serviceAreas.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Agent Mode Intel Section */}
        {isAgentMode && (
          <div className="mt-3 pt-3 border-t border-border bg-muted/30 -mx-4 -mb-4 px-4 pb-4 rounded-b-lg">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {/* Active Listings */}
              <div className="flex items-center gap-2">
                <Home className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-muted-foreground">Active:</span>
                <span className="font-medium text-foreground">{agent.activeListingsCount ?? 0}</span>
              </div>
              
              {/* Coming Soon / Off-Market */}
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-muted-foreground">Pipeline:</span>
                <span className="font-medium text-foreground">
                  {(agent.comingSoonCount ?? 0) + (agent.offMarketCount ?? 0)}
                </span>
              </div>
              
              {/* Last 12 Months Sales */}
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                <span className="text-muted-foreground">12mo Sales:</span>
                <span className="font-medium text-foreground">{agent.last12MonthsSales ?? 0}</span>
              </div>
              
              {/* Buyer Matches */}
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-muted-foreground">Matches:</span>
                <span className="font-medium text-foreground">{agent.buyerMatchCount ?? 0}</span>
              </div>
            </div>

            {/* Specialties */}
            {agent.specialties && agent.specialties.length > 0 && (
              <div className="mt-3 pt-2 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <Briefcase className="h-3 w-3" />
                  <span>Specialties</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {agent.specialties.slice(0, 3).map((specialty, idx) => (
                    <Badge key={idx} variant="outline" className="text-[10px] font-normal py-0">
                      {specialty}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Last Active */}
            {agent.updated_at && (
              <div className="mt-2 text-[10px] text-muted-foreground">
                Last active: {formatDistanceToNow(new Date(agent.updated_at), { addSuffix: true })}
              </div>
            )}
          </div>
        )}

        {/* View Profile CTA */}
        <div className={`mt-3 ${isAgentMode ? 'pt-3' : ''}`}>
          <Button 
            variant="outline" 
            size="sm" 
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

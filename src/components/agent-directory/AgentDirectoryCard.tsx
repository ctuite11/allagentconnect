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
  Briefcase,
  Globe,
  Instagram,
  Linkedin
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
  const primaryArea = agent.serviceAreas?.[0] || null;
  const secondaryArea = agent.serviceAreas?.[1] || null;

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

  const handleWebsiteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (agent.social_links?.website) {
      window.open(agent.social_links.website, '_blank');
    }
  };

  const handleInstagramClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (agent.social_links?.instagram) {
      window.open(agent.social_links.instagram, '_blank');
    }
  };

  const handleLinkedinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (agent.social_links?.linkedin) {
      window.open(agent.social_links.linkedin, '_blank');
    }
  };

  // CONSUMER MODE: Clean, trust-focused card
  if (!isAgentMode) {
    return (
      <Card className="group overflow-hidden border bg-card hover:shadow-lg transition-all duration-200">
        <div className="p-5">
          {/* Large Profile Photo - Visual Anchor */}
          <div className="flex justify-center mb-4">
            <Avatar className="h-24 w-24 border-3 border-border shadow-sm">
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

          {/* Primary Area (1-2 max) */}
          {primaryArea && (
            <div className="flex items-center justify-center gap-1.5 mt-2 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {primaryArea}
                {secondaryArea && ` • ${secondaryArea}`}
              </span>
            </div>
          )}

          {/* Colored Contact Icons */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {phoneNumber && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900"
                onClick={handlePhoneClick}
                title={formatPhoneNumber(phoneNumber)}
              >
                <Phone className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900"
              onClick={handleEmailClick}
              title={agent.email}
            >
              <Mail className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700 dark:bg-purple-950 dark:text-purple-400 dark:hover:bg-purple-900"
              onClick={handleMessageClick}
              title="Send Message"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            {agent.social_links?.linkedin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700 dark:bg-sky-950 dark:text-sky-400 dark:hover:bg-sky-900"
                onClick={handleLinkedinClick}
                title="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </Button>
            )}
            {agent.social_links?.instagram && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full bg-pink-50 text-pink-600 hover:bg-pink-100 hover:text-pink-700 dark:bg-pink-950 dark:text-pink-400 dark:hover:bg-pink-900"
                onClick={handleInstagramClick}
                title="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </Button>
            )}
            {agent.social_links?.website && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                onClick={handleWebsiteClick}
                title="Website"
              >
                <Globe className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* CTAs */}
          <div className="mt-5 space-y-2">
            <Button 
              className="w-full"
              onClick={handleMessageClick}
            >
              Contact Agent
            </Button>
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
  }

  // AGENT MODE: Intel-focused card with metrics
  return (
    <Card className="group overflow-hidden border bg-card hover:shadow-md transition-shadow">
      <div className="p-4">
        {/* Top row: Photo + Basic Info + Quick Actions */}
        <div className="flex gap-4">
          {/* Agent Photo */}
          <Avatar className="h-16 w-16 flex-shrink-0 border-2 border-border">
            <AvatarImage src={agent.headshot_url} alt={fullName} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Name, Title, Brokerage - No Truncation */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground leading-tight">
              {fullName}
            </h3>
            {agent.title && (
              <p className="text-sm text-muted-foreground">{agent.title}</p>
            )}
            {(agent.company || agent.office_name) && (
              <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{agent.company || agent.office_name}</span>
              </div>
            )}
          </div>

          {/* Quick Action Icons */}
          <div className="flex items-start gap-1">
            {phoneNumber && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={handlePhoneClick}
                title={formatPhoneNumber(phoneNumber)}
              >
                <Phone className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={handleEmailClick}
              title={agent.email}
            >
              <Mail className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
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

        {/* Agent Intel Section */}
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

          {/* Buyer Incentives Badge */}
          {agent.buyer_incentives && agent.buyer_incentives.trim() && (
            <div className="mt-2">
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Buyer Incentives
              </Badge>
            </div>
          )}

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

        {/* View Profile CTA */}
        <div className="mt-3 pt-3">
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
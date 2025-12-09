import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Mail, MessageSquare, MapPin, Building2, CheckCircle2, Star } from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { useNavigate } from "react-router-dom";

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
    created_at?: string;
    social_links?: {
      website?: string;
      instagram?: string;
      linkedin?: string;
    };
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
  agentIndex?: number; // Position in the list for founding member check
}

const AgentDirectoryCard = ({ agent, isAgentMode, onMessage, agentIndex = 999 }: AgentDirectoryCardProps) => {
  const navigate = useNavigate();
  const fullName = `${agent.first_name} ${agent.last_name}`;
  const initials = `${agent.first_name?.[0] || ""}${agent.last_name?.[0] || ""}`.toUpperCase();
  const phoneNumber = agent.cell_phone || agent.phone;
  const primaryArea = agent.serviceAreas?.[0] || null;

  // Verified badge logic: has photo, brokerage, service area, and contact method
  const hasPhoto = !!agent.headshot_url;
  const hasBrokerage = !!(agent.company || agent.office_name);
  const hasServiceArea = !!primaryArea;
  const hasContact = !!(phoneNumber || agent.email);
  const isVerified = hasPhoto && hasBrokerage && hasServiceArea && hasContact;
  
  // Founding Member: first 100 agents (index 0-99)
  const isFoundingMember = agentIndex < 100;

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
    <Card className="group overflow-hidden border bg-card transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1.5 hover:border-primary/20">
      <div className="p-5">
        {/* Large Profile Photo with Halo Ring - NO badges on photo */}
        <div className="flex justify-center mb-4 relative">
          <div className="relative">
            {/* Halo ring */}
            <div className="absolute inset-0 rounded-full bg-primary/15 blur-sm scale-110" />
            <Avatar className="h-24 w-24 border-2 border-border shadow-sm relative z-10 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
              <AvatarImage src={agent.headshot_url} alt={fullName} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-2xl">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Full Name + Inline Badges */}
        <div className="text-center">
          <h3 className="font-semibold text-lg text-foreground leading-tight">
            {fullName}
          </h3>
          {/* Badges inline below name */}
          {(isVerified || isFoundingMember) && (
            <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
              {isVerified && (
                <span className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400 text-xs font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Verified
                </span>
              )}
              {isVerified && isFoundingMember && (
                <span className="text-muted-foreground text-xs">·</span>
              )}
              {isFoundingMember && (
                <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 text-xs font-medium">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  Founding Member
                </span>
              )}
            </div>
          )}
        </div>

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

        {/* Colored Contact Icons with Micro-Animations */}
        <div className="flex items-center justify-center gap-3 mt-4">
          {phoneNumber && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-green-200/50 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900 dark:hover:shadow-green-900/50 transition-all duration-200 cursor-pointer"
              onClick={handlePhoneClick}
              title={formatPhoneNumber(phoneNumber)}
            >
              <Phone className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-blue-200/50 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900 dark:hover:shadow-blue-900/50 transition-all duration-200 cursor-pointer"
            onClick={handleEmailClick}
            title={agent.email}
          >
            <Mail className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-purple-200/50 dark:bg-purple-950 dark:text-purple-400 dark:hover:bg-purple-900 dark:hover:shadow-purple-900/50 transition-all duration-200 cursor-pointer"
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
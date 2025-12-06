import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  Phone, 
  Globe, 
  Linkedin, 
  Facebook, 
  Twitter, 
  Instagram, 
  Download,
  Users,
  ShieldCheck,
  MessageSquare
} from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { getHeaderBackgroundStyle } from "@/components/profile-editor/HeaderBackgroundSelector";
import ContactAgentProfileDialog from "@/components/ContactAgentProfileDialog";

interface SocialLinks {
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  website?: string;
  tiktok?: string;
}

interface AgentProfileHeaderProps {
  agent: {
    id: string;
    first_name: string;
    last_name: string;
    title: string | null;
    email: string;
    cell_phone: string | null;
    office_phone: string | null;
    company: string | null;
    headshot_url: string | null;
    logo_url: string | null;
    social_links: SocialLinks | null;
    aac_id?: string | null;
    header_background_type?: string;
    header_background_value?: string;
    header_image_url?: string;
  };
  onSaveContact: () => void;
}

const AgentProfileHeader = ({ agent, onSaveContact }: AgentProfileHeaderProps) => {
  const hasSocialLinks = agent.social_links && Object.values(agent.social_links).some(link => link);
  
  const backgroundType = agent.header_background_type || "gradient";
  const backgroundValue = agent.header_background_value || "blue-indigo";
  const headerImageUrl = agent.header_image_url;

  const socialIcons = [
    { key: "facebook", icon: Facebook, url: agent.social_links?.facebook },
    { key: "instagram", icon: Instagram, url: agent.social_links?.instagram },
    { key: "linkedin", icon: Linkedin, url: agent.social_links?.linkedin },
    { key: "twitter", icon: Twitter, url: agent.social_links?.twitter },
  ].filter(s => s.url);

  return (
    <div 
      className="relative w-full"
      style={getHeaderBackgroundStyle(backgroundType, backgroundValue, headerImageUrl)}
    >
      {/* Desktop: min-height 280px, Mobile: min-height 200px */}
      <div className="min-h-[200px] md:min-h-[280px] py-8 md:py-10">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          {/* Mobile Layout */}
          <div className="flex flex-col items-center gap-5 md:hidden">
            {/* Photo */}
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/90 shadow-xl bg-white">
                {agent.headshot_url ? (
                  <img 
                    src={agent.headshot_url} 
                    alt={`${agent.first_name} ${agent.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">
                      {agent.first_name[0]}{agent.last_name[0]}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Name & Details */}
            <div className="text-center text-white">
              <h1 className="text-2xl font-bold drop-shadow-md">
                {agent.first_name} {agent.last_name}
              </h1>
              {agent.title && (
                <p className="text-white/90 text-sm mt-0.5">{agent.title}</p>
              )}
              {agent.company && (
                <p className="text-white/80 text-sm">{agent.company}</p>
              )}
              
              {/* Contact Info */}
              <div className="mt-3 space-y-1 text-sm">
                {agent.office_phone && (
                  <a href={`tel:${agent.office_phone}`} className="flex items-center justify-center gap-1.5 text-white/90 hover:text-white">
                    <Phone className="h-3 w-3" />
                    Office: {formatPhoneNumber(agent.office_phone)}
                  </a>
                )}
                {agent.cell_phone && (
                  <a href={`tel:${agent.cell_phone}`} className="flex items-center justify-center gap-1.5 text-white/90 hover:text-white">
                    <Phone className="h-3 w-3" />
                    Cell: {formatPhoneNumber(agent.cell_phone)}
                  </a>
                )}
                {agent.email && (
                  <a href={`mailto:${agent.email}`} className="flex items-center justify-center gap-1.5 text-white/90 hover:text-white">
                    <Mail className="h-3 w-3" />
                    {agent.email}
                  </a>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <ContactAgentProfileDialog 
                agentId={agent.id}
                agentName={`${agent.first_name} ${agent.last_name}`}
                agentEmail={agent.email}
              />
              <Button 
                variant="secondary" 
                className="w-full bg-white/20 text-white border-white/30 hover:bg-white/30"
                onClick={onSaveContact}
              >
                <Download className="h-4 w-4 mr-2" />
                Save Contact
              </Button>
            </div>

            {/* Social Icons - Mobile */}
            {socialIcons.length > 0 && (
              <div className="flex items-center gap-3">
                {socialIcons.map(({ key, icon: Icon, url }) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}

            {/* Logo & Badges - Mobile */}
            <div className="flex flex-col items-center gap-3">
              {agent.logo_url && (
                <img 
                  src={agent.logo_url} 
                  alt="Company logo" 
                  className="h-10 max-w-[100px] object-contain bg-white/90 rounded px-2 py-1"
                />
              )}
              <div className="flex gap-2">
                <Badge className="bg-primary/90 text-white border-0 text-xs gap-1">
                  <Users className="h-3 w-3" />
                  DirectConnect
                </Badge>
                <Badge className="bg-accent/90 text-white border-0 text-xs gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </Badge>
              </div>
            </div>
          </div>

          {/* Desktop Layout - 3 Column */}
          <div className="hidden md:grid grid-cols-[180px_1fr_160px] gap-8 items-start">
            {/* LEFT COLUMN: Photo + Social Icons */}
            <div className="flex flex-col items-center gap-4">
              {/* Agent Photo */}
              <div className="w-40 h-40 lg:w-44 lg:h-44 rounded-full overflow-hidden border-4 border-white/90 shadow-xl bg-white">
                {agent.headshot_url ? (
                  <img 
                    src={agent.headshot_url} 
                    alt={`${agent.first_name} ${agent.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                    <span className="text-3xl font-bold text-primary">
                      {agent.first_name[0]}{agent.last_name[0]}
                    </span>
                  </div>
                )}
              </div>

              {/* Social Icons Row */}
              {socialIcons.length > 0 && (
                <div className="flex items-center gap-2">
                  {socialIcons.map(({ key, icon: Icon, url }) => (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* CENTER COLUMN: Name, Title, Contact, Buttons */}
            <div className="text-white">
              <h1 className="text-3xl lg:text-4xl font-bold drop-shadow-md">
                {agent.first_name} {agent.last_name}
              </h1>
              {agent.title && (
                <p className="text-white/90 text-lg mt-0.5">{agent.title}</p>
              )}
              {agent.company && (
                <p className="text-white/80 mt-0.5">{agent.company}</p>
              )}
              {agent.aac_id && (
                <p className="text-white/60 text-sm mt-1">Agent ID: {agent.aac_id}</p>
              )}
              
              {/* Contact Info */}
              <div className="mt-4 space-y-1 text-sm">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {agent.office_phone && (
                    <a href={`tel:${agent.office_phone}`} className="flex items-center gap-1.5 text-white/90 hover:text-white">
                      <Phone className="h-3.5 w-3.5" />
                      Office: {formatPhoneNumber(agent.office_phone)}
                    </a>
                  )}
                  {agent.cell_phone && (
                    <a href={`tel:${agent.cell_phone}`} className="flex items-center gap-1.5 text-white/90 hover:text-white">
                      <Phone className="h-3.5 w-3.5" />
                      Cell: {formatPhoneNumber(agent.cell_phone)}
                    </a>
                  )}
                </div>
                {agent.email && (
                  <a href={`mailto:${agent.email}`} className="flex items-center gap-1.5 text-white/90 hover:text-white">
                    <Mail className="h-3.5 w-3.5" />
                    {agent.email}
                  </a>
                )}
                {agent.social_links?.website && (
                  <a 
                    href={agent.social_links.website.startsWith('http') ? agent.social_links.website : `https://${agent.social_links.website}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-white/90 hover:text-white"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {agent.social_links.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 mt-5">
                <ContactAgentProfileDialog 
                  agentId={agent.id}
                  agentName={`${agent.first_name} ${agent.last_name}`}
                  agentEmail={agent.email}
                />
                <Button 
                  variant="secondary" 
                  className="bg-white/20 text-white border-white/30 hover:bg-white/30"
                  onClick={onSaveContact}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Save Contact
                </Button>
              </div>
            </div>

            {/* RIGHT COLUMN: Logo + Badges */}
            <div className="flex flex-col items-end gap-4 pt-2">
              {agent.logo_url && (
                <img 
                  src={agent.logo_url} 
                  alt="Company logo" 
                  className="h-14 lg:h-16 max-w-[140px] object-contain bg-white/90 rounded-lg px-3 py-2"
                />
              )}
              <div className="flex flex-col gap-2 items-end">
                <Badge className="bg-primary/90 text-white border-0 gap-1.5 px-3 py-1.5 text-xs">
                  <Users className="h-3 w-3" />
                  DirectConnect Friendly
                </Badge>
                <Badge className="bg-accent/90 text-white border-0 gap-1.5 px-3 py-1.5 text-xs">
                  <ShieldCheck className="h-3 w-3" />
                  Verified Agent
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentProfileHeader;

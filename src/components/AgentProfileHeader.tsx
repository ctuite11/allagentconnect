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
  ArrowLeft
} from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { getHeaderBackgroundStyle } from "@/components/profile-editor/HeaderBackgroundSelector";
import ContactAgentProfileDialog from "@/components/ContactAgentProfileDialog";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
  
  const backgroundType = agent.header_background_type || "color";
  const backgroundValue = agent.header_background_value || "directconnect-blue";

  const socialIcons = [
    { key: "facebook", icon: Facebook, url: agent.social_links?.facebook },
    { key: "instagram", icon: Instagram, url: agent.social_links?.instagram },
    { key: "linkedin", icon: Linkedin, url: agent.social_links?.linkedin },
    { key: "twitter", icon: Twitter, url: agent.social_links?.twitter },
  ].filter(s => s.url);

  return (
    <div 
      className="relative w-full"
      style={getHeaderBackgroundStyle(backgroundType, backgroundValue)}
    >
      {/* Header: 300-360px desktop, 240px mobile */}
      <div className="min-h-[240px] md:min-h-[320px] lg:min-h-[340px] py-6 md:py-8">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          
          {/* Back Button */}
          <button
            onClick={() => {
              if (window.history.length > 2) {
                navigate(-1);
              } else {
                navigate("/agent-search");
              }
            }}
            className="mb-5 p-1.5 -ml-1.5 rounded-md hover:bg-white/20 transition-colors text-white/80 hover:text-white"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Mobile Layout */}
          <div className="flex flex-col items-center gap-4 md:hidden">
            {/* Photo */}
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

            {/* Name & Details */}
            <div className="text-center text-white">
              <h1 className="text-2xl font-bold drop-shadow-md">
                {agent.first_name} {agent.last_name}
              </h1>
              {agent.title && <p className="text-white/90 text-sm">{agent.title}</p>}
              {agent.company && <p className="text-white/80 text-sm">{agent.company}</p>}
              {agent.aac_id && <p className="text-white/60 text-xs mt-1">Agent ID: {agent.aac_id}</p>}
              
              {/* Contact Info */}
              <div className="mt-2 space-y-0.5 text-sm">
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

            {/* Social Icons */}
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

            {/* Logo & Badges */}
            <div className="flex flex-col items-center gap-2">
              {agent.logo_url && (
                <img 
                  src={agent.logo_url} 
                  alt="Company logo" 
                  className="h-14 max-w-[120px] object-contain bg-white/90 rounded-lg px-3 py-2"
                />
              )}
              <div className="flex gap-2">
                <Badge className="bg-primary/90 text-white border-0 text-xs gap-1">
                  <Users className="h-3 w-3" />
                  DirectConnect
                </Badge>
                <Badge className="bg-emerald-600/90 text-white border-0 text-xs gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </Badge>
              </div>
            </div>
          </div>

          {/* Desktop Layout - Hybrid: Left (Photo + Content), Right (Logo + Badges) */}
          <div className="hidden md:flex justify-between items-start gap-6 lg:gap-10">
            {/* LEFT: Photo + Content Block */}
            <div className="flex items-start gap-5 lg:gap-6">
              {/* Agent Photo - 160-180px */}
              <div className="flex-shrink-0 w-36 h-36 lg:w-44 lg:h-44 rounded-full overflow-hidden border-4 border-white/90 shadow-xl bg-white">
                {agent.headshot_url ? (
                  <img 
                    src={agent.headshot_url} 
                    alt={`${agent.first_name} ${agent.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                    <span className="text-3xl lg:text-4xl font-bold text-primary">
                      {agent.first_name[0]}{agent.last_name[0]}
                    </span>
                  </div>
                )}
              </div>

              {/* Name, Title, Contact, Buttons */}
              <div className="text-white pt-1">
                <h1 className="text-2xl lg:text-3xl font-bold drop-shadow-md leading-tight">
                  {agent.first_name} {agent.last_name}
                </h1>
                {agent.title && <p className="text-white/90 text-base lg:text-lg">{agent.title}</p>}
                {agent.company && <p className="text-white/80 text-sm lg:text-base">{agent.company}</p>}
                {agent.aac_id && <p className="text-white/60 text-xs mt-1">Agent ID: {agent.aac_id}</p>}
                
                {/* Contact Row */}
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
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

                {/* Action Buttons + Social Icons */}
                <div className="flex items-center gap-2 lg:gap-3 mt-4">
                  <ContactAgentProfileDialog 
                    agentId={agent.id}
                    agentName={`${agent.first_name} ${agent.last_name}`}
                    agentEmail={agent.email}
                  />
                  <Button 
                    variant="secondary" 
                    size="sm"
                    className="bg-white/20 text-white border-white/30 hover:bg-white/30"
                    onClick={onSaveContact}
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    Save Contact
                  </Button>
                  
                  {/* Social Icons inline */}
                  {socialIcons.length > 0 && (
                    <div className="flex items-center gap-1.5 ml-1">
                      {socialIcons.map(({ key, icon: Icon, url }) => (
                        <a
                          key={key}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: Logo (Large 120-160px) + Badges */}
            <div className="flex flex-col items-end gap-3 pt-1">
              {agent.logo_url && (
                <img 
                  src={agent.logo_url} 
                  alt="Company logo" 
                  className="h-20 lg:h-24 max-w-[160px] object-contain bg-white/95 rounded-xl px-4 py-2.5 shadow-lg"
                />
              )}
              <div className="flex flex-col gap-2 items-end">
                <Badge className="bg-primary/90 text-white border-0 gap-1.5 px-3 py-1.5 text-xs shadow-md">
                  <Users className="h-3 w-3" />
                  DirectConnect Friendly
                </Badge>
                <Badge className="bg-emerald-600/90 text-white border-0 gap-1.5 px-3 py-1.5 text-xs shadow-md">
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

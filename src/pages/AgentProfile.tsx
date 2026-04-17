import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Loader2, 
  Star, 
  Quote,
  Phone,
  Mail,
  Globe,
  Linkedin,
  Facebook,
  Twitter,
  Instagram,
  Download,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import AACMonogram from "@/components/ui/AACMonogram";
import ContactAgentProfileDialog from "@/components/ContactAgentProfileDialog";
import { useAgentLastSeen } from "@/hooks/useAgentLastSeen";
import { findOrCreateConversation } from "@/lib/startConversation";
import { useAuthRole } from "@/hooks/useAuthRole";
import { Seo } from "@/components/Seo";
import { getPublicOrigin } from "@/lib/getPublicUrl";

const generateVCard = (agent: AgentProfileData) => {
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${agent.first_name} ${agent.last_name}`,
    `N:${agent.last_name};${agent.first_name};;;`,
    `EMAIL:${agent.email}`,
    agent.cell_phone ? `TEL;TYPE=CELL:${agent.cell_phone}` : '',
    agent.office_phone ? `TEL;TYPE=WORK:${agent.office_phone}` : '',
    agent.title ? `TITLE:${agent.title}` : '',
    agent.company ? `ORG:${agent.company}` : '',
    agent.office_address ? `ADR;TYPE=WORK:;;${agent.office_address};;;;` : '',
    agent.social_links?.website ? `URL:${agent.social_links.website}` : '',
    agent.social_links?.linkedin ? `X-SOCIALPROFILE;TYPE=linkedin:${agent.social_links.linkedin}` : '',
    'END:VCARD'
  ].filter(line => line).join('\n');
  
  const blob = new Blob([vcard], { type: 'text/vcard' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${agent.first_name}_${agent.last_name}.vcf`;
  link.click();
  window.URL.revokeObjectURL(url);
};

interface AgentProfileData {
  id: string;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string;
  phone: string | null;
  cell_phone: string | null;
  office_phone: string | null;
  company: string | null;
  office_name: string | null;
  office_address: string | null;
  office_city: string | null;
  office_state: string | null;
  office_zip: string | null;
  bio: string | null;
  buyer_incentives: string | null;
  seller_incentives: string | null;
  headshot_url: string | null;
  logo_url: string | null;
  social_links: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    website?: string;
  } | null;
  receive_buyer_alerts: boolean;
  aac_id?: string | null;
  header_background_type?: string;
  header_background_value?: string;
  header_image_url?: string;
  agent_county_preferences: {
    county_id: string;
    counties: {
      name: string;
      state: string;
    };
  }[];
}

interface Testimonial {
  id: string;
  client_name: string;
  client_title: string | null;
  testimonial_text: string;
  rating: number | null;
  created_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const socialIconMap = [
  { key: "linkedin", icon: Linkedin },
  { key: "facebook", icon: Facebook },
  { key: "instagram", icon: Instagram },
  { key: "twitter", icon: Twitter },
] as const;

const AgentProfile = () => {
  const { id: idOrCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthRole();
  const [agent, setAgent] = useState<AgentProfileData | null>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const { isOnline } = useAgentLastSeen(agent?.id);

  useEffect(() => {
    fetchAgentProfile();
  }, [idOrCode]);

  const fetchAgentProfile = async () => {
    try {
      setLoading(true);

      const isUuid = UUID_RE.test(idOrCode ?? "");
      const filterCol = isUuid ? "id" : "aac_id";

      const { data: agentData, error: agentError } = await supabase
        .from("agent_profiles")
        .select(`
          *,
          agent_county_preferences (
            county_id,
            counties (name, state)
          )
        `)
        .eq(filterCol, idOrCode)
        .maybeSingle();

      if (agentError) throw agentError;
      if (!agentData) {
        toast.error("Agent not found");
        navigate("/our-members");
        return;
      }

      setAgent(agentData as AgentProfileData);

      const agentUuid = agentData.id;

      const { data: listingsData, error: listingsError } = await supabase
        .from("listings")
        .select("*")
        .eq("agent_id", agentUuid)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(6);

      if (listingsError) throw listingsError;
      setListings(listingsData || []);

      const { data: testimonialsData, error: testimonialsError } = await supabase
        .from("testimonials")
        .select("*")
        .eq("agent_id", agentUuid)
        .order("created_at", { ascending: false });

      if (testimonialsError) throw testimonialsError;
      setTestimonials(testimonialsData || []);
    } catch (error: any) {
      console.error("Error fetching agent profile:", error);
      toast.error("Failed to load agent profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-sm text-muted-foreground">Agent not found</p>
      </div>
    );
  }

  const activeSocials = socialIconMap.filter(
    (s) => agent.social_links?.[s.key as keyof typeof agent.social_links]
  );

  const contactItems = [
    agent.office_phone && { icon: Phone, label: `Office ${formatPhoneNumber(agent.office_phone)}`, href: `tel:${agent.office_phone}` },
    agent.cell_phone && { icon: Phone, label: `Cell ${formatPhoneNumber(agent.cell_phone)}`, href: `tel:${agent.cell_phone}` },
    agent.email && { icon: Mail, label: agent.email, href: `mailto:${agent.email}` },
    agent.social_links?.website && {
      icon: Globe,
      label: agent.social_links.website.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      href: agent.social_links.website.startsWith("http") ? agent.social_links.website : `https://${agent.social_links.website}`,
    },
  ].filter(Boolean) as { icon: typeof Phone; label: string; href: string }[];

  const agentFullName = `${agent.first_name} ${agent.last_name}`;
  const agentProfileUrl = `${getPublicOrigin()}/agent/${agent.aac_id || agent.id}`;

  return (
    <div className="flex-1 bg-background min-h-screen">
      <Seo
        title={`${agentFullName} — ${agent.title || "Realtor"} at ${agent.company || "All Agent Connect"}`}
        description={agent.bio?.substring(0, 155) || `${agentFullName} is a real estate professional on All Agent Connect.`}
        image={agent.headshot_url || undefined}
        canonical={agentProfileUrl}
        type="profile"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: agentFullName,
          url: agentProfileUrl,
          jobTitle: agent.title || "Realtor",
          worksFor: { "@type": "Organization", name: agent.company || undefined },
          ...(agent.headshot_url ? { image: agent.headshot_url } : {}),
          ...(agent.bio ? { description: agent.bio.substring(0, 200) } : {}),
        }}
      />
      {/* Back nav — destination depends on auth context */}
      <div className="max-w-6xl mx-auto px-8 pt-6">
        <button
          onClick={() => navigate(user ? "/our-members" : -1 as any)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {user ? "Back to Network" : "Back"}
        </button>
      </div>

      {/* ─── Hero Section ─── */}
      <div className="max-w-6xl mx-auto px-8 pt-12 pb-10">
        {/* Row 1: Photo + Identity + Logo */}
        <div className="flex items-center gap-6">
          {/* Photo */}
          <div className="relative flex-shrink-0">
            {agent.headshot_url ? (
              <img
                src={agent.headshot_url}
                alt={`${agent.first_name} ${agent.last_name}`}
                className="w-[120px] h-[120px] rounded-lg object-cover border border-border/50 shadow-sm"
              />
            ) : (
              <div className="w-[120px] h-[120px] rounded-lg bg-primary flex flex-col items-center justify-center gap-1.5 shadow-sm border border-border/50">
                <AACMonogram className="w-10 h-10 text-primary-foreground" />
                <span className="text-base font-bold text-primary-foreground tracking-tight">
                  {agent.first_name[0]}{agent.last_name[0]}
                </span>
              </div>
            )}
            {isOnline && (
              <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background ring-2 ring-aacSuccess/20" />
            )}
          </div>

          {/* Identity */}
          <div className="flex flex-col justify-center min-w-0 pt-1">
            <h1 className="text-3xl font-bold text-foreground tracking-tight leading-tight">
              {agent.first_name} {agent.last_name}
            </h1>

            {agent.title && (
              <p className="text-base text-muted-foreground mt-1.5">
                {agent.title}
              </p>
            )}

            {(agent.company || agent.aac_id) && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground/70 mt-1">
                {agent.company && <span>{agent.company}</span>}
                {agent.company && agent.aac_id && <span className="text-muted-foreground/30">·</span>}
                {agent.aac_id && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-aacSuccess" />
                    <span className="font-mono text-xs text-muted-foreground/50">{agent.aac_id}</span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Row 2: Buttons + Metadata aligned under photo */}
        <div className="mt-4 flex flex-col items-start gap-5" style={{ paddingLeft: 0 }}>
          <div className="flex items-center gap-2">
            <ContactAgentProfileDialog
              agentId={agent.id}
              agentName={`${agent.first_name} ${agent.last_name}`}
              agentEmail={agent.email}
              buttonText={`Email ${agent.first_name}`}
            />

            <Button
              size="sm"
              variant="outline"
              className="rounded-md"
              disabled={isStartingChat}
              onClick={async () => {
                if (!user?.id || !agent.id) return;
                setIsStartingChat(true);
                try {
                  const convoId = await findOrCreateConversation(user.id, agent.id);
                  if (convoId) navigate(`/messages/${convoId}`);
                } catch (e) {
                  toast.error("Could not start conversation");
                } finally {
                  setIsStartingChat(false);
                }
              }}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Message {agent.first_name}
            </Button>
          </div>

          {contactItems.length > 0 && (
            <div className="flex items-center flex-wrap gap-x-1 gap-y-1 text-sm text-muted-foreground">
              {contactItems.map((item, i) => (
                <span key={i} className="flex items-center">
                  {i > 0 && <span className="mx-2 text-border">·</span>}
                  <a
                    href={item.href}
                    target={item.icon === Globe ? "_blank" : undefined}
                    rel={item.icon === Globe ? "noopener noreferrer" : undefined}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors whitespace-nowrap"
                  >
                    <item.icon className="h-3.5 w-3.5 text-primary/70" />
                    {item.label}
                  </a>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Content Sections ─── */}
      <div className="max-w-6xl mx-auto px-8 pb-16">

        {/* About */}
        {agent.bio && (
          <section className="border-t border-border/50 py-10">
            <div className="grid md:grid-cols-[200px_1fr] gap-6">
              <div>
                <p className="text-[11px] font-semibold text-primary uppercase tracking-[0.15em]">About</p>
                <h2 className="text-lg font-semibold text-foreground mt-1 leading-snug">
                  Get to Know<br />{agent.first_name}
                </h2>
              </div>
              <p className="text-[15px] text-foreground/80 leading-relaxed whitespace-pre-wrap max-w-xl">
                {agent.bio}
              </p>
            </div>

            {/* Social icons */}
            {activeSocials.length > 0 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                {activeSocials.map(({ key, icon: Icon }) => (
                  <a
                    key={key}
                    href={agent.social_links![key as keyof typeof agent.social_links]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}

            {/* Company logo */}
            {agent.logo_url && (
              <div className="flex justify-center mt-6">
                <img
                  src={agent.logo_url}
                  alt="Company logo"
                  className="h-8 max-w-[160px] object-contain opacity-25"
                />
              </div>
            )}
          </section>
        )}

        {/* Testimonials */}
        {testimonials.length > 0 && (
          <section className="border-t border-border/50 py-10">
            <div className="text-center mb-8">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-[0.15em]">Testimonials</p>
              <h2 className="text-xl font-semibold text-foreground mt-1">What Clients Are Saying</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {testimonials.slice(0, 6).map((testimonial) => (
                <div
                  key={testimonial.id}
                  className="rounded-xl border border-border bg-white p-5 relative"
                >
                  <Quote className="h-5 w-5 text-primary/15 mb-3" />
                  {testimonial.rating && (
                    <div className="flex gap-0.5 mb-3">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < testimonial.rating!
                              ? "text-amber-500 fill-amber-500"
                              : "text-muted-foreground/20"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-[14px] text-muted-foreground leading-relaxed">
                    "{testimonial.testimonial_text}"
                  </p>
                  <p className="mt-3 text-[13px] font-semibold text-foreground">
                    — {testimonial.client_name}
                  </p>
                  {testimonial.client_title && (
                    <p className="text-xs text-muted-foreground">{testimonial.client_title}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Listings */}
        <section className="border-t border-border/50 py-10">
          <div className="text-center mb-8">
            <p className="text-[11px] font-semibold text-primary uppercase tracking-[0.15em]">Featured Properties</p>
            <h2 className="text-xl font-semibold text-foreground mt-1">Current Listings</h2>
          </div>

          {listings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center">
              No active listings.{" "}
              <button
                onClick={() => navigate("/listing-search")}
                className="text-primary hover:underline"
              >
                Browse all listings
              </button>
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {listings.map((listing) => (
                <Card
                  key={listing.id}
                  className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
                  onClick={() => navigate(`/property/${listing.id}`)}
                >
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={listing.photos && listing.photos.length > 0 ? listing.photos[0].url : "/placeholder.svg"}
                      alt={listing.address}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-primary text-primary-foreground text-xs font-semibold shadow-sm">
                        ${listing.price.toLocaleString()}
                      </Badge>
                    </div>
                    <Badge className="absolute top-3 right-3 bg-white/90 text-foreground text-[10px] border-0 shadow-sm">
                      {listing.listing_type === "for_sale" ? "For Sale" : "For Rent"}
                    </Badge>
                  </div>
                  <CardContent className="p-4">
                    <p className="font-semibold text-foreground text-sm truncate">
                      {listing.address}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {listing.city}, {listing.state} {listing.zip_code}
                    </p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-2 pt-2 border-t border-border/40">
                      {listing.bedrooms && <span>{listing.bedrooms} bed</span>}
                      {listing.bathrooms && <span>{listing.bathrooms} bath</span>}
                      {listing.square_feet && <span>{listing.square_feet.toLocaleString()} sqft</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AgentProfile;

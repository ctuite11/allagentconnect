import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Loader2, 
  Home, 
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
  Users,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import AACMonogram from "@/components/ui/AACMonogram";
import ContactAgentProfileDialog from "@/components/ContactAgentProfileDialog";

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
  const [agent, setAgent] = useState<AgentProfileData | null>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="flex-1 bg-background min-h-screen">
      {/* Back nav */}
      <div className="max-w-3xl mx-auto px-8 pt-6">
        <button
          onClick={() => navigate("/our-members")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Network
        </button>
      </div>

      {/* ─── Identity Section ─── */}
      <div className="max-w-3xl mx-auto px-8 pt-10 pb-8">
        <div className="grid grid-cols-[192px_1fr] gap-8 items-start">

          {/* ── Left: Photo + Secondary Rail ── */}
          <div className="flex flex-col items-start gap-3">
            {agent.headshot_url ? (
              <img
                src={agent.headshot_url}
                alt={`${agent.first_name} ${agent.last_name}`}
                className="w-[192px] h-[192px] rounded-2xl object-cover shadow-sm"
              />
            ) : (
              <div className="w-[192px] h-[192px] rounded-2xl bg-muted flex flex-col items-center justify-center gap-2">
                <AACMonogram className="w-10 h-10 text-primary" />
                <span className="text-lg font-bold text-foreground tracking-tight">
                  {agent.first_name[0]}{agent.last_name[0]}
                </span>
              </div>
            )}

            {/* Social + Website + Logo — left-aligned rail */}
            <div className="flex flex-col items-start gap-2.5 pt-1">
              {activeSocials.length > 0 && (
                <div className="flex items-center gap-1">
                  {activeSocials.map(({ key, icon: Icon }) => (
                    <a
                      key={key}
                      href={agent.social_links![key as keyof typeof agent.social_links]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </a>
                  ))}
                </div>
              )}

              {agent.social_links?.website && (
                <a
                  href={agent.social_links.website.startsWith("http") ? agent.social_links.website : `https://${agent.social_links.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Globe className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate max-w-[160px]">
                    {agent.social_links.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </span>
                </a>
              )}

              {agent.logo_url && (
                <img
                  src={agent.logo_url}
                  alt="Company logo"
                  className="h-7 max-w-[140px] object-contain opacity-30"
                />
              )}
            </div>
          </div>

          {/* ── Right: Identity + Actions ── */}
          <div className="pt-1">
            {/* Name — hero element */}
            <h1 className="text-3xl font-bold text-foreground tracking-tight leading-none">
              {agent.first_name} {agent.last_name}
            </h1>

            {/* Subtle accent */}
            <div className="w-8 h-px bg-primary/30 mt-3" />

            {/* Title · Company */}
            {(agent.title || agent.company) && (
              <p className="text-[15px] text-muted-foreground mt-3">
                {[agent.title, agent.company].filter(Boolean).join(" · ")}
              </p>
            )}

            {/* Metadata */}
            <div className="mt-4 space-y-1 text-[13px] text-muted-foreground">
              {agent.aac_id && (
                <div className="font-mono text-xs text-foreground/40">{agent.aac_id}</div>
              )}
              {agent.email && (
                <a href={`mailto:${agent.email}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <Mail className="h-3 w-3 text-muted-foreground/50" />
                  {agent.email}
                </a>
              )}
              {agent.office_phone && (
                <a href={`tel:${agent.office_phone}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <Phone className="h-3 w-3 text-muted-foreground/50" />
                  Office {formatPhoneNumber(agent.office_phone)}
                </a>
              )}
              {agent.cell_phone && (
                <a href={`tel:${agent.cell_phone}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <Phone className="h-3 w-3 text-muted-foreground/50" />
                  Cell {formatPhoneNumber(agent.cell_phone)}
                </a>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-5">
              <ContactAgentProfileDialog
                agentId={agent.id}
                agentName={`${agent.first_name} ${agent.last_name}`}
                agentEmail={agent.email}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateVCard(agent)}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Save Contact
              </Button>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-1.5 mt-3">
              <Badge variant="secondary" className="text-[11px] gap-1 font-normal px-2 py-0.5">
                <Users className="h-3 w-3" />
                DirectConnect
              </Badge>
              <Badge variant="secondary" className="text-[11px] gap-1 font-normal px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Content Sections ─── */}
      <div className="max-w-3xl mx-auto px-8 pb-12 space-y-0">
        {/* About */}
        {agent.bio && (
          <section className="border-t border-border pt-6 pb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">About</h2>
            <p className="text-[15px] text-foreground/80 leading-relaxed whitespace-pre-wrap max-w-xl">
              {agent.bio}
            </p>
          </section>
        )}

        {/* Testimonials */}
        {testimonials.length > 0 && (
          <section className="border-t border-border pt-6 pb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">Testimonials</h2>
            <div className="space-y-3">
              {testimonials.slice(0, 3).map((testimonial) => (
                <div key={testimonial.id} className="border border-border rounded-xl bg-white p-4 relative">
                  <Quote className="absolute top-3 right-3 h-5 w-5 text-muted-foreground/10" />
                  {testimonial.rating && (
                    <div className="flex gap-0.5 mb-2">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${
                            i < testimonial.rating!
                              ? "text-amber-500 fill-amber-500"
                              : "text-muted-foreground/20"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-[14px] text-muted-foreground italic leading-relaxed pr-6">
                    "{testimonial.testimonial_text}"
                  </p>
                  <p className="mt-2.5 text-[13px] font-semibold text-foreground">
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
        <section className="border-t border-border pt-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            Listings
          </h2>

          {listings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active listings.{" "}
              <button
                onClick={() => navigate("/listing-search")}
                className="text-primary hover:underline"
              >
                Browse all listings
              </button>
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((listing) => (
                <Card
                  key={listing.id}
                  className="cursor-pointer hover:shadow-md hover:-translate-y-px transition-all duration-200 overflow-hidden group"
                  onClick={() => navigate(`/property/${listing.id}`)}
                >
                  <div className="relative h-36 overflow-hidden">
                    <img
                      src={listing.photos && listing.photos.length > 0 ? listing.photos[0].url : "/placeholder.svg"}
                      alt={listing.address}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground text-xs">
                      {listing.listing_type === "for_sale" ? "For Sale" : "For Rent"}
                    </Badge>
                  </div>
                  <CardContent className="p-3">
                    <p className="text-base font-bold text-primary mb-0.5">
                      ${listing.price.toLocaleString()}
                    </p>
                    <p className="font-medium text-foreground text-sm truncate">
                      {listing.address}
                    </p>
                    <p className="text-xs text-muted-foreground mb-1">
                      {listing.city}, {listing.state} {listing.zip_code}
                    </p>
                    <div className="flex gap-3 text-xs text-muted-foreground">
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

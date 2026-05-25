import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import ListingCard from "@/components/ListingCard";
import { mapMarketRowToListingCard } from "@/components/success-hub/listingCardAdapter";
import {
  listingEmailSubjectFromRow,
  type ListingAgentContact,
} from "@/lib/listingAgentContact";
import { AacBackButton } from "@/components/layout/AacBackLink";
import { AacPageIntro } from "@/components/layout/AacPageIntro";
import {
  Star,
  Quote,
  Phone,
  Mail,
  Globe,
  Linkedin,
  Facebook,
  Twitter,
  Instagram,
  MessageSquare,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import ContactAgentProfileDialog from "@/components/ContactAgentProfileDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentLastSeen } from "@/hooks/useAgentLastSeen";
import { findOrCreateConversation } from "@/lib/startConversation";
import { useAuthRole } from "@/hooks/useAuthRole";
import { Seo } from "@/components/Seo";
import { getPublicOrigin } from "@/lib/getPublicUrl";

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

const PROFILE_PAGE = "mx-auto w-full max-w-[82rem] px-6 md:px-10 lg:px-12";
const SECTION_RULE = "border-t border-neutral-100";
const SECTION_PAD = "py-10 md:py-12";
const EYEBROW = "text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400";

const socialIconMap = [
  { key: "linkedin", icon: Linkedin },
  { key: "facebook", icon: Facebook },
  { key: "instagram", icon: Instagram },
  { key: "twitter", icon: Twitter },
] as const;

interface AgentProfileProps {
  publicMode?: boolean;
}

const AgentProfile = ({ publicMode = false }: AgentProfileProps) => {
  const { id: idOrCode } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuthRole();
  const [agent, setAgent] = useState<AgentProfileData | null>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const { isOnline } = useAgentLastSeen(agent?.id);

  /** Internal AAC email — authenticated agents/admins viewing in-app profile only. */
  const showListingAgentEmail = !publicMode && (role === "agent" || role === "admin");
  const profileListingAgentContact = useMemo((): ListingAgentContact | null => {
    if (!showListingAgentEmail || !agent?.email?.trim()) return null;
    const name = [agent.first_name, agent.last_name].filter(Boolean).join(" ").trim();
    return {
      agentId: agent.id,
      agentEmail: agent.email.trim(),
      agentName: name || "Listing agent",
    };
  }, [showListingAgentEmail, agent]);

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
        navigate(publicMode ? "/our-agents" : "/our-members");
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
      <div className="min-h-screen bg-white pb-16" aria-busy="true" role="status">
        <span className="sr-only">Loading agent profile…</span>
        <div className={`${PROFILE_PAGE} pt-5`}>
          <Skeleton className="h-4 w-36 rounded-md bg-neutral-100" />
          <div className="mt-6 flex flex-col gap-10 border-b border-neutral-100 pb-10 lg:grid lg:grid-cols-[280px_1fr_200px] lg:items-start lg:gap-12">
            <Skeleton className="mx-auto aspect-[4/5] min-h-[300px] w-full max-w-[300px] rounded-lg bg-neutral-100 lg:mx-0 lg:max-w-none" />
            <div className="min-w-0 flex-1 space-y-3 lg:flex lg:justify-between lg:gap-8">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 max-w-md rounded-md bg-neutral-100" />
                <Skeleton className="h-4 w-48 rounded-md bg-neutral-100" />
                <Skeleton className="h-4 w-56 rounded-md bg-neutral-100" />
                <Skeleton className="h-16 max-w-sm rounded-md bg-neutral-100" />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Skeleton className="h-9 w-[8.5rem] rounded-lg bg-neutral-100" />
                  <Skeleton className="h-9 w-[9rem] rounded-lg bg-neutral-100" />
                </div>
              </div>
              <Skeleton className="mx-auto h-20 w-[180px] rounded-xl bg-neutral-100 lg:mx-0" />
            </div>
          </div>
          <div className="mt-8 space-y-3 border-b border-neutral-200/90 py-8">
            <Skeleton className="h-3 w-20 rounded bg-neutral-100" />
            <Skeleton className="h-5 max-w-xs rounded-md bg-neutral-100" />
            <Skeleton className="h-20 max-w-2xl rounded-lg bg-neutral-100" />
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[220px] rounded-2xl bg-neutral-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-white px-5">
        <p className="text-center text-[13px] text-neutral-600">Agent not found.</p>
      </div>
    );
  }

  const activeSocials = socialIconMap.filter(
    (s) => agent.social_links?.[s.key as keyof typeof agent.social_links]
  );

  const profileContactRows = [
    agent.cell_phone && {
      icon: Phone,
      label: formatPhoneNumber(agent.cell_phone),
      sublabel: "Cell",
      href: `tel:${agent.cell_phone}`,
    },
    agent.office_phone && {
      icon: Phone,
      label: formatPhoneNumber(agent.office_phone),
      sublabel: "Office",
      href: `tel:${agent.office_phone}`,
    },
    agent.email && {
      icon: Mail,
      label: agent.email,
      sublabel: "Email",
      href: `mailto:${agent.email}`,
    },
  ].filter(Boolean) as {
    icon: typeof Phone;
    label: string;
    sublabel: string;
    href: string;
  }[];

  const websiteUrl = agent.social_links?.website
    ? agent.social_links.website.startsWith("http")
      ? agent.social_links.website
      : `https://${agent.social_links.website}`
    : null;

  const agentFullName = `${agent.first_name} ${agent.last_name}`;
  const agentProfileUrl = `${getPublicOrigin()}/agent/${agent.aac_id || agent.id}`;

  return (
    <div className="min-h-screen flex-1 bg-white">
      <Seo
        title={`${agentFullName} — ${agent.title || "Realtor"} at ${agent.company || "All Agent Connect"}`}
        description={agent.bio?.substring(0, 155) || `${agentFullName} is a real estate professional on All Agent Connect.`}
        image={agent.headshot_url || undefined}
        canonical={agentProfileUrl}
        type="profile"
        noindex={!publicMode}
        brandType={publicMode ? undefined : "aac"}
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
      <div className={PROFILE_PAGE}>
        <AacPageIntro
          withTopPadding
          back={
            <AacBackButton
              type="button"
              onClick={() => navigate(publicMode ? "/our-agents" : "/our-members")}
            />
          }
        />
      </div>

      {/* Hero */}
      <div className={`${PROFILE_PAGE} border-b border-neutral-100 pb-12 pt-4 md:pb-14 md:pt-6`}>
        <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)_minmax(200px,280px)] lg:items-start lg:gap-x-12 xl:gap-x-16">
          {/* Agent photo — editorial portrait frame */}
          <div className="relative mx-auto w-full max-w-[300px] shrink-0 sm:max-w-[340px] lg:mx-0 lg:w-full lg:max-w-none">
            <div className="aspect-[4/5] min-h-[min(72vw,420px)] w-full overflow-hidden rounded-lg border border-neutral-200/70 bg-[#fafafa] sm:min-h-[400px] lg:min-h-[440px]">
              {agent.headshot_url ? (
                <img
                  src={agent.headshot_url}
                  alt={`${agent.first_name} ${agent.last_name}`}
                  className="h-full w-full object-contain object-center"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-neutral-50">
                  <UserRound className="h-16 w-16 text-neutral-200" strokeWidth={1.25} aria-hidden />
                  <span className="mt-3 text-xs tracking-wide text-neutral-400">
                    {agent.first_name?.[0]}
                    {agent.last_name?.[0]}
                  </span>
                </div>
              )}
            </div>
            {isOnline ? (
              <span
                className="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white"
                aria-label="Online"
              />
            ) : null}
          </div>

          <div className="min-w-0 text-center lg:pt-2 lg:text-left">
            <h1 className="text-2xl font-medium tracking-tight text-neutral-900 md:text-[2rem] md:leading-[1.15]">
              {agent.first_name} {agent.last_name}
            </h1>
            {agent.title ? (
              <p className="mt-2 text-[15px] leading-relaxed text-neutral-500">{agent.title}</p>
            ) : null}
            {agent.company || agent.office_name || agent.aac_id ? (
              <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-500">
                {[agent.company || agent.office_name, agent.aac_id ? `AAC ${agent.aac_id}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}

            {(profileContactRows.length > 0 || websiteUrl) ? (
              <div className="mt-6 space-y-2 text-[14px] leading-relaxed">
                {profileContactRows.map((item, i) => (
                  <p key={i}>
                    <a
                      href={item.href}
                      className="inline-flex max-w-full items-start gap-2 text-neutral-800 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2"
                    >
                      <item.icon className="mt-1 h-3 w-3 shrink-0 text-neutral-300" aria-hidden />
                      <span>
                        <span className="text-neutral-400">{item.sublabel} </span>
                        {item.label}
                      </span>
                    </a>
                  </p>
                ))}
                {websiteUrl ? (
                  <p>
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-start gap-2 text-neutral-800 transition-colors hover:text-neutral-950"
                    >
                      <Globe className="mt-1 h-3 w-3 shrink-0 text-neutral-300" aria-hidden />
                      <span className="truncate">
                        {agent.social_links!.website!.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </span>
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-7 border-t border-neutral-100 pt-6">
              <div className="flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
                <ContactAgentProfileDialog
                  agentId={agent.id}
                  agentName={`${agent.first_name} ${agent.last_name}`}
                  agentEmail={agent.email}
                  buttonText={`Email ${agent.first_name}`}
                  triggerClassName="h-[34px] min-w-[7.75rem] rounded-md border border-neutral-800 bg-neutral-900 px-5 text-[13px] font-medium tracking-wide text-white hover:bg-neutral-800"
                />

                <Button
                  size="sm"
                  variant="outline"
                  className="h-[34px] min-w-[7.75rem] rounded-md border-neutral-200 bg-white px-5 text-[13px] font-medium tracking-wide text-neutral-800 hover:bg-neutral-50/80"
                  disabled={isStartingChat}
                  onClick={async () => {
                    if (!user?.id) {
                      navigate("/auth");
                      return;
                    }
                    if (!agent.id) return;
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
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-neutral-500" aria-hidden />
                  Message
                </Button>

                {activeSocials.length > 0 ? (
                  <>
                    <span
                      className="mx-0.5 hidden h-5 w-px bg-neutral-200 sm:inline"
                      aria-hidden
                    />
                    <div className="flex items-center gap-1">
                      {activeSocials.map(({ key, icon: Icon }) => (
                        <a
                          key={key}
                          href={agent.social_links![key as keyof typeof agent.social_links] as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2"
                          aria-label={key}
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {agent.logo_url ? (
            <div className="flex justify-center lg:justify-end lg:self-center">
              <div className="flex h-24 w-full max-w-[260px] items-center justify-center rounded-lg border border-neutral-200/70 bg-white px-6 py-5 lg:h-28 lg:w-[260px]">
                <img
                  src={agent.logo_url}
                  alt={agent.company || agent.office_name || "Brokerage logo"}
                  className="max-h-[4.5rem] max-w-full object-contain"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Content */}
      <div className={`${PROFILE_PAGE} pb-20`}>
        {/* About */}
        {agent.bio && (
          <section className={`${SECTION_RULE} ${SECTION_PAD}`}>
            <p className={EYEBROW}>About</p>
            <p className="mt-5 max-w-3xl whitespace-pre-wrap text-[16px] leading-[1.75] text-neutral-700">
              {agent.bio}
            </p>
          </section>
        )}

        {/* Testimonials */}
        {testimonials.length > 0 ? (
          <section className={`${SECTION_RULE} ${SECTION_PAD}`}>
            <p className={`${EYEBROW} text-center lg:text-left`}>Testimonials</p>
            <h2 className="mt-2 text-center text-lg font-medium tracking-tight text-neutral-900 lg:text-left">
              Client notes
            </h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {testimonials.slice(0, 6).map((testimonial) => (
                <article
                  key={testimonial.id}
                  className="flex flex-col rounded-lg border border-neutral-100 bg-white p-6 md:p-7"
                >
                  {testimonial.rating ? (
                    <div className="mb-4 flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${
                            i < testimonial.rating!
                              ? "fill-neutral-400 text-neutral-400"
                              : "text-neutral-200"
                          }`}
                          aria-hidden
                        />
                      ))}
                    </div>
                  ) : (
                    <Quote className="mb-4 h-4 w-4 text-neutral-200" aria-hidden />
                  )}
                  <p className="flex-1 text-[15px] leading-[1.65] text-neutral-600">
                    &ldquo;{testimonial.testimonial_text}&rdquo;
                  </p>
                  <footer className="mt-5 border-t border-neutral-50 pt-4">
                    <p className="text-[13px] font-medium text-neutral-900">{testimonial.client_name}</p>
                    {testimonial.client_title ? (
                      <p className="mt-0.5 text-[12px] text-neutral-400">{testimonial.client_title}</p>
                    ) : null}
                  </footer>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {/* Listings */}
        <section className={`${SECTION_RULE} ${SECTION_PAD}`}>
          <p className={`${EYEBROW} text-center lg:text-left`}>Listings</p>
          <h2 className="mt-2 text-center text-lg font-medium tracking-tight text-neutral-900 lg:text-left">
            Active listings
          </h2>
          <div className="mt-8">

          {listings.length === 0 ? (
            <p className="text-center text-[13px] text-neutral-600">
              No active listings right now.{" "}
              <button
                type="button"
                onClick={() => navigate(publicMode ? "/browse" : "/listing-search")}
                className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 transition-colors hover:decoration-neutral-900"
              >
                Browse all listings
              </button>
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5">
              {listings.map((listing) => (
                <div key={listing.id} className="min-w-0 max-w-full">
                  <ListingCard
                    listing={mapMarketRowToListingCard({
                      id: listing.id,
                      address: listing.address,
                      city: listing.city,
                      state: listing.state,
                      zip_code: listing.zip_code,
                      price: listing.price,
                      listing_type: listing.listing_type,
                      price_range_min: listing.price_range_min,
                      price_range_max: listing.price_range_max,
                      property_type: listing.property_type,
                      bedrooms: listing.bedrooms,
                      bathrooms: listing.bathrooms,
                      square_feet: listing.square_feet,
                      photos: listing.photos,
                      status: listing.status,
                      created_at: listing.created_at,
                      active_date: listing.active_date,
                      listing_number: listing.listing_number,
                      agent_id: listing.agent_id,
                      neighborhood: listing.neighborhood,
                      unit_number: listing.unit_number,
                      condo_details: listing.condo_details,
                      brokerage: agent?.company?.trim() || agent?.office_name?.trim() || undefined,
                    })}
                    viewMode="compact"
                    showActions={false}
                    compactAgentOwned
                    compactShowNeighborhood
                    hideMlsMeta={publicMode}
                    showAgentEmailContact={showListingAgentEmail}
                    listingAgentContact={profileListingAgentContact}
                    listingEmailSubject={listingEmailSubjectFromRow(listing)}
                  />
                </div>
              ))}
            </div>
          )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AgentProfile;

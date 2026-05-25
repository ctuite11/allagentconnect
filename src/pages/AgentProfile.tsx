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
        <div className="mx-auto max-w-6xl px-5 pt-5 md:px-8">
          <Skeleton className="h-4 w-36 rounded-md bg-neutral-100" />
          <div className="mt-6 flex flex-col gap-8 border-b border-neutral-200/90 pb-8 lg:flex-row lg:items-start">
            <Skeleton className="mx-auto aspect-[3/4] w-[200px] shrink-0 rounded-xl bg-neutral-100 sm:mx-0 md:w-[240px]" />
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
      <div className="mx-auto max-w-6xl px-5 md:px-8">
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
      <div className="mx-auto max-w-6xl border-b border-neutral-200/90 px-5 pb-8 pt-6 md:px-8 md:pb-10 md:pt-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
          {/* Agent photo — portrait-friendly for headshot, full-body, or team */}
          <div className="relative mx-auto w-full max-w-[220px] shrink-0 sm:mx-0 sm:w-[200px] md:w-[240px]">
            <div className="aspect-[3/4] w-full overflow-hidden rounded-xl border border-neutral-200/90 bg-neutral-50 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              {agent.headshot_url ? (
                <img
                  src={agent.headshot_url}
                  alt={`${agent.first_name} ${agent.last_name}`}
                  className="h-full w-full object-contain object-center"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-neutral-100">
                  <UserRound className="h-14 w-14 text-neutral-300" strokeWidth={1.25} aria-hidden />
                  <span className="mt-2 text-xs font-semibold tracking-tight text-neutral-500">
                    {agent.first_name?.[0]}
                    {agent.last_name?.[0]}
                  </span>
                </div>
              )}
            </div>
            {isOnline ? (
              <span
                className="absolute bottom-2 right-2 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                aria-label="Online"
              />
            ) : null}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900 md:text-[1.65rem] md:leading-tight">
                {agent.first_name} {agent.last_name}
              </h1>
              {agent.title ? (
                <p className="mt-1.5 text-[15px] leading-snug text-neutral-600">{agent.title}</p>
              ) : null}
              {agent.company || agent.office_name || agent.aac_id ? (
                <p className="mt-1 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-[13px] text-neutral-500 sm:justify-start">
                  {(agent.company || agent.office_name) ? (
                    <span>{agent.company || agent.office_name}</span>
                  ) : null}
                  {(agent.company || agent.office_name) && agent.aac_id ? (
                    <span className="text-neutral-300">·</span>
                  ) : null}
                  {agent.aac_id ? (
                    <span className="font-mono text-xs text-neutral-400">{agent.aac_id}</span>
                  ) : null}
                </p>
              ) : null}

              {profileContactRows.length > 0 ? (
                <ul className="mt-5 space-y-2">
                  {profileContactRows.map((item, i) => (
                    <li key={i}>
                      <a
                        href={item.href}
                        className="inline-flex max-w-full items-center gap-2 rounded-sm text-[13px] text-neutral-700 outline-none transition-colors hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2 sm:max-w-none"
                      >
                        <item.icon className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                        <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                          {item.sublabel}
                        </span>
                        <span className="min-w-0 truncate font-normal">{item.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}

              {websiteUrl ? (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-neutral-600 transition-colors hover:text-neutral-900"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                  <span className="truncate">
                    {agent.social_links!.website!.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </span>
                </a>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <ContactAgentProfileDialog
                  agentId={agent.id}
                  agentName={`${agent.first_name} ${agent.last_name}`}
                  agentEmail={agent.email}
                  buttonText={`Email ${agent.first_name}`}
                  triggerClassName="h-9 rounded-lg border border-neutral-800 bg-neutral-900 px-4 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-neutral-800"
                />

                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-lg border-neutral-200 bg-white px-4 text-[13px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50"
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
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Message
                </Button>
              </div>

              {activeSocials.length > 0 ? (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                  {activeSocials.map(({ key, icon: Icon }) => (
                    <a
                      key={key}
                      href={agent.social_links![key as keyof typeof agent.social_links] as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200/90 bg-white text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2"
                      aria-label={key}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            {agent.logo_url ? (
              <div className="flex shrink-0 justify-center lg:justify-end lg:pt-1">
                <div className="flex h-[72px] w-[min(100%,220px)] items-center justify-center rounded-xl border border-neutral-200/90 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:h-20 lg:w-[200px]">
                  <img
                    src={agent.logo_url}
                    alt={agent.company || agent.office_name || "Brokerage logo"}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-2 md:px-8">
        {/* About */}
        {agent.bio && (
          <section className="border-t border-neutral-200/90 py-8 md:py-10">
            <div className="grid gap-6 md:grid-cols-[minmax(0,11rem)_1fr] md:gap-10">
              <div className="md:pt-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">About</p>
                <h2 className="mt-1 text-base font-semibold leading-snug tracking-tight text-neutral-900">
                  About {agent.first_name}
                </h2>
              </div>
              <p className="max-w-2xl whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-700">{agent.bio}</p>
            </div>
          </section>
        )}

        {/* Testimonials */}
        {testimonials.length > 0 ? (
          <section className="border-t border-neutral-200/90 py-8 md:py-10">
            <div className="mb-6 text-center md:mb-8 md:text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Testimonials</p>
              <h2 className="mt-1 text-base font-semibold tracking-tight text-neutral-900 md:text-lg">
                What clients say
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.slice(0, 6).map((testimonial) => (
                <div
                  key={testimonial.id}
                  className="relative rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[box-shadow,border-color] hover:border-neutral-300/90 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
                >
                  <Quote className="mb-3 h-5 w-5 text-neutral-200" aria-hidden />
                  {testimonial.rating ? (
                    <div className="mb-3 flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < testimonial.rating!
                              ? "fill-amber-500 text-amber-500"
                              : "text-neutral-200"
                          }`}
                          aria-hidden
                        />
                      ))}
                    </div>
                  ) : null}
                  <p className="text-[14px] leading-relaxed text-neutral-600">&ldquo;{testimonial.testimonial_text}&rdquo;</p>
                  <p className="mt-3 text-[13px] font-semibold text-neutral-900">— {testimonial.client_name}</p>
                  {testimonial.client_title ? (
                    <p className="text-xs text-neutral-500">{testimonial.client_title}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Listings */}
        <section className="border-t border-neutral-200/90 py-8 md:py-10">
          <div className="mb-6 text-center md:mb-8 md:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Listings</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-neutral-900 md:text-lg">Active listings</h2>
          </div>

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
        </section>
      </div>
    </div>
  );
};

export default AgentProfile;

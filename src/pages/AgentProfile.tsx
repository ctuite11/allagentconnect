import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
  MessageSquare,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import ContactAgentProfileDialog from "@/components/ContactAgentProfileDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentLastSeen } from "@/hooks/useAgentLastSeen";
import { findOrCreateConversation } from "@/lib/startConversation";
import { messagesPathForRole } from "@/lib/messageNavigation";
import { useAuthRole } from "@/hooks/useAuthRole";
import { Seo } from "@/components/Seo";
import { getPublicOrigin } from "@/lib/getPublicUrl";
import { AgentOnlinePresenceBadge } from "@/components/ui/AgentOnlinePresenceBadge";
import { cn } from "@/lib/utils";
import {
  getCurrentSenderProfile,
  type SenderProfile,
} from "@/lib/currentSenderProfile";

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
const SECTION_PAD = "py-9 md:py-11";
const LISTINGS_SECTION = "border-t border-neutral-100 pt-14 pb-10 md:pt-16 md:pb-12";
const EYEBROW = "text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400";

type ProfileSocialBrand = "linkedin" | "facebook" | "instagram" | "twitter";

const PROFILE_INSTAGRAM_GRADIENT_ID = "aac-profile-ig-gradient";

/** Filled platform marks (~28px) — blue square, blue circle, gradient square, black X */
function ProfileSocialBrandIcon({ brand }: { brand: ProfileSocialBrand }) {
  return (
    <svg
      className="block h-[28px] w-[28px] shrink-0"
      viewBox="0 0 28 28"
      aria-hidden
    >
      {brand === "linkedin" ? (
        <>
          <rect width="28" height="28" rx="5" fill="#0A66C2" />
          <path
            fill="#fff"
            d="M9.2 11.4h2.3v9.2H9.2V11.4zm1.15-4.6a1.35 1.35 0 110 2.7 1.35 1.35 0 010-2.7M14.5 11.4h2.2v1.3h.03c.4-.75 1.4-1.55 2.9-1.55 3.1 0 3.7 2 3.7 4.7v4.3h-2.3v-4.2c0-1.25-.02-2.85-1.75-2.85-1.75 0-2 1.35-2 2.75v4.3h-2.3V11.4z"
          />
        </>
      ) : null}
      {brand === "facebook" ? (
        <>
          <circle cx="14" cy="14" r="14" fill="#1877F2" />
          <path
            fill="#fff"
            d="M17.9 9.2h-2.1c-1.6 0-2.1.95-2.1 2.35v2.45H11.5v2.8h2.2v7.25h2.85v-7.25h2.5l.35-2.8h-2.85v-2.1c0-.75.2-1.15 1.2-1.15h1.65V9.2z"
          />
        </>
      ) : null}
      {brand === "instagram" ? (
        <>
          <defs>
            <linearGradient
              id={PROFILE_INSTAGRAM_GRADIENT_ID}
              x1="0%"
              y1="100%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#833AB4" />
              <stop offset="50%" stopColor="#FD1D1D" />
              <stop offset="100%" stopColor="#FCAF45" />
            </linearGradient>
          </defs>
          <rect width="28" height="28" rx="7" fill={`url(#${PROFILE_INSTAGRAM_GRADIENT_ID})`} />
          <rect x="7.5" y="7.5" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.75" />
          <circle cx="21" cy="7" r="1.35" fill="#fff" />
          <circle cx="14" cy="14" r="3.25" fill="none" stroke="#fff" strokeWidth="1.75" />
        </>
      ) : null}
      {brand === "twitter" ? (
        <path
          fill="#14171A"
          d="M16.2 8.5h2.6l-5.7 6.5 6.7 8.8h-5.2l-4.1-5.4-4.7 5.4H7.1l6.1-7-6.6-8.3h5.3l3.7 4.9 4.3-4.9zm-1.4 15.1h1.4L10.2 10.2H8.7l6.1 13.4z"
        />
      ) : null}
    </svg>
  );
}

const socialIconMap = [
  { key: "linkedin", brand: "linkedin" as const },
  { key: "facebook", brand: "facebook" as const },
  { key: "instagram", brand: "instagram" as const },
  { key: "twitter", brand: "twitter" as const },
] as const;

interface AgentProfileProps {
  publicMode?: boolean;
}

const AgentProfile = ({ publicMode = false }: AgentProfileProps) => {
  const { id: idOrCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo =
    ((location.state as any)?.from as string | undefined) ??
    (publicMode ? "/our-agents" : "/our-members");
  /**
   * Restore the origin state the referring page handed us (e.g. a listing's own
   * `from` = search results) and mark the return so the listing never uses
   * browser-history back, which would bounce straight back into this profile.
   */
  const goBack = () => {
    const profileState = location.state as {
      from?: string;
      fromState?: Record<string, unknown> | null;
    } | null;
    navigate(backTo, {
      state: {
        ...(profileState?.fromState ?? {}),
        returnedFromAgentProfile: true,
      },
    });
  };
  const { user, role } = useAuthRole();
  const [agent, setAgent] = useState<AgentProfileData | null>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [viewerSender, setViewerSender] = useState<SenderProfile | null>(null);
  const { isOnline } = useAgentLastSeen(agent?.id);

  useEffect(() => {
    if (!user?.id) {
      setViewerSender(null);
      return;
    }
    let cancelled = false;
    void getCurrentSenderProfile({ source: "auto" }).then((sender) => {
      if (!cancelled) setViewerSender(sender);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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

      // Anonymous callers cannot read PII columns (email, phone, cell_phone,
      // office_phone, office_address) — column-level GRANTs on agent_profiles.
      // Use an explicit safe-column list when there is no session; keep the
      // full profile for authenticated viewers.
      const { data: sessionData } = await supabase.auth.getSession();
      const isAuthed = Boolean(sessionData.session);

      const agentQuery = isAuthed
        ? supabase
            .from("agent_profiles")
            .select(`
              *,
              agent_county_preferences ( county_id, counties (name, state) )
            `)
            .eq(filterCol, idOrCode)
            .maybeSingle()
        : supabase
            .from("agent_profiles")
            .select(`
              id, aac_id, first_name, last_name, title, company, office_name, team_name,
              bio, social_links, buyer_incentives, seller_incentives, headshot_url,
              logo_url, header_background_type, header_background_value, header_image_url,
              office_city, office_state,
              created_at, updated_at,
              agent_county_preferences ( county_id, counties (name, state) )
            `)
            .eq(filterCol, idOrCode)
            .maybeSingle();

      const { data: agentData, error: agentError } = await agentQuery;

      if (agentError) throw agentError;
      if (!agentData) {
        toast.error("Agent not found");
        goBack();
        return;
      }

      setAgent(agentData as unknown as AgentProfileData);

      const agentUuid = agentData.id;

      const { data: listingsData, error: listingsError } = await supabase
        .from("listings")
        .select("*")
        .eq("agent_id", agentUuid)
        .in("status", ["active", "coming_soon", "off_market", "sold", "rented"])
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
          <div className="mt-6 flex flex-col gap-6 border-b border-neutral-100 pb-10 lg:grid lg:grid-cols-[280px_1fr] lg:items-start lg:gap-8">
            <Skeleton className="mx-auto h-[360px] w-full max-w-[300px] rounded-lg bg-neutral-100 lg:mx-0 lg:max-w-none" />
            <div className="min-w-0 space-y-3 lg:flex lg:gap-8">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 max-w-md rounded-md bg-neutral-100" />
                <Skeleton className="h-4 w-48 rounded-md bg-neutral-100" />
                <Skeleton className="h-12 max-w-sm rounded-md bg-neutral-100" />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Skeleton className="h-9 w-[8.5rem] rounded-lg bg-neutral-100" />
                  <Skeleton className="h-9 w-[9rem] rounded-lg bg-neutral-100" />
                </div>
              </div>
              <Skeleton className="mx-auto h-14 w-32 rounded bg-neutral-100 lg:mx-0" />
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

  const activeSocials = socialIconMap.filter((s) => {
    const url = agent.social_links?.[s.key as keyof typeof agent.social_links];
    return typeof url === "string" && url.trim().length > 0;
  });

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
              onClick={goBack}
            />
          }
        />
      </div>

      {/* Hero — photo + composed identity band */}
      <div className={`${PROFILE_PAGE} border-b border-neutral-100 pb-10 pt-4 md:pb-12 md:pt-6`}>
        <div className="flex flex-col gap-6 sm:gap-7 lg:grid lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)] lg:items-start lg:gap-8 xl:gap-10">
          {/* Photo — height follows image; object-top reduces dead space below */}
          <div className="mx-auto w-full max-w-[300px] shrink-0 sm:max-w-[320px] lg:mx-0 lg:max-w-none">
            <div className="overflow-hidden rounded-lg border border-neutral-200/60 bg-neutral-50/40">
              {agent.headshot_url ? (
                <img
                  src={agent.headshot_url}
                  alt={`${agent.first_name} ${agent.last_name}`}
                  className="block w-full max-h-[min(68vw,480px)] object-contain object-top lg:max-h-[500px]"
                />
              ) : (
                <div className="flex aspect-[4/5] min-h-[280px] w-full flex-col items-center justify-center">
                  <UserRound className="h-16 w-16 text-neutral-200" strokeWidth={1.25} aria-hidden />
                  <span className="mt-3 text-xs tracking-wide text-neutral-400">
                    {agent.first_name?.[0]}
                    {agent.last_name?.[0]}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-0 lg:flex-row lg:items-start lg:gap-8 xl:gap-10">
            <div className="min-w-0 flex-1 text-center lg:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                <h1 className="text-2xl font-medium tracking-tight text-neutral-900 md:text-[2rem] md:leading-[1.15]">
                  {agent.first_name} {agent.last_name}
                </h1>
                {isOnline ? <AgentOnlinePresenceBadge /> : null}
              </div>
              {agent.title ? (
                <p className="mt-1.5 text-[15px] leading-tight text-neutral-500">{agent.title}</p>
              ) : null}
              {agent.company || agent.office_name || agent.aac_id ? (
                <p className="mt-1 text-[14px] leading-tight text-neutral-500">
                  {[agent.company || agent.office_name, agent.aac_id ? `AAC ${agent.aac_id}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}

              {(profileContactRows.length > 0 || websiteUrl || agent.email) ? (
                <ul className="mt-4 space-y-1 text-[14px]">
                  {profileContactRows.map((item, i) => (
                    <li key={i}>
                      <a
                        href={item.href}
                        className="inline-flex max-w-full items-center gap-2.5 leading-tight text-neutral-800 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2"
                      >
                        <item.icon className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                        <span>
                          <span className="text-neutral-400">{item.sublabel} </span>
                          {item.label}
                        </span>
                      </a>
                    </li>
                  ))}
                  {agent.email ? (
                    <li>
                      <ContactAgentProfileDialog
                        agentId={agent.id}
                        agentName={`${agent.first_name} ${agent.last_name}`}
                        agentEmail={agent.email}
                        initialSender={viewerSender}
                        trigger={
                          <button
                            type="button"
                            className="inline-flex max-w-full items-center gap-2.5 leading-tight text-neutral-800 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2"
                          >
                            <Mail className="h-3.5 w-3.5 shrink-0 text-aac" aria-hidden />
                            <span>
                              {agent.email}
                            </span>
                          </button>
                        }
                      />
                    </li>
                  ) : null}
                  {websiteUrl ? (
                    <li>
                      <a
                        href={websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-2.5 leading-tight text-neutral-800 transition-colors hover:text-neutral-950"
                      >
                        <Globe className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                        <span className="truncate">
                          {agent.social_links!.website!.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </span>
                      </a>
                    </li>
                  ) : null}
                </ul>
              ) : null}

              <div className="relative z-[60] mt-4 border-t border-neutral-100 pt-4">
                <div className="flex w-full flex-col items-center gap-2 lg:w-auto lg:items-start">
                <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                  {(() => {
                    const isGuestOrPublic = !user || publicMode;
                    const authedHandler = async () => {
                      if (!user?.id || !agent.id) return;
                      setIsStartingChat(true);
                      try {
                        const convoId = await findOrCreateConversation(user.id, agent.id);
                        if (convoId) navigate(messagesPathForRole(convoId, role));
                      } catch (e) {
                        toast.error("Could not start conversation");
                      } finally {
                        setIsStartingChat(false);
                      }
                    };
                    const messageButton = (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-[34px] min-w-[7.75rem] rounded-md border border-neutral-900 bg-neutral-900 px-5 text-[13px] font-medium tracking-wide text-white hover:bg-neutral-800"
                        disabled={!!user && isStartingChat}
                        onClick={isGuestOrPublic ? undefined : authedHandler}
                      >
                        <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-white" aria-hidden />
                        Message {agent.first_name}
                      </Button>
                    );
                    return isGuestOrPublic && agent.email ? (
                      <ContactAgentProfileDialog
                        agentId={agent.id}
                        agentName={agentFullName}
                        agentEmail={agent.email}
                        initialSender={viewerSender}
                        trigger={messageButton}
                      />
                    ) : (
                      messageButton
                    );
                  })()}
                </div>

                {activeSocials.length > 0 ? (
                  <div
                    className="flex items-center gap-3 self-center lg:self-start"
                    aria-label="Social profiles"
                  >
                    {activeSocials.map(({ key, brand }) => (
                      <a
                        key={key}
                        href={agent.social_links![key as keyof typeof agent.social_links] as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center transition-opacity duration-150 hover:opacity-85 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-300 focus-visible:ring-offset-2"
                        aria-label={key}
                      >
                        <ProfileSocialBrandIcon brand={brand} />
                      </a>
                    ))}
                  </div>
                ) : null}
                </div>
              </div>
            </div>

            {agent.logo_url ? (
              <div className="mt-6 flex shrink-0 justify-center border-t border-neutral-100 pt-6 lg:mt-0 lg:w-[min(100%,360px)] lg:self-stretch lg:flex lg:items-center lg:justify-center lg:border-t-0 lg:pl-8 lg:pt-0 xl:pl-10">
                <img
                  src={agent.logo_url}
                  alt={agent.company || agent.office_name || "Brokerage logo"}
                  className="max-h-[5.5rem] w-auto max-w-[320px] object-contain lg:max-h-[7rem] lg:max-w-[340px]"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`${PROFILE_PAGE} pb-20`}>
        {/* About + testimonials sidebar */}
        {(agent.bio || testimonials.length > 0) ? (
          <section className={`${SECTION_RULE} ${SECTION_PAD}`}>
            <div
              className={cn(
                "flex flex-col gap-8",
                agent.bio && testimonials.length > 0 && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(220px,300px)] lg:items-start lg:gap-x-12 xl:gap-x-16",
              )}
            >
              {agent.bio ? (
                <div className="min-w-0">
                  <p className={EYEBROW}>About</p>
                  <p className="mt-4 max-w-3xl whitespace-pre-wrap text-[16px] leading-[1.75] text-neutral-700">
                    {agent.bio}
                  </p>
                </div>
              ) : null}

              {testimonials.length > 0 ? (
                <aside
                  className={cn(
                    "min-w-0 lg:pt-0",
                    agent.bio && "lg:border-l lg:border-neutral-100/80 lg:pl-9 xl:pl-11",
                  )}
                >
                  <p className={EYEBROW}>Testimonials</p>
                  <div className="mt-4 flex flex-col gap-3">
                    {testimonials.slice(0, 6).map((testimonial) => (
                      <article
                        key={testimonial.id}
                        className="rounded-lg border border-neutral-100 bg-white px-4 py-4"
                      >
                        {testimonial.rating ? (
                          <div className="mb-2.5 flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-2.5 w-2.5 ${
                                  i < testimonial.rating!
                                    ? "fill-neutral-400 text-neutral-400"
                                    : "text-neutral-200"
                                }`}
                                aria-hidden
                              />
                            ))}
                          </div>
                        ) : (
                          <Quote className="mb-2.5 h-3.5 w-3.5 text-neutral-200" aria-hidden />
                        )}
                        <p className="text-[13px] leading-[1.6] text-neutral-600">
                          &ldquo;{testimonial.testimonial_text}&rdquo;
                        </p>
                        <footer className="mt-3 border-t border-neutral-50 pt-3">
                          <p className="text-[12px] font-medium text-neutral-900">{testimonial.client_name}</p>
                          {testimonial.client_title ? (
                            <p className="mt-0.5 text-[11px] text-neutral-400">{testimonial.client_title}</p>
                          ) : null}
                        </footer>
                      </article>
                    ))}
                  </div>
                </aside>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Listings */}
        <section className={LISTINGS_SECTION}>
          <p className={EYEBROW}>Listings</p>
          <h2 className="mt-3 text-lg font-medium tracking-tight text-neutral-900 md:text-xl">
            Current listings
          </h2>
          <div className="mt-10 md:mt-11">

          {listings.length === 0 ? (
            <p className="text-center text-[13px] text-neutral-600">
              No current listings right now.{" "}
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
                    compactDetailNavigateState={{ from: location.pathname + location.search }}
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

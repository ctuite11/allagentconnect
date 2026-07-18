import { useState, useEffect, useMemo } from "react";
import { useAgentPresenceBatch } from "@/hooks/useAgentLastSeen";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AgentPhotoTile from "@/components/agent-directory/AgentPhotoTile";
import AgentDirectoryFilters from "@/components/agent-directory/AgentDirectoryFilters";
import type { AgentDirectoryPageSize } from "@/components/agent-directory/AgentDirectoryFilters";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormattedInput } from "@/components/ui/formatted-input";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentSenderProfile } from "@/lib/currentSenderProfile";
import { z } from "zod";
import { PageHeader } from "@/components/ui/page-header";
import { LISTING_STATUS } from "@/constants/status";
import { Seo } from "@/components/Seo";
import { AgentNetworkIntroOverlay } from "@/components/agent-directory/AgentNetworkIntroOverlay";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useAgentNetworkIntro } from "@/hooks/useAgentNetworkIntro";
import {
  AGENT_NETWORK_DB_FILTERS,
  isVisibleInAgentNetwork,
} from "@/lib/agentNetworkVisibility";
import { matchesAgentName } from "@/lib/agentNameSearch";
import LocationAutocomplete, { type SelectedLocation } from "@/components/agent-directory/LocationAutocomplete";

interface EnrichedAgent {
  id: string;
  aac_id: string;
  first_name: string;
  last_name: string;
  title?: string;
  company?: string;
  email: string;
  phone?: string;
  cell_phone?: string;
  headshot_url?: string;
  office_name?: string;
  team_name?: string;
  buyer_incentives?: string;
  updated_at?: string;
  activeListingsCount: number;
  comingSoonCount: number;
  offMarketCount: number;
  last12MonthsSales: number;
  buyerMatchCount: number;
  serviceAreas: string[];
  specialties: string[];
}

const DEFAULT_PAGE_SIZE: AgentDirectoryPageSize = 24;

interface County {
  id: string;
  name: string;
  state: string;
}

interface OurAgentsProps {
  defaultAgentMode?: boolean;
  isPublicMode?: boolean;
  isAgentMode?: boolean;
  isBuyerMode?: boolean;
}

const OurAgents = ({
  defaultAgentMode = false,
  isPublicMode = false,
  isAgentMode = false,
  isBuyerMode = false,
}: OurAgentsProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthRole();
  const effectiveAgentMode = isAgentMode || defaultAgentMode;
  const {
    visible: showAgentNetworkIntro,
    handleLater: handleAgentNetworkIntroLater,
    handleSeeProfile: dismissAgentNetworkIntroForSee,
    handleUpdateProfile: dismissAgentNetworkIntroForUpdate,
  } = useAgentNetworkIntro(user, { enabled: effectiveAgentMode });

  const [agents, setAgents] = useState<EnrichedAgent[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [showBuyerIncentivesOnly, setShowBuyerIncentivesOnly] = useState(false);
  const [showListingAgentsOnly, setShowListingAgentsOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<"a-z" | "z-a">("a-z");
  
  const effectivePublicMode = isPublicMode || !effectiveAgentMode;
  
  // Message dialog
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageAgent, setMessageAgent] = useState<EnrichedAgent | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState<AgentDirectoryPageSize>(DEFAULT_PAGE_SIZE);

  // Page titles based on mode
  const pageTitle = effectiveAgentMode ? "AAC Referral Network" : "Find an Agent";
  const pageSubtitle = effectiveAgentMode 
    ? "A private network of vetted agents for referrals, introductions, and trusted collaboration."
    : "Browse experienced local agents and open a profile to learn more about who you want to work with.";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Step 1: Get verified agent IDs via SECURITY DEFINER RPC (bypasses agent_settings RLS safely)
      const { data: verifiedRows, error: verifiedError } = await supabase
        .rpc("get_verified_agent_ids");

      if (verifiedError) throw verifiedError;

      const verifiedIds = (verifiedRows || []).map(r => r.user_id);

      // If no verified agents, set empty state and return early
      if (verifiedIds.length === 0) {
        setAgents([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      const countiesPromise = supabase
        .from("counties")
        .select("*")
        .order("state", { ascending: true })
        .order("name", { ascending: true });

      // Fetch the full profile for every visible verified agent so search/filters
      // operate on the entire network — not just the current page.
      const agentQuery = supabase
        .from("agent_profiles")
        .select(`
          id, aac_id, first_name, last_name, company, office_name, team_name, headshot_url, buyer_incentives, updated_at, title, email, phone, cell_phone,
          agent_county_preferences(
            county_id,
            counties(name, state)
          ),
          agent_buyer_coverage_areas(city, state, county)
        `)
        .in("id", verifiedIds);
      const { data: agentData, error: agentError } = await AGENT_NETWORK_DB_FILTERS(agentQuery as any);

      if (agentError) throw agentError;

      const orderedAgentData = (agentData || [])
        .filter(isVisibleInAgentNetwork)
        .sort((a: any, b: any) => {
          const byLast = (a.last_name || "").localeCompare(b.last_name || "");
          return byLast !== 0 ? byLast : (a.first_name || "").localeCompare(b.first_name || "");
        });

      // Fetch listings for all agents to get counts
      const [{ data: listingsData, error: listingsError }, { data: countyData, error: countyError }] =
        await Promise.all([
          supabase
            .from("listings")
            .select("agent_id, status, property_type, created_at")
            .in("status", ["active", "coming_soon", "off_market", "sold"]),
          countiesPromise,
        ]);

      if (listingsError) throw listingsError;
      if (countyError) throw countyError;

      // Calculate 12 months ago
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      // Enrich agent data with listing counts and derived data
      const enrichedAgents: EnrichedAgent[] = orderedAgentData
        .filter(isVisibleInAgentNetwork)
        .map((agent: any) => {
        const agentListings = (listingsData || []).filter(l => l.agent_id === agent.id);
        
        // Count by status
        const activeListingsCount = agentListings.filter(l => l.status === LISTING_STATUS.ACTIVE).length;
        const comingSoonCount = agentListings.filter(l => l.status === LISTING_STATUS.COMING_SOON).length;
        const offMarketCount = agentListings.filter(l => l.status === LISTING_STATUS.OFF_MARKET).length;
        
        // Sales in last 12 months
        const last12MonthsSales = agentListings.filter(l => 
          l.status === LISTING_STATUS.SOLD && 
          new Date(l.created_at) >= twelveMonthsAgo
        ).length;

        // Extract service areas from county preferences
        const serviceAreas: string[] = [];
        if (agent.agent_county_preferences) {
          agent.agent_county_preferences.forEach((pref: any) => {
            if (pref.counties) {
              serviceAreas.push(`${pref.counties.name}, ${pref.counties.state}`);
            }
          });
        }
        
        // Also add coverage areas
        if (agent.agent_buyer_coverage_areas) {
          agent.agent_buyer_coverage_areas.forEach((area: any) => {
            if (area.city && area.state) {
              const areaStr = `${area.city}, ${area.state}`;
              if (!serviceAreas.includes(areaStr)) {
                serviceAreas.push(areaStr);
              }
            }
          });
        }

        // Derive specialties from property types in listings
        const propertyTypeCounts: Record<string, number> = {};
        agentListings.forEach(l => {
          if (l.property_type) {
            propertyTypeCounts[l.property_type] = (propertyTypeCounts[l.property_type] || 0) + 1;
          }
        });
        const specialties = Object.entries(propertyTypeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([type]) => type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));

        return {
          id: agent.id,
          aac_id: agent.aac_id,
          first_name: agent.first_name,
          last_name: agent.last_name,
          title: agent.title,
          company: agent.company,
          email: agent.email,
          phone: agent.phone,
          cell_phone: agent.cell_phone,
          headshot_url: agent.headshot_url,
          office_name: agent.office_name,
          team_name: agent.team_name,
          buyer_incentives: agent.buyer_incentives,
          updated_at: agent.updated_at,
          activeListingsCount,
          comingSoonCount,
          offMarketCount,
          last12MonthsSales,
          buyerMatchCount: 0,
          serviceAreas,
          specialties,
        };
      });

      setAgents(enrichedAgents);
      setTotalCount(enrichedAgents.length);
      setCounties(countyData || []);
    } catch (error: any) {
      console.error("Error loading agents:", error);
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  // Get unique states from counties
  const states = useMemo(() => {
    const stateSet = new Set(counties.map(c => c.state));
    return Array.from(stateSet).sort();
  }, [counties]);

/** Sub-component that wraps the grid with batch presence */
function AgentPhotoTileGrid({
  agents,
  onViewProfile,
  hideDirectContact = false,
  showPresence = false,
}: {
  agents: EnrichedAgent[];
  onViewProfile: (id: string) => void;
  hideDirectContact?: boolean;
  showPresence?: boolean;
}) {
  const userIds = useMemo(() => (showPresence ? agents.map((a) => a.id) : []), [agents, showPresence]);
  const presenceMap = useAgentPresenceBatch(userIds);

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 md:gap-x-8 lg:grid-cols-4 lg:gap-y-10">
      {agents.map((agent) => (
        <AgentPhotoTile
          key={agent.id}
          agent={agent}
          onClick={onViewProfile}
          showPresenceBadge={showPresence}
          isOnline={showPresence ? presenceMap.get(agent.id)?.isOnline === true : false}
          hideDirectContact={hideDirectContact}
        />
      ))}
    </div>
  );
}

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    let result = agents.filter(isVisibleInAgentNetwork);

    // Visible-field text search only (name, brokerage, email, phone).
    if (searchQuery.trim()) {
      result = result.filter((agent) => matchesAgentName(agent, searchQuery));
    }

    // Location filter — Google Places selection matched against service areas
    if (selectedLocation) {
      const loc = selectedLocation;
      const city = loc.city?.toLowerCase().trim();
      const stateShort = loc.stateShort?.toUpperCase().trim();
      const stateLong = loc.state?.toLowerCase().trim();
      const county = loc.county?.toLowerCase().trim();
      const formatted = loc.formatted?.toLowerCase().trim();

      result = result.filter((agent) => {
        const areas = (agent.serviceAreas || []).map((a) => a.toLowerCase());
        if (areas.length === 0) return false;

        if (city && areas.some((a) => a.includes(city))) return true;
        if (county && areas.some((a) => a.includes(county))) return true;
        if (stateShort && areas.some((a) => a.endsWith(`, ${stateShort.toLowerCase()}`))) return true;
        if (stateLong && areas.some((a) => a.includes(stateLong))) return true;
        if (!city && !county && !stateShort && !stateLong && formatted) {
          return areas.some((a) => a.includes(formatted));
        }
        return false;
      });
    }

    // State filter (check service areas)
    if (selectedState) {
      result = result.filter(agent =>
        agent.serviceAreas.some(area => area.includes(`, ${selectedState}`))
      );
    }

    // County filter
    if (selectedCounties.length > 0) {
      const selectedCountyNames = counties
        .filter(c => selectedCounties.includes(c.id))
        .map(c => `${c.name}, ${c.state}`);
      
      result = result.filter(agent =>
        agent.serviceAreas.some(area => selectedCountyNames.includes(area))
      );
    }

    // Buyer incentives filter
    if (showBuyerIncentivesOnly) {
      result = result.filter(agent => agent.buyer_incentives && agent.buyer_incentives.trim() !== "");
    }

    // Has listings filter
    if (showListingAgentsOnly) {
      result = result.filter(agent => agent.activeListingsCount > 0);
    }

    // Sort by last name
    if (sortOrder === "a-z") {
      result.sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));
    } else {
      result.sort((a, b) => (b.last_name || "").localeCompare(a.last_name || ""));
    }

    return result;
  }, [agents, searchQuery, selectedState, selectedCounties, selectedLocation, counties, showBuyerIncentivesOnly, showListingAgentsOnly, sortOrder]);

  // Keep header count + pager in sync with the filtered set.
  useEffect(() => {
    setTotalCount(filteredAgents.length);
  }, [filteredAgents.length]);

  // Reset to page 1 whenever the filtered result changes.
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedState, selectedCounties, selectedLocation, showBuyerIncentivesOnly, showListingAgentsOnly, pageSize]);

  // Client-side pagination over the filtered set.
  const paginatedAgents = useMemo(() => {
    if (pageSize === "all") return filteredAgents;
    const start = (page - 1) * pageSize;
    return filteredAgents.slice(start, start + pageSize);
  }, [filteredAgents, page, pageSize]);

  const toggleCounty = (countyId: string) => {
    setSelectedCounties(prev =>
      prev.includes(countyId)
        ? prev.filter(id => id !== countyId)
        : [...prev, countyId]
    );
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedState("");
    setSelectedCounties([]);
    setSelectedLocation(null);
    setShowBuyerIncentivesOnly(false);
    setShowListingAgentsOnly(false);
    setSortOrder("a-z");
    setPage(1);
  };

  const handleMessage = (agent: { id: string; first_name?: string | null; last_name?: string | null; email?: string | null }) => {
    const fullAgent = agents.find(a => a.id === agent.id);
    if (fullAgent) {
      setMessageAgent(fullAgent);
      setMessageDialogOpen(true);
    }
  };

  const handleViewProfile = (agentId: string) => {
    // Find agent to use aac_id for friendly URL
    const agent = agents.find(a => a.id === agentId);
    navigate(`/agent/${agent?.aac_id || agentId}`, { state: { from: location.pathname + location.search } });
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AgentNetworkIntroOverlay
        open={showAgentNetworkIntro}
        onLater={handleAgentNetworkIntroLater}
        onSeeProfile={(dontShowAgain) => {
          dismissAgentNetworkIntroForSee(dontShowAgain);
          if (user?.id) {
            navigate(`/agent/${user.id}`, { state: { from: location.pathname + location.search } });
          }
        }}
        onUpdateProfile={(dontShowAgain) => {
          dismissAgentNetworkIntroForUpdate(dontShowAgain);
          navigate("/agent-profile-editor");
        }}
      />
      <Seo
        title={effectivePublicMode ? "Find an Agent | All Agent Connect" : "AAC Referral Network | All Agent Connect"}
        description={effectivePublicMode
          ? "Browse local real estate agents, compare profiles, and connect with someone who fits your move."
          : "Browse the All Agent Connect member network, discover agents, and build professional connections."}
        canonical={effectivePublicMode ? "https://allagentconnect.com/our-agents" : "https://allagentconnect.com/our-members"}
        noindex={!effectivePublicMode}
        brandType={effectivePublicMode ? undefined : "aac"}
      />
      <main className="flex-1 pb-10">
        {/* Page Header + Search */}
        <section className="border-b border-neutral-200/90 bg-white py-6 md:py-8">
          <div className="mx-auto w-full max-w-[1200px] px-5 md:px-6">
            <PageHeader
              title={pageTitle}
              subtitle={pageSubtitle}
              titleClassName="text-base font-semibold tracking-tight md:text-lg"
              backTo={effectiveAgentMode ? "/agent-dashboard" : undefined}
              compactBack
              className="mb-0"
            />

            {/* Search Bar — separate name and location inputs */}
            <div className="mt-5 grid max-w-3xl grid-cols-1 gap-3 md:grid-cols-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
                <Input
                  type="text"
                  placeholder="Search by first or last name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 rounded-lg border-neutral-200 bg-white pl-10 pr-3 text-sm shadow-none focus-visible:border-neutral-900 focus-visible:ring-1 focus-visible:ring-neutral-300/80 md:h-11 md:text-[15px]"
                />
              </div>
              <LocationAutocomplete
                value={selectedLocation}
                onChange={setSelectedLocation}
                placeholder="Search city, state, or area"
              />
            </div>
          </div>
        </section>

        {/* Filters */}
        <AgentDirectoryFilters
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          resultCount={totalCount}
          searchQuery={searchQuery}
          itemLabel="Agents"
          loading={loading}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />

        {/* Agent Grid */}
        <section className="pb-14 pt-6 md:pt-8">
          <div className="mx-auto w-full max-w-[1200px] px-5 md:px-6">
            {loading ? (
              <div role="status" aria-live="polite" aria-busy="true">
                <span className="sr-only">Loading agents…</span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 md:gap-x-8 lg:grid-cols-4 lg:gap-y-10">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-3">
                      <Skeleton className="aspect-[3/4] w-full rounded-2xl bg-neutral-100" />
                      <Skeleton className="h-4 w-[78%] rounded-md bg-neutral-100" />
                      <Skeleton className="h-3 w-[92%] rounded-md bg-neutral-100" />
                    </div>
                  ))}
                </div>
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <p className="mx-auto max-w-md text-[13px] leading-snug text-neutral-600">
                  {searchQuery || selectedLocation || selectedState || selectedCounties.length > 0
                    ? effectivePublicMode
                      ? "No agents matched your search."
                      : "No agents found matching your criteria."
                    : effectivePublicMode
                      ? "No agents are available right now."
                      : "No agents available at the moment."}
                </p>
              </div>
            ) : (
              <>
                <AgentPhotoTileGrid
                  agents={paginatedAgents}
                  onViewProfile={handleViewProfile}
                  hideDirectContact={effectivePublicMode}
                  showPresence={effectiveAgentMode}
                />

                {/* Pagination Controls */}
                {pageSize !== "all" && totalCount > pageSize && (
                  <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="gap-1 border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <span className="text-[13px] tabular-nums text-neutral-600">
                      Page {page} of {Math.ceil(totalCount / (pageSize as number))}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page * (pageSize as number) >= totalCount}
                      className="gap-1 border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      {/* Message Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={(open) => {
        setMessageDialogOpen(open);
        if (!open) setMessageAgent(null);
      }}>
        <DialogContent className="rounded-2xl border-neutral-200/90 sm:max-w-[500px] [&_input]:focus-visible:border-neutral-900 [&_input]:focus-visible:ring-1 [&_input]:focus-visible:ring-neutral-300/80 [&_textarea]:focus-visible:border-neutral-900 [&_textarea]:focus-visible:ring-1 [&_textarea]:focus-visible:ring-neutral-300/80">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold tracking-tight">
              Contact {messageAgent?.first_name} {messageAgent?.last_name}
            </DialogTitle>
            <DialogDescription className="text-[13px] text-neutral-600">
              Send a message to this agent about their services.
            </DialogDescription>
          </DialogHeader>
          {messageAgent && (
            <MessageForm 
              agentId={messageAgent.id}
              agentName={`${messageAgent.first_name} ${messageAgent.last_name}`}
              agentEmail={messageAgent.email}
              onSuccess={() => {
                setMessageDialogOpen(false);
                setMessageAgent(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Message Form Component
const contactMessageSchema = z.object({
  sender_name: z.string().trim().min(1, "Please enter your name").max(100),
  sender_email: z.string().trim().email("Invalid email address").max(255),
  sender_phone: z.string().trim().max(20).optional(),
  message: z.string().trim().max(1000).optional(),
  subject: z.string().trim().min(1, "Please enter a subject").max(200),
});

interface MessageFormProps {
  agentId: string;
  agentName: string;
  agentEmail: string;
  onSuccess: () => void;
}

const MessageForm = ({ agentId, agentName, agentEmail, onSuccess }: MessageFormProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    sender_name: "",
    sender_email: "",
    sender_phone: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    void getCurrentSenderProfile({ source: "auto" }).then((sender) => {
      if (!sender) return;
      setFormData((prev) => ({
        ...prev,
        sender_name: sender.name || prev.sender_name,
        sender_email: sender.email || prev.sender_email,
        sender_phone: sender.phone || prev.sender_phone,
      }));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validatedData = contactMessageSchema.parse(formData);
      setLoading(true);

      try {
        await supabase.functions.invoke("send-agent-profile-contact", {
          body: {
            agentEmail: agentEmail,
            agentName: agentName,
            senderName: validatedData.sender_name,
            senderEmail: validatedData.sender_email,
            senderPhone: validatedData.sender_phone,
            message: validatedData.message,
            subject: validatedData.subject,
          },
        });
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
        toast.error("Failed to send message. Please try again.");
        return;
      }

      toast.success("Message sent successfully!");
      onSuccess();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      } else {
        toast.error("Failed to send message. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sender_name">Name</Label>
        <Input
          id="sender_name"
          value={formData.sender_name}
          onChange={(e) => setFormData({ ...formData, sender_name: e.target.value })}
          placeholder="Your full name"
          maxLength={100}
        />
        {errors.sender_name && <p className="text-sm text-destructive">{errors.sender_name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="sender_email">Email</Label>
        <Input
          id="sender_email"
          type="email"
          value={formData.sender_email}
          onChange={(e) => setFormData({ ...formData, sender_email: e.target.value })}
          placeholder="your@email.com"
          maxLength={255}
        />
        {errors.sender_email && <p className="text-sm text-destructive">{errors.sender_email}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="sender_phone">Phone</Label>
        <FormattedInput
          id="sender_phone"
          format="phone"
          value={formData.sender_phone}
          onChange={(value) => setFormData({ ...formData, sender_phone: value })}
          placeholder="1234567890"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="What's this about?"
          maxLength={200}
        />
        {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          placeholder="I'm interested in working with you..."
          rows={4}
          maxLength={1000}
        />
        {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
        <p className="text-xs text-muted-foreground">{formData.message.length}/1000</p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
};

export default OurAgents;

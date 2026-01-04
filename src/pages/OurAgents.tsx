import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuthRole } from "@/hooks/useAuthRole";
import AgentPhotoTile from "@/components/agent-directory/AgentPhotoTile";
import AgentDirectoryFilters from "@/components/agent-directory/AgentDirectoryFilters";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { z } from "zod";
import { PageTitle } from "@/components/ui/page-title";

interface EnrichedAgent {
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

const PAGE_SIZE = 24;

interface County {
  id: string;
  name: string;
  state: string;
}

interface OurAgentsProps {
  defaultAgentMode?: boolean;
}

const OurAgents = ({ defaultAgentMode = false }: OurAgentsProps) => {
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuthRole();
  
  const [agents, setAgents] = useState<EnrichedAgent[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const [showBuyerIncentivesOnly, setShowBuyerIncentivesOnly] = useState(false);
  const [showListingAgentsOnly, setShowListingAgentsOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<"a-z" | "z-a" | "listings" | "recent">("a-z");
  
  // View mode - default based on prop
  const [isAgentMode, setIsAgentMode] = useState(defaultAgentMode);
  
  // Message dialog
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageAgent, setMessageAgent] = useState<EnrichedAgent | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const isAuthenticatedAgent = role === "agent";
  
  // Page titles based on mode
  const pageTitle = isAgentMode ? "AAC Referral Network" : "Trusted Agents";
  const pageSubtitle = isAgentMode 
    ? "Connect with fellow agents for referrals and collaboration"
    : "Connect directly with vetted local professionals";

  useEffect(() => {
    fetchData();
  }, [page]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      // Fetch agents with pagination and count
      const { data: agentData, count, error: agentError } = await supabase
        .from("agent_profiles")
        .select(`
          id, first_name, last_name, company, office_name, team_name, cell_phone, phone, email, headshot_url, buyer_incentives, updated_at, title,
          agent_county_preferences(
            county_id,
            counties(name, state)
          ),
          agent_buyer_coverage_areas(city, state, county)
        `, { count: "exact" })
        .order("last_name", { ascending: true })
        .range(from, to);

      if (agentError) throw agentError;
      
      setTotalCount(count || 0);

      // Fetch listings for all agents to get counts
      const { data: listingsData, error: listingsError } = await supabase
        .from("listings")
        .select("agent_id, status, property_type, created_at")
        .in("status", ["active", "coming_soon", "off_market", "sold"]);

      if (listingsError) throw listingsError;

      // Fetch counties for filter
      const { data: countyData, error: countyError } = await supabase
        .from("counties")
        .select("*")
        .order("state", { ascending: true })
        .order("name", { ascending: true });

      if (countyError) throw countyError;

      // Calculate 12 months ago
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      // Enrich agent data with listing counts and derived data
      const enrichedAgents: EnrichedAgent[] = (agentData || []).map((agent: any) => {
        const agentListings = (listingsData || []).filter(l => l.agent_id === agent.id);
        
        // Count by status
        const activeListingsCount = agentListings.filter(l => l.status === "active").length;
        const comingSoonCount = agentListings.filter(l => l.status === "coming_soon").length;
        const offMarketCount = agentListings.filter(l => l.status === "off_market").length;
        
        // Sales in last 12 months
        const last12MonthsSales = agentListings.filter(l => 
          l.status === "sold" && 
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

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    let result = [...agents];

    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(agent =>
        agent.first_name?.toLowerCase().includes(query) ||
        agent.last_name?.toLowerCase().includes(query) ||
        agent.company?.toLowerCase().includes(query) ||
        agent.email?.toLowerCase().includes(query) ||
        agent.office_name?.toLowerCase().includes(query)
      );
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

    // Sort
    switch (sortOrder) {
      case "a-z":
        result.sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
        break;
      case "z-a":
        result.sort((a, b) => `${b.first_name} ${b.last_name}`.localeCompare(`${a.first_name} ${a.last_name}`));
        break;
      case "listings":
        result.sort((a, b) => b.activeListingsCount - a.activeListingsCount);
        break;
      case "recent":
        result.sort((a, b) => {
          if (!a.updated_at) return 1;
          if (!b.updated_at) return -1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
        break;
    }

    return result;
  }, [agents, searchQuery, selectedState, selectedCounties, counties, showBuyerIncentivesOnly, showListingAgentsOnly, sortOrder]);

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
    navigate(`/agent/${agentId}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />

      <main className="flex-1 pt-24 pb-12">
        {/* Compact Hero */}
        <section className="border-b border-border bg-card py-8">
          <div className="container mx-auto px-4">
            <PageTitle>{pageTitle}</PageTitle>
            <p className="mt-1 text-muted-foreground">
              {pageSubtitle}
            </p>
          </div>
        </section>

        {/* Filters */}
        <AgentDirectoryFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedState={selectedState}
          setSelectedState={setSelectedState}
          selectedCounties={selectedCounties}
          toggleCounty={toggleCounty}
          counties={counties}
          states={states}
          showBuyerIncentivesOnly={showBuyerIncentivesOnly}
          setShowBuyerIncentivesOnly={setShowBuyerIncentivesOnly}
          showListingAgentsOnly={showListingAgentsOnly}
          setShowListingAgentsOnly={setShowListingAgentsOnly}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          onClearFilters={handleClearFilters}
          resultCount={filteredAgents.length}
          isAgentMode={isAgentMode}
          setIsAgentMode={setIsAgentMode}
          showAgentModeToggle={isAuthenticatedAgent}
        />

        {/* Agent Grid */}
        <section className="py-6">
          <div className="container mx-auto px-4">
            {loading || authLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  {searchQuery || selectedState || selectedCounties.length > 0
                    ? "No agents found matching your criteria."
                    : "No agents available at the moment."}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
                  {filteredAgents.map((agent) => (
                    <AgentPhotoTile
                      key={agent.id}
                      agent={agent}
                      onClick={handleViewProfile}
                    />
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalCount > PAGE_SIZE && (
                  <div className="mt-8 flex items-center justify-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <span className="text-sm text-zinc-600">
                      Page {page} of {Math.ceil(totalCount / PAGE_SIZE)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page * PAGE_SIZE >= totalCount}
                      className="gap-1"
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

        {/* CTA Section */}
        <section className="bg-primary py-12 text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h2 className="mb-3 text-2xl font-bold">
              Are You a Real Estate Agent?
            </h2>
            <p className="mx-auto mb-6 max-w-2xl opacity-90">
              Join All Agent Connect and connect with buyers actively searching for properties in your area.
            </p>
            <button
              className="inline-flex items-center justify-center rounded-md bg-white border border-neutral-200 px-6 py-2.5 text-sm font-medium text-foreground hover:bg-neutral-soft transition-colors"
              onClick={() => navigate("/auth?mode=register")}
            >
              Register as an Agent
            </button>
          </div>
        </section>
      </main>

      <Footer />

      {/* Message Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={(open) => {
        setMessageDialogOpen(open);
        if (!open) setMessageAgent(null);
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Contact {messageAgent?.first_name} {messageAgent?.last_name}</DialogTitle>
            <DialogDescription>
              Send a message to this agent about their services
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

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Message"}
        </Button>
      </div>
    </form>
  );
};

export default OurAgents;

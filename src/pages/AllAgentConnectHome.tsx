import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { 
  Search, 
  FileStack, 
  MessageSquare, 
  Plus, 
  ArrowRight, 
  Home, 
  Users, 
  UserCircle, 
  UsersRound, 
  SearchCheck 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface HotSheetSummary {
  id: string;
  name: string;
  matching_count: number;
  updated_at: string;
}

interface CommCenterSummary {
  unreadCount: number;
  recentThread: {
    subject: string;
    timestamp: string;
  } | null;
}

const AllAgentConnectHome = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hotsheets, setHotsheets] = useState<HotSheetSummary[]>([]);
  const [commSummary, setCommSummary] = useState<CommCenterSummary>({ unreadCount: 0, recentThread: null });

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const loadWorkspaceData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Load hotsheets
      const { data: hotsheetsData } = await supabase
        .from("hot_sheets")
        .select("id, name, updated_at, criteria")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (hotsheetsData) {
        const hotsheetsWithCounts = await Promise.all(
          hotsheetsData.map(async (hs) => {
            // Get approximate matching count
            const { count } = await supabase
              .from("listings")
              .select("*", { count: "exact", head: true })
              .eq("status", "active");
            
            return {
              id: hs.id,
              name: hs.name,
              matching_count: count || 0,
              updated_at: hs.updated_at,
            };
          })
        );
        setHotsheets(hotsheetsWithCounts);
      }

      // Load recent email campaign for comm center
      const { data: recentCampaign } = await supabase
        .from("email_campaigns")
        .select("subject, sent_at")
        .eq("agent_id", user.id)
        .order("sent_at", { ascending: false })
        .limit(1)
        .single();

      // Count unsent/pending campaigns as "unread" equivalent
      const { count: pendingCount } = await supabase
        .from("email_campaigns")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", user.id)
        .is("sent_at", null);

      setCommSummary({
        unreadCount: pendingCount || 0,
        recentThread: recentCampaign ? {
          subject: recentCampaign.subject,
          timestamp: recentCampaign.sent_at,
        } : null,
      });

    } catch (error) {
      console.error("Error loading workspace data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Success Hub | AllAgentConnect</title>
        <meta 
          name="description" 
          content="Your active workspace for managing listings, hotsheets, and communications." 
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="max-w-[1280px] mx-auto px-6 py-12">
          {/* Page Header */}
          <div className="mb-10">
            <h1 className="text-2xl font-semibold text-heading-page tracking-tight">
              Success Hub
            </h1>
            <p className="text-sm text-text-body mt-1">
              Your active workspace
            </p>
          </div>

          {/* Primary Work Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Listing Search */}
            <SectionCard
              title="Listing Search"
              icon={<Search />}
              description="Search all inventory by status, price, and location"
              rightSlot={
                <Button 
                  size="sm" 
                  onClick={() => navigate("/listing-search")}
                  className="gap-1"
                >
                  Open Search
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              }
            >
              <div className="pt-2">
                <p className="text-xs text-muted-foreground">
                  MLS-style search across active, coming soon, and off-market inventory.
                </p>
              </div>
            </SectionCard>

            {/* Hotsheets */}
            <SectionCard
              title="Hotsheets"
              icon={<FileStack />}
              description="Automated listing alerts for clients"
              rightSlot={
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => navigate("/hot-sheets")}
                  >
                    Open
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => navigate("/client/create-hotsheet")}
                    className="gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create
                  </Button>
                </div>
              }
            >
              {loading ? (
                <div className="py-4 flex justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                </div>
              ) : hotsheets.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  No active hotsheets yet
                </p>
              ) : (
                <div className="space-y-2 pt-2">
                  {hotsheets.slice(0, 3).map((hs) => (
                    <button
                      key={hs.id}
                      onClick={() => navigate(`/hot-sheets/${hs.id}`)}
                      className="w-full text-left p-2 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-heading-section truncate">
                          {hs.name}
                        </span>
                        <span className="text-xs text-text-body shrink-0 ml-2">
                          {hs.matching_count} matches
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Updated {formatDistanceToNow(new Date(hs.updated_at), { addSuffix: true })}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Comm Center */}
            <SectionCard
              title="Comm Center"
              icon={<MessageSquare />}
              description="Outbound email campaigns"
              rightSlot={
                <Button 
                  size="sm" 
                  onClick={() => navigate("/communication-center")}
                  className="gap-1"
                >
                  Open
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              }
            >
              {loading ? (
                <div className="py-4 flex justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                </div>
              ) : (
                <div className="pt-2 space-y-2">
                  {commSummary.unreadCount > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                        {commSummary.unreadCount}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        pending campaign{commSummary.unreadCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {commSummary.recentThread ? (
                    <div className="p-2 rounded-lg border border-border">
                      <p className="text-sm text-heading-section truncate">
                        {commSummary.recentThread.subject}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Sent {formatDistanceToNow(new Date(commSummary.recentThread.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No campaigns sent yet
                    </p>
                  )}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Tier 2 – Management (Medium Cards) */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* My Listings */}
            <button
              onClick={() => navigate("/agent/listings")}
              className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:bg-muted transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Home className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-heading-section">My Listings</h3>
                <p className="text-xs text-text-body truncate">
                  Manage your active and off-market inventory
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>

            {/* My Contacts */}
            <button
              onClick={() => navigate("/agent/clients")}
              className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:bg-muted transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-heading-section">My Contacts</h3>
                <p className="text-xs text-text-body truncate">
                  Client list and relationship management
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>

            {/* Profile & Branding */}
            <button
              onClick={() => navigate("/agent/profile-editor")}
              className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:bg-muted transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <UserCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-heading-section">Profile & Branding</h3>
                <p className="text-xs text-text-body truncate">
                  Public profile and marketing assets
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          </div>

          {/* Tier 3 – Utilities (Compact Cards) */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Manage Team */}
            <button
              onClick={() => navigate("/agent/team")}
              className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-left"
            >
              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <UsersRound className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-heading-section">Manage Team</h3>
                <p className="text-xs text-text-body truncate">
                  Team members and permissions
                </p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>

            {/* Global Search */}
            <button
              onClick={() => navigate("/agent-search")}
              className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-left"
            >
              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <SearchCheck className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-heading-section">Global Search</h3>
                <p className="text-xs text-text-body truncate">
                  Find agents, listings, and contacts
                </p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          </div>

          {/* Future Module Placeholders */}
          <div className="mt-10 border border-dashed border-border rounded-2xl p-6 flex items-center justify-center min-h-[80px]">
            <p className="text-sm text-muted-foreground">
              Additional workspace modules coming soon
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default AllAgentConnectHome;

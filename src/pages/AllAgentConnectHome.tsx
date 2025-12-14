import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              <span className="text-[hsl(220,10%,35%)]">All Agent</span>
              {" "}
              <span className="text-[hsl(220,10%,50%)]">Connect</span>
            </h1>
          </div>

          {/* Tier 1 – Core Workflow (Largest Cards) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Listing Search */}
            <div className="p-5 rounded-2xl border border-border bg-background">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Search className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-base font-semibold text-heading-section">Listing Search</h2>
                </div>
              </div>
              <Button 
                size="sm" 
                onClick={() => navigate("/listing-search")}
                className="gap-1"
              >
                Open Search
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Hotsheets */}
            <div className="p-5 rounded-2xl border border-border bg-background">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <FileStack className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-base font-semibold text-heading-section">Hotsheets</h2>
                </div>
                {hotsheets.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {hotsheets.length} active
                  </span>
                )}
              </div>
              
              {loading ? (
                <div className="py-3 flex justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                </div>
              ) : hotsheets.length > 0 ? (
                <div className="space-y-2 mb-4">
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
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {hs.matching_count}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(hs.updated_at), { addSuffix: true })}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}

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
            </div>

            {/* Comm Center */}
            <div className="p-5 rounded-2xl border border-border bg-background">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-base font-semibold text-heading-section">Comm Center</h2>
                </div>
                {commSummary.unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    {commSummary.unreadCount}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="py-3 flex justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                </div>
              ) : commSummary.recentThread ? (
                <div className="p-2 rounded-lg border border-border mb-4">
                  <p className="text-sm text-heading-section truncate">
                    {commSummary.recentThread.subject}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(commSummary.recentThread.timestamp), { addSuffix: true })}
                  </p>
                </div>
              ) : null}

              <Button 
                size="sm" 
                onClick={() => navigate("/communication-center")}
                className="gap-1"
              >
                Open
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Tier 2 – Management (Medium Cards) */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate("/agent/listings")}
              className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:bg-muted transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Home className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-heading-section">My Listings</h3>
              <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>

            <button
              onClick={() => navigate("/agent/clients")}
              className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:bg-muted transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-heading-section">My Contacts</h3>
              <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>

            <button
              onClick={() => navigate("/agent/profile-editor")}
              className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:bg-muted transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <UserCircle className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-heading-section">Profile & Branding</h3>
              <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          </div>

          {/* Tier 3 – Utilities (Compact Cards) */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/agent/team")}
              className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-left"
            >
              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <UsersRound className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-medium text-heading-section">Manage Team</h3>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>

            <button
              onClick={() => navigate("/agent-search")}
              className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-left"
            >
              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <SearchCheck className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-medium text-heading-section">Global Search</h3>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AllAgentConnectHome;

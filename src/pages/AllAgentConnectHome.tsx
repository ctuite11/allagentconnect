import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  FileStack, 
  MessageSquare, 
  ArrowRight, 
  Home, 
  Users, 
  UserCircle, 
  UsersRound, 
  SearchCheck 
} from "lucide-react";

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

// Unified card classes - locked standard
const hubCard =
  "bg-white border border-neutral-200 rounded-2xl " +
  "shadow-[0_2px_3px_rgba(0,0,0,0.08),0_12px_28px_rgba(0,0,0,0.12)] " +
  "hover:shadow-[0_4px_8px_rgba(0,0,0,0.1),0_16px_36px_rgba(0,0,0,0.14)] hover:border-neutral-300 " +
  "hover:-translate-y-[1px] transition-all cursor-pointer";

// Tier sizing
const tier1 = "p-6 min-h-[140px]";
const tier2 = "p-5 min-h-[72px]";
const tier3 = "p-4";

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

      <div className="min-h-screen bg-[#F7F7F8]">
        <div className="mx-auto max-w-7xl px-8 pt-28 pb-16">
          {/* Page Title */}
          <div className="mb-14">
            <h1 className="text-4xl font-semibold text-neutral-800 font-display">
              Success Hub
            </h1>
            <p className="mt-3 text-base text-neutral-500">
              Connect · Communicate · Collaborate
            </p>
          </div>

          {/* Tier 1 – Command Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Listing Search */}
            <div className={`${hubCard} ${tier1} flex flex-col`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center">
                    <Search className="h-5 w-5 text-neutral-400" />
                  </div>
                  <h2 className="text-base font-semibold text-neutral-800">Listing Search</h2>
                </div>
              </div>
              <div className="mt-auto">
                <Button 
                  size="sm" 
                  onClick={() => navigate("/listing-search")}
                  className="gap-2"
                >
                  Open
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Hotsheets */}
            <div className={`${hubCard} ${tier1} flex flex-col`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center">
                    <FileStack className="h-5 w-5 text-neutral-400" />
                  </div>
                  <h2 className="text-base font-semibold text-neutral-800">Hotsheets</h2>
                </div>
                {hotsheets.length > 0 && (
                  <span className="text-sm text-neutral-400">
                    {hotsheets.length} active
                  </span>
                )}
              </div>
              <div className="mt-auto">
                <Button 
                  size="sm" 
                  onClick={() => navigate("/hot-sheets")}
                  className="gap-2"
                >
                  Open
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Comm Center */}
            <div className={`${hubCard} ${tier1} flex flex-col`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-neutral-400" />
                  </div>
                  <h2 className="text-base font-semibold text-neutral-800">Comm Center</h2>
                </div>
              </div>
              <div className="mt-auto">
                <Button 
                  size="sm" 
                  onClick={() => navigate("/communication-center")}
                  className="gap-2"
                >
                  Open
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Tier 2 – Assets */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <button
              onClick={() => navigate("/agent/listings")}
              className={`${hubCard} ${tier2} group flex items-center gap-4 text-left`}
            >
              <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                <Home className="h-5 w-5 text-neutral-400" />
              </div>
              <h3 className="text-sm font-medium text-neutral-700">My Listings</h3>
              <ArrowRight className="h-4 w-4 text-neutral-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>

            <button
              onClick={() => navigate("/agent/clients")}
              className={`${hubCard} ${tier2} group flex items-center gap-4 text-left`}
            >
              <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-neutral-400" />
              </div>
              <h3 className="text-sm font-medium text-neutral-700">My Contacts</h3>
              <ArrowRight className="h-4 w-4 text-neutral-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>

            <button
              onClick={() => navigate("/agent/profile-editor")}
              className={`${hubCard} ${tier2} group flex items-center gap-4 text-left`}
            >
              <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                <UserCircle className="h-5 w-5 text-neutral-400" />
              </div>
              <h3 className="text-sm font-medium text-neutral-700">Profile & Branding</h3>
              <ArrowRight className="h-4 w-4 text-neutral-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          </div>

          {/* Tier 3 – System */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => navigate("/agent/team")}
              className={`${hubCard} ${tier3} group flex items-center gap-3 text-left`}
            >
              <div className="h-9 w-9 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                <UsersRound className="h-4 w-4 text-neutral-400" />
              </div>
              <h3 className="text-sm font-medium text-neutral-600">Manage Team</h3>
              <ArrowRight className="h-3.5 w-3.5 text-neutral-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>

            <button
              onClick={() => navigate("/agent-search")}
              className={`${hubCard} ${tier3} group flex items-center gap-3 text-left`}
            >
              <div className="h-9 w-9 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                <SearchCheck className="h-4 w-4 text-neutral-400" />
              </div>
              <h3 className="text-sm font-medium text-neutral-600">Global Search</h3>
              <ArrowRight className="h-3.5 w-3.5 text-neutral-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AllAgentConnectHome;

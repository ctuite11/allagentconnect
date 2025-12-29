import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { User } from "@supabase/supabase-js";
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
  SearchCheck,
  Shield
} from "lucide-react";
import AmbientNetworkField from "@/components/allagent/AmbientNetworkField";

// Build ID for verification (set via env or fallback to timestamp)
const BUILD_ID = import.meta.env.VITE_BUILD_ID || `dev-${Date.now()}`;

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

// Use global aac-card utility - locked standard
const hubCard = "aac-card cursor-pointer";

// Tier sizing
const tier1 = "p-6 min-h-[140px]";
const tier2 = "p-5 min-h-[72px]";
const tier3 = "p-4";

const AllAgentConnectHome = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [hotsheets, setHotsheets] = useState<HotSheetSummary[]>([]);
  const [commSummary, setCommSummary] = useState<CommCenterSummary>({ unreadCount: 0, recentThread: null });
  
  const { role } = useUserRole(user);
  const isAdmin = role === "admin";

  // Instrumentation: Log on mount
  useEffect(() => {
    console.log("HUB: AllAgentConnectHome (NEW) ✅", BUILD_ID);
  }, []);

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const loadWorkspaceData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setLoading(false);
        return;
      }
      
      setUser(authUser);

      // Load hotsheets
      const { data: hotsheetsData } = await supabase
        .from("hot_sheets")
        .select("id, name, updated_at, criteria")
        .eq("user_id", authUser.id)
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
        .eq("agent_id", authUser.id)
        .order("sent_at", { ascending: false })
        .limit(1)
        .single();

      // Count unsent/pending campaigns as "unread" equivalent
      const { count: pendingCount } = await supabase
        .from("email_campaigns")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", authUser.id)
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

  // Hub analytics: track card clicks
  const trackHubAction = async (action: string, path: string) => {
    try {
      if (!user) return;
      
      // Insert to audit_logs table
      const { error } = await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "HUB_CARD_CLICK",
        table_name: "success_hub",
        record_id: action,
      });
      
      if (error) {
        // RLS may block insert - fallback to console
        console.warn("Hub tracking (fallback):", { action, path, user_id: user.id });
      }
    } catch (e) {
      console.warn("Hub tracking error:", e);
    }
  };

  // Navigate with tracking
  const handleCardClick = (action: string, path: string) => {
    trackHubAction(action, path);
    navigate(path);
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

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-6 pt-24 pb-10">
          {/* Hero Zone - ambient network lives here only */}
          <div className="relative mb-8 overflow-hidden">
            {/* Ambient network field (decorative, behind content) */}
            <AmbientNetworkField className="absolute -top-8 -right-8 z-0 hidden md:block" />
            
            {/* Content (above ambient) */}
            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold tracking-tight text-slate-900 font-display">
                  Success Hub
                </h1>
                <span 
                  className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium"
                  title={`Build: ${BUILD_ID}`}
                >
                  HUB v2
                </span>
              </div>
              <p className="mt-3 text-base text-neutral-500">
                Connect · Communicate · Collaborate
              </p>
            </div>
          </div>

          {/* Tier 1 – Command Panels: grid-cols-1 lg:grid-cols-3 */}
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
                  onClick={() => handleCardClick("listing_search", "/listing-search")}
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
                  onClick={() => handleCardClick("hot_sheets", "/hot-sheets")}
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
                  onClick={() => handleCardClick("communication_center", "/communication-center")}
                  className="gap-2"
                >
                  Open
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Tier 2 – Assets: grid-cols-1 md:grid-cols-3 */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <button
              onClick={() => handleCardClick("my_listings", "/agent/listings")}
              className={`${hubCard} ${tier2} group flex items-center gap-4 text-left`}
            >
              <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                <Home className="h-5 w-5 text-neutral-400" />
              </div>
              <h3 className="text-sm font-medium text-neutral-700">My Listings</h3>
              <ArrowRight className="h-4 w-4 text-neutral-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>

            <button
              onClick={() => handleCardClick("my_contacts", "/my-clients")}
              className={`${hubCard} ${tier2} group flex items-center gap-4 text-left`}
            >
              <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-neutral-400" />
              </div>
              <h3 className="text-sm font-medium text-neutral-700">My Contacts</h3>
              <ArrowRight className="h-4 w-4 text-neutral-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>

            <button
              onClick={() => handleCardClick("profile_branding", "/agent-profile-editor")}
              className={`${hubCard} ${tier2} group flex items-center gap-4 text-left`}
            >
              <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                <UserCircle className="h-5 w-5 text-neutral-400" />
              </div>
              <h3 className="text-sm font-medium text-neutral-700">Profile & Branding</h3>
              <ArrowRight className="h-4 w-4 text-neutral-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          </div>

          {/* Tier 3 – System: grid-cols-1 md:grid-cols-2 */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => handleCardClick("manage_team", "/manage-team")}
              className={`${hubCard} ${tier3} group flex items-center gap-3 text-left`}
            >
              <div className="h-9 w-9 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                <UsersRound className="h-4 w-4 text-neutral-400" />
              </div>
              <h3 className="text-sm font-medium text-neutral-600">Manage Team</h3>
              <ArrowRight className="h-3.5 w-3.5 text-neutral-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>

            <button
              onClick={() => handleCardClick("global_search", "/agent-search")}
              className={`${hubCard} ${tier3} group flex items-center gap-3 text-left`}
            >
              <div className="h-9 w-9 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                <SearchCheck className="h-4 w-4 text-neutral-400" />
              </div>
              <h3 className="text-sm font-medium text-neutral-600">Global Search</h3>
              <ArrowRight className="h-3.5 w-3.5 text-neutral-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          </div>

          {/* Admin Tools Card - Only visible to admins */}
          {isAdmin && (
            <div className="mt-6">
              <button
                onClick={() => handleCardClick("admin_tools", "/admin/approvals")}
                className={`${hubCard} ${tier3} group flex items-center gap-3 text-left w-full md:w-1/2 border-l-4 border-amber-400`}
              >
                <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Shield className="h-4 w-4 text-amber-600" />
                </div>
                <h3 className="text-sm font-medium text-neutral-600">Admin Tools</h3>
                <ArrowRight className="h-3.5 w-3.5 text-neutral-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AllAgentConnectHome;
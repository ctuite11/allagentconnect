import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, FileText, TrendingUp, Calendar, Mail, Heart, Bell, 
  Home, UserPlus, Megaphone, Palette, MessageSquare 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import { TechCard } from "@/components/success-hub/TechCard";

interface Buyer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  hotsheet_count: number;
  last_activity: string | null;
}

interface HotSheet {
  id: string;
  name: string;
  client_email: string | null;
  client_name: string | null;
  created_at: string;
  updated_at: string;
  criteria: any;
  matching_count?: number;
  share_token?: string;
}

interface ActivityEvent {
  type: "invitation" | "hotsheet" | "favorite";
  timestamp: string;
  description: string;
  icon: any;
}

export default function AgentSuccessHub() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  
  // KPIs
  const [activeBuyersCount, setActiveBuyersCount] = useState(0);
  const [activeHotsheetsCount, setActiveHotsheetsCount] = useState(0);
  const [engagedThisWeekCount, setEngagedThisWeekCount] = useState(0);
  const [invitationsSentCount, setInvitationsSentCount] = useState(0);
  const [activeListingsCount, setActiveListingsCount] = useState(0);
  
  // Lists
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [hotsheets, setHotsheets] = useState<HotSheet[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      
      setCurrentAgentId(user.id);
      
      await Promise.all([
        loadKPIs(user.id),
        loadBuyers(user.id),
        loadHotsheets(user.id),
        loadRecentActivity(user.id)
      ]);
      
    } catch (error) {
      console.error("Error loading dashboard:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const loadKPIs = async (agentId: string) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();
    
    // Active Buyers
    const { count: buyersCount } = await supabase
      .from("client_agent_relationships")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .eq("status", "active");
    setActiveBuyersCount(buyersCount || 0);
    
    // Active Hotsheets
    const { count: hotsheetsCount } = await supabase
      .from("hot_sheets")
      .select("*", { count: "exact", head: true })
      .eq("user_id", agentId)
      .eq("is_active", true);
    setActiveHotsheetsCount(hotsheetsCount || 0);

    // Active Listings
    const { count: listingsCount } = await supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .eq("status", "active");
    setActiveListingsCount(listingsCount || 0);
    
    // Engaged This Week
    const { data: recentFavorites } = await supabase
      .from("favorites")
      .select("user_id")
      .gte("created_at", sevenDaysAgoISO);
    
    const { data: recentAccepted } = await supabase
      .from("share_tokens")
      .select("accepted_by_user_id")
      .eq("agent_id", agentId)
      .gte("accepted_at", sevenDaysAgoISO)
      .not("accepted_by_user_id", "is", null);
    
    const { data: recentHotsheets } = await supabase
      .from("hot_sheets")
      .select("user_id")
      .eq("user_id", agentId)
      .gte("updated_at", sevenDaysAgoISO);
    
    const uniqueUsers = new Set([
      ...(recentFavorites?.map(f => f.user_id) || []),
      ...(recentAccepted?.map(a => a.accepted_by_user_id) || []),
      ...(recentHotsheets?.map(h => h.user_id) || [])
    ]);
    setEngagedThisWeekCount(uniqueUsers.size);
    
    // Invitations Sent
    const { count: invitesCount } = await supabase
      .from("share_tokens")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .gte("created_at", sevenDaysAgoISO);
    setInvitationsSentCount(invitesCount || 0);
  };

  const loadBuyers = async (agentId: string) => {
    const { data: relationships } = await supabase
      .from("client_agent_relationships")
      .select("client_id, created_at")
      .eq("agent_id", agentId)
      .eq("status", "active");
    
    if (!relationships || relationships.length === 0) {
      setBuyers([]);
      return;
    }
    
    const clientIds = relationships.map(r => r.client_id);
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .in("id", clientIds);
    
    const { data: hotsheetCounts } = await supabase
      .from("hot_sheets")
      .select("user_id")
      .in("user_id", clientIds);
    
    const { data: lastFavorites } = await supabase
      .from("favorites")
      .select("user_id, created_at")
      .in("user_id", clientIds)
      .order("created_at", { ascending: false });
    
    const { data: lastHotsheetUpdates } = await supabase
      .from("hot_sheets")
      .select("user_id, updated_at")
      .in("user_id", clientIds)
      .order("updated_at", { ascending: false });
    
    const buyersData: Buyer[] = (profiles || []).map(profile => {
      const hotsheetsForClient = hotsheetCounts?.filter(h => h.user_id === profile.id).length || 0;
      const lastFav = lastFavorites?.find(f => f.user_id === profile.id);
      const lastHotsheet = lastHotsheetUpdates?.find(h => h.user_id === profile.id);
      
      let lastActivity = null;
      if (lastFav && lastHotsheet) {
        lastActivity = new Date(lastFav.created_at) > new Date(lastHotsheet.updated_at) 
          ? lastFav.created_at 
          : lastHotsheet.updated_at;
      } else if (lastFav) {
        lastActivity = lastFav.created_at;
      } else if (lastHotsheet) {
        lastActivity = lastHotsheet.updated_at;
      }
      
      return {
        id: profile.id,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        hotsheet_count: hotsheetsForClient,
        last_activity: lastActivity
      };
    });
    
    setBuyers(buyersData);
  };

  const loadHotsheets = async (agentId: string) => {
    const { data: hotsheetsData } = await supabase
      .from("hot_sheets")
      .select("id, name, client_id, created_at, updated_at, criteria")
      .eq("user_id", agentId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false });
    
    if (!hotsheetsData) {
      setHotsheets([]);
      return;
    }
    
    const clientIds = hotsheetsData.map(h => h.client_id).filter(Boolean);
    
    const { data: clients } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .in("id", clientIds);
    
    const { data: allTokens } = await supabase
      .from("share_tokens")
      .select("token, payload")
      .eq("agent_id", agentId);
    
    const hotsheetsWithDetails: HotSheet[] = await Promise.all(
      hotsheetsData.map(async (hs) => {
        const client = clients?.find(c => c.id === hs.client_id);
        const token = allTokens?.find(t => {
          const payload = t.payload as any;
          return payload?.hot_sheet_id === hs.id || payload?.hotsheet_id === hs.id;
        });
        
        let matchingCount = 0;
        try {
          const { count } = await supabase
            .from("listings")
            .select("*", { count: "exact", head: true })
            .eq("status", "active");
          matchingCount = count || 0;
        } catch (error) {
          console.error("Error counting matches for hotsheet:", error);
        }
        
        return {
          id: hs.id,
          name: hs.name,
          client_email: client?.email || null,
          client_name: client ? `${client.first_name || ""} ${client.last_name || ""}`.trim() : null,
          created_at: hs.created_at,
          updated_at: hs.updated_at,
          criteria: hs.criteria,
          matching_count: matchingCount,
          share_token: token?.token || undefined
        };
      })
    );
    
    setHotsheets(hotsheetsWithDetails);
  };

  const loadRecentActivity = async (agentId: string) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();
    
    const events: ActivityEvent[] = [];
    
    const { data: acceptedInvites } = await supabase
      .from("share_tokens")
      .select("accepted_at, payload")
      .eq("agent_id", agentId)
      .not("accepted_at", "is", null)
      .gte("accepted_at", thirtyDaysAgoISO)
      .order("accepted_at", { ascending: false });
    
    (acceptedInvites || []).forEach(invite => {
      const hotsheetName = (invite.payload as any)?.hotsheet_name || "a hotsheet";
      events.push({
        type: "invitation",
        timestamp: invite.accepted_at!,
        description: `Invitation accepted for ${hotsheetName}`,
        icon: Mail
      });
    });
    
    const { data: newHotsheets } = await supabase
      .from("hot_sheets")
      .select("created_at, name, client_id")
      .eq("user_id", agentId)
      .gte("created_at", thirtyDaysAgoISO)
      .order("created_at", { ascending: false });
    
    (newHotsheets || []).forEach(hs => {
      events.push({
        type: "hotsheet",
        timestamp: hs.created_at,
        description: `New hotsheet '${hs.name}' created`,
        icon: Bell
      });
    });
    
    const { data: newFavorites } = await supabase
      .from("favorites")
      .select("created_at, user_id")
      .gte("created_at", thirtyDaysAgoISO)
      .order("created_at", { ascending: false });
    
    const favoritesByUser = new Map<string, { count: number; timestamp: string }>();
    (newFavorites || []).forEach(fav => {
      const existing = favoritesByUser.get(fav.user_id);
      if (!existing) {
        favoritesByUser.set(fav.user_id, { count: 1, timestamp: fav.created_at });
      } else {
        existing.count++;
      }
    });
    
    favoritesByUser.forEach((data) => {
      events.push({
        type: "favorite",
        timestamp: data.timestamp,
        description: `Client favorited ${data.count} home${data.count > 1 ? 's' : ''}`,
        icon: Heart
      });
    });
    
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setActivities(events.slice(0, 20));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center pt-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  const hubCards = [
    {
      icon: <Home className="w-6 h-6" />,
      title: "Listings",
      description: "Manage your property listings and track performance",
      metricValue: activeListingsCount,
      metricLabel: "active",
      route: "/agent/listings",
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Contacts",
      description: "View and manage your client relationships",
      metricValue: activeBuyersCount,
      metricLabel: "clients",
      route: "/my-clients",
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: "Hotsheets",
      description: "Create and manage property alert hotsheets",
      metricValue: activeHotsheetsCount,
      metricLabel: "active",
      route: "/hot-sheets",
    },
    {
      icon: <UserPlus className="w-6 h-6" />,
      title: "Buyer Registry",
      description: "Register buyer needs and track matches",
      route: "/submit-client-need",
    },
    {
      icon: <Palette className="w-6 h-6" />,
      title: "Branding",
      description: "Customize your agent profile and branding",
      route: "/agent/profile/edit",
    },
    {
      icon: <Mail className="w-6 h-6" />,
      title: "Messages",
      description: "View and respond to client inquiries",
      route: "/my-clients",
    },
    {
      icon: <Megaphone className="w-6 h-6" />,
      title: "Communications Center",
      description: "Agent-to-agent alerts for buyer needs, intel, and discussions",
      route: "/client-needs",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-24 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-foreground font-display">Agent Success Hub</h1>
          <p className="text-muted-foreground mt-2">Your command center for client success</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Buyers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Users className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-4xl font-bold text-foreground">{activeBuyersCount}</p>
                  <p className="text-xs text-muted-foreground">Client relationships</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-accent">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Hotsheets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Bell className="w-8 h-8 text-accent" />
                <div>
                  <p className="text-4xl font-bold text-foreground">{activeHotsheetsCount}</p>
                  <p className="text-xs text-muted-foreground">Tracking matches</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Engaged This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <TrendingUp className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="text-4xl font-bold text-foreground">{engagedThisWeekCount}</p>
                  <p className="text-xs text-muted-foreground">Active clients</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Invitations Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Mail className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-4xl font-bold text-foreground">{invitationsSentCount}</p>
                  <p className="text-xs text-muted-foreground">Last 7 days</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tech-Forward Hub Cards Grid */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Quick Access</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {hubCards.map((card) => (
              <TechCard
                key={card.title}
                icon={card.icon}
                title={card.title}
                description={card.description}
                metricValue={card.metricValue}
                metricLabel={card.metricLabel}
                onClick={() => navigate(card.route)}
              />
            ))}
          </div>
        </div>

        {/* Two Columns - Buyers & Hotsheets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Buyers</CardTitle>
              <CardDescription>{buyers.length} active buyer{buyers.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {buyers.length === 0 ? (
                <p className="text-muted-foreground text-sm">No active buyers yet</p>
              ) : (
                buyers.slice(0, 5).map(buyer => (
                  <div key={buyer.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {buyer.first_name && buyer.last_name 
                          ? `${buyer.first_name} ${buyer.last_name}`
                          : buyer.email}
                      </p>
                      <p className="text-sm text-muted-foreground">{buyer.email}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{buyer.hotsheet_count} hotsheet{buyer.hotsheet_count !== 1 ? 's' : ''}</span>
                        {buyer.last_activity && (
                          <span>Active {formatDistanceToNow(new Date(buyer.last_activity), { addSuffix: true })}</span>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/my-clients`)}>
                      View
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Hotsheets</CardTitle>
              <CardDescription>{hotsheets.length} hotsheet{hotsheets.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hotsheets.length === 0 ? (
                <p className="text-muted-foreground text-sm">No hotsheets created yet</p>
              ) : (
                hotsheets.slice(0, 5).map(hs => (
                  <div key={hs.id} className="p-4 border border-border rounded-lg space-y-3">
                    <div>
                      <p className="font-medium text-foreground">{hs.name}</p>
                      {(hs.client_name || hs.client_email) && (
                        <p className="text-sm text-muted-foreground">
                          Client: {hs.client_name || hs.client_email}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Updated {formatDistanceToNow(new Date(hs.updated_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/hot-sheets/${hs.id}/review`)}>
                        View
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Last 30 days of client engagement</CardDescription>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent activity</p>
            ) : (
              <div className="space-y-4">
                {activities.slice(0, 10).map((activity, index) => {
                  const Icon = activity.icon;
                  return (
                    <div key={index} className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

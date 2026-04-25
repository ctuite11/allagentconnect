import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Heart,
  FileText,
  Phone,
  Eye,
  UserX,
  Plus,
  MessageSquare,
  UserPlus,
  Search,
  Sparkles,
  Circle,
  CheckCircle2,
} from "lucide-react";
import { clearPrimaryAgentId } from "@/utils/agentTracking";
import { toast } from "sonner";
import { ContactMyAgentDialog } from "@/components/ContactMyAgentDialog";
import { AddFriendDialog } from "@/components/AddFriendDialog";
import { PendingInvitesCard } from "@/components/PendingInvitesCard";
import { useUnreadConversations } from "@/hooks/useUnreadConversations";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AgentInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  headshot_url: string | null;
}

interface HotSheet {
  id: string;
  name: string;
  criteria: any;
  created_at: string;
  last_sent_at?: string | null;
  is_active: boolean;
  agent?: {
    first_name: string;
    last_name: string;
    company: string | null;
  } | null;
}

interface Favorite {
  id: string;
  listing: {
    id: string;
    address: string;
    city: string;
    state: string;
    price: number;
    bedrooms: number | null;
    bathrooms: number | null;
    photos: any;
  };
}

interface MarketListing {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  photos: any;
  created_at: string;
}

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { unreadCount } = useUnreadConversations();
  const [loading, setLoading] = useState(true);
  const [relationshipHydrating, setRelationshipHydrating] = useState(false);
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [relationshipId, setRelationshipId] = useState<string | null>(null);
  const [hotSheets, setHotSheets] = useState<HotSheet[]>([]);
  const [shareTokenByHotSheetId, setShareTokenByHotSheetId] = useState<Record<string, string>>({});
  const [hotSheetMatchCountById, setHotSheetMatchCountById] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [marketListings, setMarketListings] = useState<MarketListing[]>([]);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [crmClientId, setCrmClientId] = useState<string | null>(null);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [buyerFirstName, setBuyerFirstName] = useState<string | null>(null);
  const [tasks, setTasks] = useState([
    { id: "preapproval", label: "Complete financing pre-approval", done: false },
    { id: "saved-homes", label: "Review saved homes", done: true },
    { id: "tours", label: "Schedule tours", done: false },
    { id: "messages", label: "Respond to agent message", done: false },
  ]);

  useEffect(() => {
    checkAuth();
  }, []);

  const sanitizeFirstName = (value: string | null | undefined): string | null => {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    if (trimmed.includes("@")) return null;

    // Reject common email-username style values such as "chris.tuite".
    if (/^[a-z0-9._%+-]+\.[a-z0-9._%+-]+$/i.test(trimmed) && !trimmed.includes(" ")) {
      return null;
    }

    const firstToken = trimmed.split(/\s+/)[0] || trimmed;
    const cleaned = firstToken.replace(/[^a-zA-Z'\-]/g, "").trim();
    if (!cleaned) return null;

    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  };

  const resolveBuyerGreetingName = async (userId: string, userEmail?: string | null, displayName?: string | null) => {
    // Priority 1: buyer profile first_name
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("id", userId)
      .maybeSingle();

    const profileFirst = sanitizeFirstName(profile?.first_name);
    if (profileFirst) return profileFirst;

    // Priority 2: buyer display_name (auth metadata)
    const display = sanitizeFirstName(displayName);
    if (display) return display;

    // Priority 3: latest client record first_name for this email
    const normalizedEmail = userEmail?.trim().toLowerCase();
    if (normalizedEmail) {
      const { data: clientRow } = await supabase
        .from("clients")
        .select("first_name, created_at")
        .ilike("email", normalizedEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const clientFirst = sanitizeFirstName(clientRow?.first_name);
      if (clientFirst) return clientFirst;
    }

    return null;
  };

  const consumeInviteHandoffMarker = () => {
    if (typeof window === "undefined") return false;
    const raw = sessionStorage.getItem("aac_invite_acceptance_handoff");
    if (!raw) return false;

    sessionStorage.removeItem("aac_invite_acceptance_handoff");

    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;

    const ageMs = Date.now() - ts;
    return ageMs >= 0 && ageMs <= 10 * 60 * 1000;
  };

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/consumer/auth");
      return;
    }

    const resolvedName = await resolveBuyerGreetingName(
      user.id,
      user.email,
      (user.user_metadata?.display_name as string | undefined) ?? null
    );
    setBuyerFirstName(resolvedName);

    const cameFromInviteAcceptance = consumeInviteHandoffMarker();
    if (cameFromInviteAcceptance) {
      setRelationshipHydrating(true);
    }

    setCurrentUserId(user.id);

    try {
      const activeAgentId = await loadAgentRelationship(user.id);
      await Promise.all([
        loadHotSheets(user.id, activeAgentId),
        loadFavorites(user.id),
        loadMarketListings(),
      ]);

      if (cameFromInviteAcceptance && !activeAgentId) {
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
        const retriedAgentId = await loadAgentRelationship(user.id);
        await loadHotSheets(user.id, retriedAgentId);
      }
    } finally {
      setRelationshipHydrating(false);
      setLoading(false);
    }
  };

  const loadAgentRelationship = async (userId: string) => {
    const { data: relationship } = await supabase
      .from("client_agent_relationships")
      .select("id, agent_id")
      .eq("client_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (relationship) {
      setRelationshipId(relationship.id);
      const { data: agentData } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, email, phone, company, headshot_url")
        .eq("id", relationship.agent_id)
        .single();

      if (agentData) {
        setAgent(agentData);

        // Resolve CRM client ID via email bridge for Contact My Agent
        const { data: buyerProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", userId)
          .maybeSingle();

        const buyerEmail = buyerProfile?.email?.trim();
        if (buyerEmail) {
          const { data: crmRow } = await supabase
            .from("clients")
            .select("id")
            .eq("agent_id", agentData.id)
            .ilike("email", buyerEmail)
            .maybeSingle();

          setCrmClientId(crmRow?.id ?? null);
        }
      }

      return relationship.agent_id as string;
    }

    setRelationshipId(null);
    setAgent(null);
    setCrmClientId(null);
    return null;
  };

  const loadHotSheets = async (userId: string, activeAgentId: string | null) => {
    if (!activeAgentId) {
      setHotSheets([]);
      setShareTokenByHotSheetId({});
      return;
    }

    // Get buyer profile email for fallback matching
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    const buyerEmail = profile?.email?.toLowerCase().trim() ?? "";

    // Primary source of truth: accepted share_tokens for this buyer
    // This avoids RLS issues with hot_sheet_clients (CRM ID != auth ID)
    const { data: acceptedTokenRows, error: tokenErr } = await supabase
      .from("share_tokens")
      .select("token, payload, accepted_at, accepted_by_user_id")
      .not("accepted_at", "is", null);

    if (tokenErr) {
      console.error("Failed to load accepted tokens", tokenErr);
      setHotSheets([]);
      return;
    }

    // Filter tokens for this buyer and extract hot_sheet_ids
    const acceptedHotSheetIds = new Set<string>();
    const tokenMap: Record<string, string> = {};
    const buyerEmailNorm = (buyerEmail ?? "").toLowerCase().trim();

    for (const t of acceptedTokenRows || []) {
      const p = (t.payload as any) ?? {};
      if (p.type !== "client_hotsheet_invite") continue;
      if (activeAgentId && p.agent_id && p.agent_id !== activeAgentId) continue;

      const hsId = String(p.hot_sheet_id ?? "");
      if (!hsId) continue;

      const matchByUserId = t.accepted_by_user_id === userId;
      const tokenEmail = String(p.client_email ?? "").toLowerCase().trim();
      const matchByEmail = buyerEmailNorm && tokenEmail === buyerEmailNorm;

      if (matchByUserId || matchByEmail) {
        acceptedHotSheetIds.add(hsId);
        if (t.token) tokenMap[hsId] = t.token;
      }
    }

    if (import.meta.env.DEV) {
      console.log("[ClientDashboard] token scan:", {
        total: (acceptedTokenRows || []).length,
        matched: acceptedHotSheetIds.size,
      });
    }

    if (!acceptedHotSheetIds.size) {
      setHotSheets([]);
      setShareTokenByHotSheetId({});
      setHotSheetMatchCountById({});
      return;
    }

    // Fetch hot sheet details directly by IDs
    const hsIds = [...acceptedHotSheetIds];
    const { data: sheetRows, error: sheetErr } = await supabase
      .from("hot_sheets")
      .select("id, name, criteria, created_at, last_sent_at, is_active, user_id")
      .in("id", hsIds);

    if (sheetErr) {
      console.error("Failed to load hot sheets by ID", sheetErr);
      setHotSheets([]);
      setHotSheetMatchCountById({});
      return;
    }

    const rawSheets = (sheetRows || []).filter((s: any) => s.id);

    // Fetch agent profiles for attribution
    const agentIds = [...new Set(rawSheets.map((s: any) => s.user_id).filter(Boolean))];
    let agentMap: Record<string, any> = {};
    if (agentIds.length) {
      const { data: agents } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, company")
        .in("id", agentIds);
      for (const a of agents || []) agentMap[a.id] = a;
    }

    const sheetsWithAgent = rawSheets.map((s: any) => ({
      ...s,
      agent: agentMap[s.user_id] ?? null,
    }));

    const matchCountEntries = await Promise.all(
      sheetsWithAgent.map(async (sheet: any) => {
        try {
          const { data: matched } = await buildListingsQuery(supabase, sheet.criteria || {}).limit(120);
          return [sheet.id, (matched || []).length] as const;
        } catch {
          return [sheet.id, 0] as const;
        }
      })
    );

    setHotSheetMatchCountById(Object.fromEntries(matchCountEntries));

    setHotSheets(sheetsWithAgent);
    setShareTokenByHotSheetId(tokenMap);
  };

  const loadFavorites = async (userId: string) => {
    const { data } = await supabase
      .from("favorites")
      .select(`
        id,
        listing:listings (
          id, address, city, state, price, bedrooms, bathrooms, photos
        )
      `)
      .eq("user_id", userId)
      .limit(6);

    if (data) {
      setFavorites(data as any);
    }
  };

  const loadMarketListings = async () => {
    const { data, error } = await supabase
      .from("listings")
      .select("id, address, city, state, price, bedrooms, bathrooms, square_feet, photos, created_at")
      .in("status", ["coming_soon", "active", "back_on_market"])
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      console.error("Failed to load market listings", error);
      setMarketListings([]);
      return;
    }

    setMarketListings((data || []) as MarketListing[]);
  };

  const handleEndRelationship = async () => {
    if (!currentUserId) {
      console.error("End relationship: currentUserId is null");
      toast.error("Please sign in again and retry");
      return;
    }

    const { error } = await supabase.rpc('end_client_relationship');

    if (error) {
      console.error("End relationship RPC error:", error);
      toast.error(error.message ?? "Failed to end relationship");
      return;
    }

    console.log("End relationship success via RPC");
    toast.success("Relationship ended");
    clearPrimaryAgentId();
    setAgent(null);
    setRelationshipId(null);
    setShowEndDialog(false);

    await loadAgentRelationship(currentUserId);
  };

  const formatCriteriaSummary = (criteria: any) => {
    const parts = [];
    if (criteria?.bedrooms) parts.push(`${criteria.bedrooms}+ beds`);
    if (criteria?.bathrooms) parts.push(`${criteria.bathrooms}+ baths`);
    if (criteria?.maxPrice) parts.push(`under $${(criteria.maxPrice / 1000).toFixed(0)}k`);
    if (criteria?.cities && criteria.cities.length > 0) {
      parts.push(criteria.cities.slice(0, 2).join(", "));
    }
    return parts.join(" • ");
  };

  const getPrimaryPhotoUrl = (photos: unknown): string => {
    if (!photos) return "/placeholder.svg";

    const normalize = (value: unknown): unknown[] => {
      if (Array.isArray(value)) return value;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith("[")) {
          try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [trimmed];
      }
      return [];
    };

    const normalizedPhotos = normalize(photos);
    const firstPhoto = normalizedPhotos[0];

    if (typeof firstPhoto === "string" && firstPhoto.trim()) return firstPhoto;
    if (
      firstPhoto &&
      typeof firstPhoto === "object" &&
      "url" in firstPhoto &&
      typeof (firstPhoto as { url?: unknown }).url === "string" &&
      (firstPhoto as { url: string }).url.trim()
    ) {
      return (firstPhoto as { url: string }).url;
    }

    return "/placeholder.svg";
  };

  const activeSearches = hotSheets.filter((sheet) => sheet.is_active).length;
  const latestListingsPreview = marketListings.slice(0, 3);
  const currentJourneyStage = hotSheets.length > 0 ? 2 : 1;
  const stageLabels = ["Search", "Touring", "Offer", "Under Agreement", "Closing"];
  const marketSnapshot = {
    area: "Greater Boston",
    medianPrice: "$1.08M",
    newThisWeek: "126",
    avgDaysOnMarket: "19",
  };

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
  };

  const stats = [
    {
      label: "Saved Homes",
      value: String(favorites.length),
      icon: Heart,
      subtle: null as string | null,
    },
    {
      label: "New Matches",
      value: latestListingsPreview.length > 0 ? String(latestListingsPreview.length) : "--",
      icon: Sparkles,
      subtle: latestListingsPreview.length > 0 ? "Updated today" : "Awaiting activity",
    },
    {
      label: "Unread Messages",
      value: String(unreadCount),
      icon: MessageSquare,
      subtle: unreadCount > 0 ? "Needs review" : "No new messages from your agent.",
    },
    {
      label: "Active Searches",
      value: String(activeSearches),
      icon: Search,
      subtle: activeSearches > 0 ? "Running alerts" : "No active alerts",
    },
  ];

  const primaryCtaClass = "rounded-xl bg-[#0E56F5] text-white hover:bg-[#0B46CC]";

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">
          {relationshipHydrating ? "Connecting your inviting agent..." : "Loading your dashboard..."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <main className="mx-auto w-full max-w-7xl px-6 md:px-8 py-8 pb-12">
        <div className="space-y-8">
          <section className="rounded-2xl bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.04] p-6 md:p-8 transition-shadow duration-150 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
              <div className="space-y-3">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900" style={{ fontFamily: "Manrope, sans-serif" }}>
                  {buyerFirstName ? `Welcome back, ${buyerFirstName}` : "Welcome back"}
                </h1>
                <p className="text-sm md:text-base text-zinc-600 max-w-2xl">
                  Track saved homes, new opportunities, messages, and progress toward your next move.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                    Active Buyer
                  </span>
                  {agent && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                      Working with {agent.first_name} {agent.last_name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto md:justify-end">
                <Button variant="outline" className="rounded-xl" onClick={() => setAddFriendOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add a Friend
                </Button>
                <Button className={primaryCtaClass} onClick={() => navigate("/messages")}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Messages
                </Button>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map(({ label, value, icon: Icon, subtle }) => (
              <div
                key={label}
                className="rounded-xl bg-white ring-1 ring-black/[0.05] shadow-[0_4px_18px_rgba(15,23,42,0.05)] p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <Icon className="h-5 w-5 text-[#0E56F5]" />
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">{value}</div>
                <div className="mt-1 text-xs font-medium text-zinc-500">{label}</div>
                {subtle && <div className="mt-2 text-[11px] text-zinc-400">{subtle}</div>}
              </div>
            ))}
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <Card className="rounded-2xl border-zinc-200/70 shadow-[0_6px_20px_rgba(15,23,42,0.05)]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-lg font-semibold tracking-tight text-zinc-900">
                        Market Activity
                      </CardTitle>
                      <CardDescription>
                        Fresh listings in the market, updated regardless of saved searches.
                      </CardDescription>
                    </div>
                    <Button className={primaryCtaClass} onClick={() => navigate("/client/search")}>
                      <Search className="w-4 h-4 mr-2" />
                      Search homes
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {latestListingsPreview.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {latestListingsPreview.map((listing, index) => (
                        <article
                          key={listing.id}
                          className="group cursor-pointer rounded-xl bg-white ring-1 ring-black/[0.05] shadow-[0_4px_16px_rgba(15,23,42,0.05)] overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(15,23,42,0.10)]"
                          onClick={() => navigate(`/property/${listing.id}`)}
                        >
                          <div className="relative aspect-[4/3] bg-zinc-100">
                            <img
                              src={getPrimaryPhotoUrl(listing.photos)}
                              alt={listing.address}
                              className="h-full w-full object-cover"
                            />
                            {index < 2 && (
                              <span className="absolute top-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold tracking-[0.06em] text-zinc-700 shadow-sm">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="p-4 space-y-1.5">
                            <p className="text-lg font-semibold tracking-tight text-zinc-900">
                              {listing.price ? `$${listing.price.toLocaleString()}` : "Price unavailable"}
                            </p>
                            <p className="text-sm font-medium text-zinc-800 truncate">{listing.address}</p>
                            <p className="text-xs text-zinc-500">{listing.city}, {listing.state}</p>
                            <p className="text-xs text-zinc-500 pt-1">
                              {listing.bedrooms ?? "--"} bd • {listing.bathrooms ?? "--"} ba • {listing.square_feet ? `${listing.square_feet.toLocaleString()} sqft` : "-- sqft"}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 rounded-xl bg-zinc-50/80 ring-1 ring-zinc-100">
                      <p className="text-sm text-zinc-600 mb-4">
                        No listings yet. Start exploring homes to see live market activity.
                      </p>
                      <Button className={primaryCtaClass} onClick={() => navigate("/client/search")}>
                        <Search className="w-4 h-4 mr-2" />
                        Search homes
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-zinc-200/70 shadow-[0_6px_20px_rgba(15,23,42,0.05)]">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-lg font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-zinc-500" />
                        Hot Sheets
                        {hotSheets.length > 0 && (
                          <Badge variant="secondary" className="ml-1">{hotSheets.length}</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Track listings with instant alerts.
                      </CardDescription>
                    </div>
                    {hotSheets.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => navigate("/hot-sheets")}>Manage Hot Sheets</Button>
                        <Button size="sm" className={primaryCtaClass} onClick={() => navigate("/hot-sheets")}>
                          <Plus className="w-4 h-4 mr-2" />
                          Create Hot Sheet
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {hotSheets.length > 0 ? (
                    <div className="space-y-3">
                      {hotSheets.slice(0, 3).map((sheet) => {
                        const hasNewListings = Date.now() - new Date(sheet.created_at).getTime() < 1000 * 60 * 60 * 48;
                        const matchCount = hotSheetMatchCountById[sheet.id] ?? 0;
                        const token = shareTokenByHotSheetId[sheet.id];
                        return (
                        <div
                          key={sheet.id}
                          role={token ? "button" : undefined}
                          tabIndex={token ? 0 : -1}
                          onClick={() => token && navigate(`/client/hotsheet/${token}`)}
                          onKeyDown={(e) => {
                            if (!token) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              navigate(`/client/hotsheet/${token}`);
                            }
                          }}
                          className="rounded-xl ring-1 ring-zinc-200/70 bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(15,23,42,0.08)] cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-zinc-900">{sheet.name}</h4>
                                {hasNewListings && (
                                  <Badge className="text-xs bg-[#0E56F5]/10 text-[#0E56F5] hover:bg-[#0E56F5]/10">New listings</Badge>
                                )}
                                <Badge variant="secondary" className="text-xs">
                                  {sheet.is_active ? "Active" : "Paused"}
                                </Badge>
                              </div>
                              {sheet.agent && (
                                <p className="text-sm text-zinc-500 mt-0.5">
                                  From {sheet.agent.first_name} {sheet.agent.last_name}
                                  {sheet.agent.company ? ` · ${sheet.agent.company}` : ""}
                                </p>
                              )}
                              {formatCriteriaSummary(sheet.criteria) && (
                                <p className="text-sm text-zinc-600 mt-1">
                                  {formatCriteriaSummary(sheet.criteria)}
                                </p>
                              )}
                              <p className="text-sm font-medium text-zinc-800 mt-1.5">
                                {matchCount} {matchCount === 1 ? "match" : "matches"}
                              </p>
                              <p className="text-xs text-zinc-400 mt-1.5">
                                Updated {new Date(sheet.last_sent_at || sheet.created_at).toLocaleString()}
                              </p>
                            </div>
                            {token && (
                              <Button
                                size="sm"
                                className={`${primaryCtaClass} shrink-0`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/client/hotsheet/${token}`);
                                }}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Matches
                              </Button>
                            )}
                          </div>
                        </div>
                      )})}

                      {hotSheets.length > 3 && (
                        <div className="pt-1">
                          <Button variant="link" className="h-auto p-0 text-sm font-semibold text-[#0E56F5]" onClick={() => navigate("/hot-sheets")}>View All</Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-9 rounded-xl bg-zinc-50/80 ring-1 ring-zinc-100">
                      <FileText className="w-10 h-10 mx-auto mb-3 text-zinc-400" />
                      <h4 className="text-sm font-semibold text-zinc-900 mb-1">No Hot Sheets yet</h4>
                      <p className="text-sm text-zinc-600 mb-4">
                        Create one to get property alerts, or ask your agent to share one.
                      </p>
                      <Button className={primaryCtaClass} onClick={() => navigate("/hot-sheets")}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Hot Sheet
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-zinc-200/70 shadow-[0_6px_20px_rgba(15,23,42,0.05)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold tracking-tight text-zinc-900">
                    Recently Viewed
                  </CardTitle>
                  <CardDescription>
                    Jump back into homes you explored most recently.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl bg-zinc-50/80 ring-1 ring-zinc-100 p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-zinc-700">No recently viewed homes yet.</p>
                      <p className="text-xs text-zinc-500 mt-1">As you browse, your history will appear here.</p>
                    </div>
                    <Button variant="outline" className="rounded-xl" onClick={() => navigate("/client/search")}>
                      Browse
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="rounded-2xl border-zinc-200/70 shadow-[0_6px_20px_rgba(15,23,42,0.05)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold tracking-tight text-zinc-900">
                    Your Buying Journey
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-200"
                      style={{ width: `${(currentJourneyStage / stageLabels.length) * 100}%` }}
                    />
                  </div>
                  <ol className="space-y-2">
                    {stageLabels.map((stage, index) => {
                      const stageNumber = index + 1;
                      const isCurrent = stageNumber === currentJourneyStage;
                      const isComplete = stageNumber < currentJourneyStage;
                      return (
                        <li key={stage} className="flex items-center gap-2.5 text-sm">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                              isCurrent
                                ? "bg-emerald-500 text-white"
                                : isComplete
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-zinc-100 text-zinc-500"
                            }`}
                          >
                            {stageNumber}
                          </span>
                          <span className={isCurrent ? "font-semibold text-zinc-900" : "text-zinc-600"}>{stage}</span>
                        </li>
                      );
                    })}
                  </ol>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-zinc-200/70 shadow-[0_6px_20px_rgba(15,23,42,0.05)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold tracking-tight text-zinc-900">Your Agent</CardTitle>
                </CardHeader>
                <CardContent>
                  {agent ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-14 w-14 ring-1 ring-zinc-200">
                          <AvatarImage src={agent.headshot_url || ""} />
                          <AvatarFallback>
                            {agent.first_name[0]}{agent.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-zinc-900">{agent.first_name} {agent.last_name}</h3>
                          <p className="text-sm text-zinc-500">{agent.company || "Independent Brokerage"}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          className={primaryCtaClass}
                          onClick={() => {
                            if (!crmClientId) {
                              toast.error("Unable to connect to your agent record.");
                              return;
                            }
                            setContactOpen(true);
                          }}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Message
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => {
                            if (agent.phone) {
                              window.location.href = `tel:${(agent.phone ?? "").replace(/\D/g, "")}`;
                            } else {
                              toast.message("Phone number unavailable");
                            }
                          }}
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Schedule Call
                        </Button>
                      </div>
                      <Button variant="ghost" className="w-full rounded-xl text-zinc-600" onClick={() => setShowEndDialog(true)}>
                        <UserX className="w-4 h-4 mr-2" />
                        End Relationship
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-zinc-600">
                        Continue your home search, keep your account active, and connect with a new agent when you're ready.
                      </p>
                      <Button className={primaryCtaClass} onClick={() => navigate("/client/search")}>
                        Continue Your Home Search
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-zinc-200/70 shadow-[0_6px_20px_rgba(15,23,42,0.05)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold tracking-tight text-zinc-900">Market Snapshot</CardTitle>
                  <CardDescription>{marketSnapshot.area}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Median Price</span>
                    <span className="font-semibold text-zinc-900">{marketSnapshot.medianPrice}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">New This Week</span>
                    <span className="font-semibold text-zinc-900">{marketSnapshot.newThisWeek}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Avg Days on Market</span>
                    <span className="font-semibold text-zinc-900">{marketSnapshot.avgDaysOnMarket}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-zinc-200/70 shadow-[0_6px_20px_rgba(15,23,42,0.05)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold tracking-tight text-zinc-900">Tasks / Next Steps</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => toggleTask(task.id)}
                      className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-zinc-50"
                    >
                      {task.done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-zinc-400 shrink-0" />
                      )}
                      <span className={`text-sm ${task.done ? "text-zinc-500 line-through" : "text-zinc-700"}`}>
                        {task.label}
                      </span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </section>

          <section>
            <PendingInvitesCard />
          </section>
        </div>
      </main>

      {/* Contact My Agent Dialog */}
      {crmClientId && (
        <ContactMyAgentDialog
          open={contactOpen}
          onOpenChange={setContactOpen}
          crmClientId={crmClientId}
          agentDisplayName={agent?.first_name || "your agent"}
        />
      )}

      {/* End Relationship Dialog */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              End relationship with {agent?.first_name} {agent?.last_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You can keep your account active after ending this relationship. Your saved homes,
              searches, and profile stay with you, and you can find a new agent any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndRelationship}>
              Yes, end relationship
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddFriendDialog open={addFriendOpen} onOpenChange={setAddFriendOpen} />
    </div>
  );
}

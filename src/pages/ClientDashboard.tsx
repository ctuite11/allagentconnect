import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Heart,
  UserX,
  Plus,
  MessageSquare,
  UserPlus,
  Search,
  Sparkles,
  Mail,
} from "lucide-react";
import { isDcmlsHost } from "@/lib/host";
import { clearPrimaryAgentId } from "@/utils/agentTracking";
import { toast } from "sonner";
import { AddFriendDialog } from "@/components/AddFriendDialog";
import { PendingInvitesCard } from "@/components/PendingInvitesCard";
import AACMonogram from "@/components/ui/AACMonogram";
import { useUnreadConversations } from "@/hooks/useUnreadConversations";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import {
  AlertDialog,
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

/** US-style display (e.g. (617) 770-5191); returns null if digits cannot be formatted cleanly. */
function formatUsPhoneForDisplay(raw: string | null | undefined): { display: string; telHref: string } | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  const core =
    digits.length === 11 && digits.startsWith("1")
      ? digits.slice(1)
      : digits.length === 10
        ? digits
        : null;
  if (!core || core.length !== 10) return null;
  return {
    display: `(${core.slice(0, 3)}) ${core.slice(3, 6)}-${core.slice(6)}`,
    telHref: `tel:+1${core}`,
  };
}

function DashboardListingImage({
  photoUrl,
  alt,
  imageClassName = "h-full w-full object-cover",
}: {
  photoUrl: string;
  alt: string;
  imageClassName?: string;
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const useMonogram = !photoUrl || photoUrl === "/placeholder.svg" || loadFailed;
  if (useMonogram) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50 text-[#0E56F5]" aria-hidden>
        <AACMonogram className="h-7 w-7" size={28} />
      </div>
    );
  }
  return (
    <img
      src={photoUrl}
      alt={alt}
      className={imageClassName}
      onError={() => setLoadFailed(true)}
    />
  );
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
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [buyerFirstName, setBuyerFirstName] = useState<string | null>(null);

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
      }

      return relationship.agent_id as string;
    }

    setRelationshipId(null);
    setAgent(null);
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
    toast.success("Relationship ended successfully.");
    clearPrimaryAgentId();
    setAgent(null);
    setRelationshipId(null);
    setShowEndDialog(false);

    window.setTimeout(() => {
      window.location.href = "https://directconnectmls.com";
    }, 450);
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
  const latestListingsPreview = marketListings.slice(0, 6);

  const stats = [
    {
      label: "Favorites",
      value: String(favorites.length),
      icon: Heart,
      subtle: null as string | null,
    },
    {
      label: "New Matches",
      value: marketListings.length > 0 ? String(Math.min(marketListings.length, 6)) : "--",
      icon: Sparkles,
      subtle: marketListings.length > 0 ? "On the market" : "Awaiting activity",
    },
    {
      label: "Unread Messages",
      value: String(unreadCount),
      icon: MessageSquare,
      subtle: unreadCount > 0 ? "Needs review" : "No new messages from your agent.",
    },
    {
      label: "Hot Sheets",
      value: String(activeSearches),
      icon: Search,
      subtle: activeSearches > 0 ? "Running alerts" : "No active alerts",
    },
  ];

  const primaryCtaClass =
    "rounded-lg bg-[#0E56F5] text-white shadow-sm transition-shadow duration-200 hover:bg-[#0B46CC] hover:shadow-md";
  const premiumCard =
    "bg-white rounded-2xl border border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_6px_18px_rgba(15,23,42,0.10)] transition-all duration-200";
  const premiumClickableCard =
    `${premiumCard} cursor-pointer hover:shadow-[0_8px_26px_rgba(15,23,42,0.14)] hover:-translate-y-[2px] active:translate-y-0`;
  const outlineSecondaryClass =
    "border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:bg-gray-50 hover:shadow-sm";
  const agentPhoneFmt = agent ? formatUsPhoneForDisplay(agent.phone) : null;

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
    <div className="min-h-screen bg-[#F7F8FA]">
      <main className="mx-auto w-full max-w-7xl px-6 md:px-8 py-8 pb-12">
        <div className="space-y-8">
          <section className={`${premiumCard} p-5 md:p-6`}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                    {buyerFirstName ? `Hi, ${buyerFirstName}` : "Welcome"}
                  </h1>
                  <p className="text-sm text-gray-500">Your dashboard — favorites, hot sheets, and new listings.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`rounded-md ${outlineSecondaryClass}`}
                    onClick={() => setAddFriendOpen(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add a Friend
                  </Button>
                  <Button size="sm" className={primaryCtaClass} onClick={() => navigate("/messages")}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Messages
                  </Button>
                </div>
              </div>
              <div className="relative w-full shrink-0 pt-2 lg:ms-auto lg:w-fit lg:max-w-[22rem] lg:pt-0">
                {agent ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={`absolute right-0 top-2 z-10 h-9 w-9 shrink-0 rounded-full bg-white lg:top-0 ${outlineSecondaryClass}`}
                      aria-label={unreadCount > 0 ? `Open messages, ${unreadCount} unread` : "Open messages"}
                      onClick={() => navigate("/messages")}
                    >
                      <MessageSquare className="h-4 w-4 text-gray-700" />
                      {unreadCount > 0 ? (
                        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      ) : null}
                    </Button>
                    <div className="flex flex-col items-center gap-2 pr-11 lg:pr-12">
                      <div className="flex max-w-full items-start gap-3">
                        <Avatar className="h-16 w-16 shrink-0 ring-1 ring-gray-200">
                          <AvatarImage src={agent.headshot_url || ""} />
                          <AvatarFallback className="text-sm font-medium text-gray-600">
                            {agent.first_name[0]}
                            {agent.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 max-w-[min(14rem,calc(100vw-8rem))] space-y-0.5 sm:max-w-[15rem]">
                          <p className="text-sm font-bold text-gray-900">
                            {agent.first_name} {agent.last_name}
                          </p>
                          {agent.company ? (
                            <p className="text-xs text-gray-500">{agent.company}</p>
                          ) : null}
                          {agentPhoneFmt ? (
                            <a
                              href={agentPhoneFmt.telHref}
                              className="block text-sm text-gray-800 hover:underline"
                            >
                              {agentPhoneFmt.display}
                            </a>
                          ) : null}
                          <a
                            href={`mailto:${agent.email}`}
                            className="block break-all text-xs leading-snug text-gray-600 hover:underline"
                          >
                            {agent.email}
                          </a>
                        </div>
                      </div>
                      <div className="flex w-full max-w-[19rem] shrink-0 flex-row flex-nowrap items-center justify-center gap-2 sm:gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`h-9 shrink-0 whitespace-nowrap rounded-md px-3 text-xs sm:text-sm ${outlineSecondaryClass}`}
                          onClick={() => {
                            window.location.href = `mailto:${agent.email}`;
                          }}
                        >
                          <Mail className="mr-1.5 h-4 w-4 shrink-0 sm:mr-2" />
                          Email
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 shrink-0 whitespace-nowrap rounded-md border border-red-200/80 bg-white px-2.5 text-xs text-red-700 shadow-sm transition-shadow duration-200 hover:bg-red-50 hover:shadow-sm sm:px-3 sm:text-sm"
                          onClick={() => setShowEndDialog(true)}
                        >
                          <UserX className="mr-1.5 h-4 w-4 shrink-0 sm:mr-2" />
                          End relationship
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-500 lg:text-right">No agent linked yet.</p>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {stats.map(({ label, value, icon: Icon, subtle }) => (
              <div
                key={label}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (label === "Favorites") navigate("/client/favorites");
                  if (label === "New Matches") navigate("/client/search");
                  if (label === "Unread Messages") navigate("/messages");
                  if (label === "Hot Sheets") navigate("/client/hot-sheets");
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  if (label === "Favorites") navigate("/client/favorites");
                  if (label === "New Matches") navigate("/client/search");
                  if (label === "Unread Messages") navigate("/messages");
                  if (label === "Hot Sheets") navigate("/client/hot-sheets");
                }}
                className={`${premiumClickableCard} p-5 md:p-6`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Icon className="h-5 w-5 text-[hsl(160_84%_39%)]" />
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">{value}</div>
                <div className="mt-1 text-sm font-medium text-gray-500">{label}</div>
                {subtle && <div className="mt-2 text-xs text-gray-400">{subtle}</div>}
              </div>
            ))}
          </section>

          <section className="space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className={`${premiumCard} overflow-visible`}>
                <div className="rounded-none bg-transparent">
                <CardHeader className="space-y-1 p-5 pb-3 md:p-6 md:pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base font-semibold text-gray-900">Hot Sheets</CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-8 rounded-md text-xs ${outlineSecondaryClass}`}
                      onClick={() => navigate("/hot-sheets")}
                    >
                      Manage
                    </Button>
                  </div>
                  <CardDescription className="text-sm text-gray-500">Alerts for saved searches.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-5 pt-0 md:p-6 md:pt-0">
                  {hotSheets.length > 0 ? (
                    <>
                      <Button className={`${primaryCtaClass} h-9 w-full text-sm sm:w-auto`} onClick={() => navigate("/hot-sheets")}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create hot sheet
                      </Button>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {hotSheets.slice(0, 6).map((sheet) => {
                        const hasNewListings =
                          Date.now() - new Date(sheet.created_at).getTime() < 1000 * 60 * 60 * 48;
                        const matchCount = hotSheetMatchCountById[sheet.id] ?? 0;
                        const token = shareTokenByHotSheetId[sheet.id];
                        return (
                          <div
                            key={sheet.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate(token ? `/client/hotsheet/${token}` : "/client/hot-sheets")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                navigate(token ? `/client/hotsheet/${token}` : "/client/hot-sheets");
                              }
                            }}
                            className={`${premiumClickableCard} overflow-hidden rounded-xl ${token ? "" : "opacity-80"}`}
                          >
                            <div className="relative flex h-[4.5rem] items-center justify-center bg-gray-50 text-[#0E56F5]">
                              <AACMonogram className="h-8 w-8" size={32} />
                              {hasNewListings && (
                                <span className="absolute left-1.5 top-1.5 rounded bg-[#0E56F5]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#0E56F5]">
                                  New
                                </span>
                              )}
                            </div>
                            <div className="space-y-0.5 p-2">
                              <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-gray-900">{sheet.name}</p>
                              <p className="text-[10px] text-gray-500">
                                {matchCount} {matchCount === 1 ? "match" : "matches"} · {sheet.is_active ? "Active" : "Paused"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                      <p className="max-w-md text-xs leading-relaxed text-gray-600">
                        No hot sheets yet. Create one for alerts, or ask your agent to share one.
                      </p>
                      <Button className={`${primaryCtaClass} h-9 shrink-0 px-4 text-sm`} onClick={() => navigate("/hot-sheets")}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create hot sheet
                      </Button>
                    </div>
                  )}
                </CardContent>
                </div>
              </div>

              <div className={`${premiumCard} overflow-hidden`}>
                <div className="rounded-none bg-transparent">
                <CardHeader className="space-y-1 p-5 pb-3 md:p-6 md:pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base font-semibold text-gray-900">Favorites</CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-8 rounded-md text-xs ${outlineSecondaryClass}`}
                      onClick={() => navigate("/favorites")}
                    >
                      View all
                    </Button>
                  </div>
                  <CardDescription className="text-sm text-gray-500">Homes you saved.</CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0 md:p-6 md:pt-0">
                  {favorites.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {favorites.slice(0, 6).map((fav) => {
                        const favPhotoUrl = getPrimaryPhotoUrl(fav.listing.photos);
                        return (
                          <button
                            key={fav.id}
                            type="button"
                            className={`${premiumClickableCard} overflow-hidden rounded-xl text-left`}
                            onClick={() => navigate(`/property/${fav.listing.id}`)}
                          >
                            <div className="relative h-[4.5rem] bg-gray-50">
                              <DashboardListingImage photoUrl={favPhotoUrl} alt="" />
                            </div>
                            <div className="space-y-0.5 p-2">
                              <p className="text-[11px] font-semibold text-gray-900">
                                {fav.listing.price ? `$${fav.listing.price.toLocaleString()}` : "—"}
                              </p>
                              <p className="line-clamp-2 text-[10px] font-medium leading-tight text-gray-800">{fav.listing.address}</p>
                              <p className="truncate text-[10px] text-gray-500">
                                {fav.listing.city}, {fav.listing.state}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-12">
                      <p className="max-w-sm text-sm text-gray-600">No favorites yet.</p>
                      <Button className={`${primaryCtaClass} h-9 shrink-0 px-4 text-sm`} onClick={() => navigate("/client/search")}>
                        <Search className="mr-2 h-4 w-4" />
                        Search homes
                      </Button>
                    </div>
                  )}
                </CardContent>
                </div>
              </div>
            </div>

            <div className={`${premiumCard} overflow-visible`}>
              <div className="rounded-none bg-transparent">
              <CardHeader className="p-5 pb-3 md:p-6 md:pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold text-gray-900">Market activity</CardTitle>
                    <CardDescription className="text-sm text-gray-500">New listings on the market.</CardDescription>
                  </div>
                  <Button className={`${primaryCtaClass} h-8 shrink-0 text-xs`} onClick={() => navigate("/client/search")}>
                    <Search className="mr-1.5 h-3.5 w-3.5" />
                    Search homes
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-visible p-5 pt-0 md:p-6 md:pt-0">
                {latestListingsPreview.length > 0 ? (
                  <div className="overflow-visible pt-2">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {latestListingsPreview.map((listing) => (
                      <article
                        key={listing.id}
                        role="button"
                        tabIndex={0}
                        className={`${premiumClickableCard}`}
                        onClick={() => navigate(`/property/${listing.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/property/${listing.id}`);
                          }
                        }}
                      >
                        <div className="overflow-hidden rounded-t-2xl">
                          <DashboardListingImage
                            photoUrl={getPrimaryPhotoUrl(listing.photos)}
                            alt={listing.address}
                            imageClassName="w-full h-[120px] object-cover object-center"
                          />
                        </div>
                        <div className="space-y-0.5 p-3">
                          <p className="text-[11px] font-semibold text-gray-900">
                            {listing.price ? `$${listing.price.toLocaleString()}` : "—"}
                          </p>
                          <p className="line-clamp-2 text-[10px] font-medium leading-tight text-gray-800">{listing.address}</p>
                          <p className="truncate text-[10px] text-gray-500">
                            {listing.city}, {listing.state}
                          </p>
                        </div>
                      </article>
                    ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                    <p className="text-sm text-gray-600">No listings to show yet.</p>
                    <Button className={`${primaryCtaClass} h-8 shrink-0 text-xs`} onClick={() => navigate("/client/search")}>
                      <Search className="mr-1.5 h-3.5 w-3.5" />
                      Search homes
                    </Button>
                  </div>
                )}
                {isDcmlsHost() ? (
                  <p className="mt-4 text-center text-xs leading-snug text-gray-400">
                    Listings shown may include homes published on{" "}
                    <a
                      href="https://directconnectmls.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-gray-500 underline-offset-2 hover:underline"
                    >
                      directconnectmls.com
                    </a>
                    .
                  </p>
                ) : null}
              </CardContent>
              </div>
            </div>
          </section>

          <section>
            <PendingInvitesCard />
          </section>
        </div>
      </main>

      {/* End Relationship Dialog */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End relationship?</AlertDialogTitle>
            <AlertDialogDescription>
              You will still have access to your dashboard using Direct Connect MLS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, cancel</AlertDialogCancel>
            <Button type="button" className={primaryCtaClass} onClick={() => void handleEndRelationship()}>
              Yes, end relationship
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddFriendDialog open={addFriendOpen} onOpenChange={setAddFriendOpen} />
    </div>
  );
}

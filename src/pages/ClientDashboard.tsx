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
  criteria: Record<string, unknown> | null;
  created_at: string;
  last_sent_at?: string | null;
  is_active: boolean;
  user_id?: string | null;
}

/** Matches `share_tokens` rows used by `HotSheets` buyer loader. */
interface ShareTokenRow {
  token: string;
  payload: unknown;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
}

/** Collage fills the same `aspect-[4/3]` media frame as favorites listing cards. */
function HotSheetPreviewCollage({ photoUrls }: { photoUrls: string[] }) {
  if (!photoUrls.length) {
    return (
      <div className="relative h-full min-h-0 w-full overflow-hidden bg-zinc-100">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 via-zinc-50 to-[#0E56F5]/10" />
        <div className="relative flex h-full items-center justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/90 shadow-[0_1px_6px_rgba(15,23,42,0.12)] ring-1 ring-white/70">
            <AACMonogram className="h-7 w-7 text-[#0E56F5]" size={28} />
          </div>
        </div>
      </div>
    );
  }

  if (photoUrls.length === 1) {
    return (
      <div className="relative h-full min-h-0 w-full overflow-hidden bg-zinc-100">
        <img src={photoUrls[0]} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  const collagePhotos = photoUrls.slice(0, 4);
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-zinc-100">
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-white">
        {collagePhotos.map((photoUrl, idx) => (
          <img key={`${photoUrl}-${idx}`} src={photoUrl} alt="" className="h-full w-full object-cover" />
        ))}
        {collagePhotos.length < 4 &&
          Array.from({ length: 4 - collagePhotos.length }).map((_, idx) => (
            <div key={`empty-${idx}`} className="bg-zinc-100" />
          ))}
      </div>
    </div>
  );
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
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [marketListings, setMarketListings] = useState<MarketListing[]>([]);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [buyerFirstName, setBuyerFirstName] = useState<string | null>(null);
  const [hotSheetPreviewPhotosById, setHotSheetPreviewPhotosById] = useState<Record<string, string[]>>({});

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
        loadBuyerHotSheetsForDashboard(user.id),
        loadFavorites(user.id),
        loadMarketListings(),
      ]);

      if (cameFromInviteAcceptance && !activeAgentId) {
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
        await loadAgentRelationship(user.id);
        await loadBuyerHotSheetsForDashboard(user.id);
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

  /**
   * Same logic as `loadBuyerHotSheets` in `src/pages/HotSheets.tsx`:
   * union `hot_sheet_clients` + accepted `share_tokens`, then load `hot_sheets`.
   */
  const loadBuyerHotSheetsForDashboard = async (userId: string) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle();

      const buyerEmailNorm = (profile?.email || authUser?.email || "").toLowerCase().trim();

      const allHotSheetIds = new Set<string>();

      const { data: hscRows, error: hscErr } = await supabase.from("hot_sheet_clients").select("hot_sheet_id");

      if (hscErr) {
        console.error("Failed to load hot_sheet_clients for dashboard", hscErr);
      } else {
        for (const row of hscRows || []) {
          const hid = (row as { hot_sheet_id?: string }).hot_sheet_id;
          if (hid) allHotSheetIds.add(hid);
        }
      }

      const { data: acceptedTokenRows, error: tokenErr } = await supabase
        .from("share_tokens")
        .select("token, payload, accepted_at, accepted_by_user_id")
        .not("accepted_at", "is", null);

      if (tokenErr) {
        console.error("Failed to load accepted tokens for dashboard", tokenErr);
      } else {
        for (const tokenRow of (acceptedTokenRows || []) as ShareTokenRow[]) {
          const payload =
            tokenRow.payload && typeof tokenRow.payload === "object"
              ? (tokenRow.payload as Record<string, unknown>)
              : {};
          if (payload.type !== "client_hotsheet_invite") continue;

          const hotSheetId = String(payload.hot_sheet_id || "");
          if (!hotSheetId) continue;

          const matchByUserId = tokenRow.accepted_by_user_id === userId;
          const tokenEmail = String(payload.client_email || "").toLowerCase().trim();
          const matchByEmail = Boolean(buyerEmailNorm && tokenEmail === buyerEmailNorm);

          if (matchByUserId || matchByEmail) {
            allHotSheetIds.add(hotSheetId);
          }
        }
      }

      if (!allHotSheetIds.size) {
        setHotSheets([]);
        setHotSheetPreviewPhotosById({});
        return;
      }

      const { data: hotSheetRows, error: sheetErr } = await supabase
        .from("hot_sheets")
        .select("id, name, user_id, criteria, created_at, is_active, last_sent_at")
        .in("id", [...allHotSheetIds])
        .order("created_at", { ascending: false });

      if (sheetErr) {
        console.error("Failed to load hot sheets on dashboard", sheetErr);
        setHotSheets([]);
        setHotSheetPreviewPhotosById({});
        return;
      }

      const loadedSheets = (hotSheetRows || []) as HotSheet[];
      setHotSheets(loadedSheets);
      await loadHotSheetPreviewPhotos(loadedSheets.slice(0, 3));
    } catch (e) {
      console.error("loadBuyerHotSheetsForDashboard", e);
      setHotSheets([]);
      setHotSheetPreviewPhotosById({});
    }
  };

  const loadHotSheetPreviewPhotos = async (sheets: HotSheet[]) => {
    if (!sheets.length) {
      setHotSheetPreviewPhotosById({});
      return;
    }

    const photoEntries = await Promise.all(
      sheets.map(async (sheet) => {
        try {
          const { data: listings, error } = await buildListingsQuery(supabase, sheet.criteria || {}).limit(4);
          if (error) {
            console.error("Failed to load preview listings for hot sheet", sheet.id, error);
            return [sheet.id, []] as const;
          }

          const photoUrls = (listings || [])
            .map((listing: any) => getPrimaryPhotoUrl(listing?.photos))
            .filter((url): url is string => Boolean(url && url !== "/placeholder.svg"))
            .slice(0, 4);

          return [sheet.id, photoUrls] as const;
        } catch (err) {
          console.error("Unexpected preview listing load error", sheet.id, err);
          return [sheet.id, []] as const;
        }
      })
    );

    setHotSheetPreviewPhotosById(Object.fromEntries(photoEntries));
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

  const latestListingsPreview = marketListings.slice(0, 4);

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
      value: String(hotSheets.length),
      icon: Search,
      subtle:
        hotSheets.length > 0
          ? `${hotSheets.length} saved search${hotSheets.length === 1 ? "" : "es"}`
          : "No hot sheets yet",
    },
  ];

  const primaryCtaClass =
    "rounded-lg bg-[#0E56F5] text-white shadow-sm transition-shadow duration-200 hover:bg-[#0B46CC] hover:shadow-md";
  /** AAC section shells and preview tiles (buyer dashboard). */
  const aacCardShell =
    "bg-white rounded-2xl border border-neutral-200 shadow-sm transition-all duration-200";
  const aacCardInteractive =
    `${aacCardShell} cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2`;
  const dashboardPreviewTile =
    "relative w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left shadow-sm transition-all hover:border-neutral-300 hover:shadow-md";
  const dashboardPreviewTileInteractive =
    `${dashboardPreviewTile} cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2`;
  /** Vertical listing-style previews (favorites & market sections). */
  const listingPreviewMediaWrap =
    "relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-neutral-50";
  const listingPreviewBody = "flex flex-col gap-2 p-4 text-left";
  const compactPreviewMediaWrap =
    "relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-neutral-50";
  const compactPreviewBody = "flex min-h-[5.25rem] flex-col gap-1.5 p-3 text-left";
  const outlineSecondaryClass =
    "border border-neutral-200 bg-white shadow-sm transition-shadow duration-200 hover:bg-neutral-50 hover:shadow-sm";
  const agentPhoneFmt = agent ? formatUsPhoneForDisplay(agent.phone) : null;

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">
          {relationshipHydrating ? "Connecting your inviting agent..." : "Loading your dashboard..."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto w-full max-w-7xl px-6 py-8 pb-12 md:px-8">
        <div className="space-y-8">
          <section className={`${aacCardShell} p-5 md:p-6`}>
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
                className={`${aacCardInteractive} p-5 md:p-6`}
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

          <section className="space-y-8">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className={`${aacCardShell} overflow-visible`}>
                <div className="rounded-none bg-transparent">
                  <CardHeader className="p-5 pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="text-base font-semibold text-gray-900">Hot Sheets</CardTitle>
                        <CardDescription className="text-sm text-gray-500">Alerts for saved searches.</CardDescription>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className={`h-8 rounded-md border text-xs font-medium text-gray-700 ${outlineSecondaryClass}`}
                          onClick={() => navigate("/hot-sheets/new")}
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5 text-gray-600" />
                          Create
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`h-8 rounded-md border text-xs font-medium text-gray-700 ${outlineSecondaryClass}`}
                          onClick={() => navigate("/client/hot-sheets")}
                        >
                          View all
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 pt-3">
                    {hotSheets.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {hotSheets.slice(0, 3).map((sheet) => {
                          const viewPath = `/client/hot-sheets/${sheet.id}`;
                          return (
                            <article
                              key={sheet.id}
                              role="button"
                              tabIndex={0}
                              className={`${dashboardPreviewTileInteractive} flex flex-col rounded-xl`}
                              onClick={() => navigate(viewPath)}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter" && e.key !== " ") return;
                                e.preventDefault();
                                navigate(viewPath);
                              }}
                            >
                              <div className={`${compactPreviewMediaWrap} shrink-0 rounded-t-xl`}>
                                <HotSheetPreviewCollage photoUrls={hotSheetPreviewPhotosById[sheet.id] || []} />
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className={`absolute right-2 top-2 z-10 h-8 w-8 rounded-full border ${outlineSecondaryClass}`}
                                      aria-label="Hot sheet menu"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreHorizontal className="h-3.5 w-3.5 text-gray-600" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="min-w-[10rem]"
                                    onCloseAutoFocus={(e) => e.preventDefault()}
                                  >
                                    <DropdownMenuItem
                                      className="cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!sheet.user_id) {
                                          toast.error("This hot sheet cannot be edited right now.");
                                          return;
                                        }
                                        setEditingHotSheetId(sheet.id);
                                        setEditingHotSheetOwnerUserId(sheet.user_id);
                                        setEditHotSheetDialogOpen(true);
                                      }}
                                    >
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setHotSheetDeleteId(sheet.id);
                                      }}
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                               <div className={`${compactPreviewBody} flex-1`}>
                                <p className="line-clamp-1 text-sm font-semibold leading-snug tracking-tight text-gray-900">
                                  {sheet.name}
                                </p>
                                <p className="line-clamp-2 text-xs font-medium leading-snug text-gray-600">
                                  {formatBuyerCriteriaSummary(sheet.criteria)}
                                </p>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                        <p className="max-w-md text-xs leading-relaxed text-gray-600">
                          No hot sheets yet. Create one for alerts, or ask your agent to share one.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-9 shrink-0 px-4 text-sm font-medium text-gray-800 ${outlineSecondaryClass}`}
                          onClick={() => navigate("/hot-sheets/new")}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Create hot sheet
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </div>
              </div>

              <div className={`${aacCardShell} overflow-hidden`}>
                <div className="rounded-none bg-transparent">
                <CardHeader className="space-y-1 p-5 pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base font-semibold text-gray-900">Favorites</CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-8 rounded-md border text-xs font-medium text-gray-700 ${outlineSecondaryClass}`}
                      onClick={() => navigate("/client/favorites")}
                    >
                      View all
                    </Button>
                  </div>
                  <CardDescription className="text-sm text-gray-500">Homes you saved.</CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-3">
                  {favorites.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {favorites.slice(0, 3).map((fav) => {
                        const favPhotoUrl = getPrimaryPhotoUrl(fav.listing.photos);
                        return (
                          <button
                            key={fav.id}
                            type="button"
                            className={`${dashboardPreviewTileInteractive} flex w-full flex-col rounded-xl`}
                            onClick={() => navigate(`/property/${fav.listing.id}`)}
                          >
                            <div className={`${compactPreviewMediaWrap} rounded-t-xl`}>
                              <DashboardListingImage
                                photoUrl={favPhotoUrl}
                                alt=""
                                imageClassName="absolute inset-0 h-full w-full object-cover"
                              />
                            </div>
                            <div className={compactPreviewBody}>
                              <p className="text-sm font-semibold tracking-tight text-gray-900">
                                {fav.listing.price ? `$${fav.listing.price.toLocaleString()}` : "—"}
                              </p>
                              <p className="line-clamp-1 text-xs font-medium leading-snug text-gray-800">
                                {fav.listing.address}
                              </p>
                              <p className="truncate text-xs text-gray-500">
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

            <div className={`${aacCardShell} overflow-visible`}>
              <div className="rounded-none bg-transparent">
              <CardHeader className="p-5 pb-3 md:p-6 md:pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold text-gray-900">Market activity</CardTitle>
                    <CardDescription className="text-sm text-gray-500">New listings on the market.</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-8 shrink-0 border text-xs font-medium text-gray-700 ${outlineSecondaryClass}`}
                    onClick={() => navigate("/client/search")}
                  >
                    <Search className="mr-1.5 h-3.5 w-3.5" />
                    Search homes
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-visible p-6 pt-4 md:p-7 md:pt-5">
                {latestListingsPreview.length > 0 ? (
                  <div className="overflow-visible">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {latestListingsPreview.map((listing) => (
                      <article
                        key={listing.id}
                        role="button"
                        tabIndex={0}
                        className={`${dashboardPreviewTileInteractive} flex flex-col`}
                        onClick={() => navigate(`/property/${listing.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/property/${listing.id}`);
                          }
                        }}
                      >
                        <div className={`${listingPreviewMediaWrap} rounded-t-2xl`}>
                          <DashboardListingImage
                            photoUrl={getPrimaryPhotoUrl(listing.photos)}
                            alt={listing.address}
                            imageClassName="absolute inset-0 h-full w-full object-cover"
                          />
                        </div>
                        <div className={listingPreviewBody}>
                          <p className="text-lg font-semibold tracking-tight text-gray-900">
                            {listing.price ? `$${listing.price.toLocaleString()}` : "—"}
                          </p>
                          <p className="line-clamp-2 text-sm font-medium leading-snug text-gray-800">{listing.address}</p>
                          <p className="truncate text-sm text-gray-500">
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

      <AlertDialog
        open={Boolean(hotSheetDeleteId)}
        onOpenChange={(open) => {
          if (!open && !hotSheetDeleteLoading) setHotSheetDeleteId(null);
        }}
      >
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this hot sheet?</AlertDialogTitle>
            <AlertDialogDescription>This will remove this hot sheet and its alerts.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={hotSheetDeleteLoading}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={hotSheetDeleteLoading}
              onClick={() => void handleConfirmDeleteDashboardHotSheet()}
            >
              {hotSheetDeleteLoading ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editingHotSheetId && editingHotSheetOwnerUserId ? (
        <CreateHotSheetDialog
          key={editingHotSheetId}
          open={editHotSheetDialogOpen}
          onOpenChange={(open) => {
            setEditHotSheetDialogOpen(open);
            if (!open) {
              setEditingHotSheetId(null);
              setEditingHotSheetOwnerUserId(null);
            }
          }}
          userId={editingHotSheetOwnerUserId}
          hotSheetId={editingHotSheetId}
          editMode
          onSuccess={() => {
            handleDashboardHotSheetEditSuccess();
          }}
        />
      ) : null}

      <AddFriendDialog open={addFriendOpen} onOpenChange={setAddFriendOpen} />
    </div>
  );
}

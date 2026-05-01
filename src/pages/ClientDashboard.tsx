import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Heart,
  UserX,
  MessageSquare,
  UserPlus,
  Search,
  Sparkles,
  Mail,
  MapPin,
  Bed,
  Bath,
  Maximize,
} from "lucide-react";
import { isDcmlsHost } from "@/lib/host";
import { clearPrimaryAgentId } from "@/utils/agentTracking";
import { toast } from "sonner";
import { AddFriendDialog } from "@/components/AddFriendDialog";
import { PendingInvitesCard } from "@/components/PendingInvitesCard";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
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
import {
  buyerAacPrimarySectionCta as aacPrimarySectionCta,
  buyerDashboardHotFavTile as unifiedHotFavCardClass,
  buyerDashboardHotFavTileBody as unifiedHotFavBody,
  buyerDashboardHotSheetMediaWrap as unifiedHotFavMediaWrap,
  buyerMarketListingTileBody as listingPreviewBody,
  buyerMarketListingTileMediaWrap as listingPreviewMediaWrap,
  buyerOutlineSecondary as outlineSecondaryClass,
  buyerPreviewCardInteractive as dashboardPreviewTileInteractive,
  buyerPreviewGrid as previewGridClass,
  buyerPreviewSectionContent as previewSectionContentClass,
  buyerPreviewSectionHeader as previewSectionHeaderClass,
  buyerPreviewSectionHeaderRow as previewSectionHeaderRowClass,
  buyerPreviewSectionMarketContent as previewSectionMarketContentClass,
  buyerPreviewSectionTitleWrap as previewSectionTitleWrapClass,
  buyerPrimaryCta as primaryCtaClass,
  buyerSectionCard as aacCardShell,
  buyerSectionDesc as dashSectionDescClass,
  buyerSectionTitle as dashSectionTitleClass,
  buyerStatCardInteractive as aacCardInteractive,
  buyerTileAddress as dashTileAddressClass,
  buyerTileSecondary as dashTileSecondaryClass,
  buyerTileTitle as dashTileTitleClass,
  buyerPageMain,
  buyerPageShell,
  buyerPageStack,
} from "@/lib/buyerUi";
import { DashboardListingImage } from "@/components/buyer/DashboardListingImage";
import { BuyerHotSheetPreviewCard } from "@/components/buyer/BuyerHotSheetPreviewCard";
import { useAgentLastSeen } from "@/hooks/useAgentLastSeen";
import { loadHotSheetPhotosAndCounts } from "@/lib/hotSheetPreviewData";
import {
  resolveListedByAttribution,
  type ListedByAgentProfile,
  type ListedBySource,
} from "@/lib/listingListedBy";

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
  agent_id?: string | null;
  agent_profile?: ListedByAgentProfile;
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
  const [hotSheetPreviewMatchCountsById, setHotSheetPreviewMatchCountsById] = useState<Record<string, number>>({});
  const [hotSheetDeleteId, setHotSheetDeleteId] = useState<string | null>(null);
  const [hotSheetDeleteLoading, setHotSheetDeleteLoading] = useState(false);
  const [editingHotSheetId, setEditingHotSheetId] = useState<string | null>(null);
  const [editingHotSheetOwnerUserId, setEditingHotSheetOwnerUserId] = useState<string | null>(null);
  const [editHotSheetDialogOpen, setEditHotSheetDialogOpen] = useState(false);

  const { isOnline: agentPresenceOnline } = useAgentLastSeen(agent?.id);

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
    try {
      // Prefer local session first (instant); getUser hits network and can transiently disagree with RouteGuard.
      const sessionResult = await supabase.auth.getSession();
      let user = sessionResult.data.session?.user ?? null;
      if (!user) {
        const { data: refreshed } = await supabase.auth.getUser();
        user = refreshed.user ?? null;
      }

      if (!user) {
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
      }
    } finally {
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
        setHotSheetPreviewMatchCountsById({});
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
        setHotSheetPreviewMatchCountsById({});
        return;
      }

      const loadedSheets = (hotSheetRows || []) as HotSheet[];
      setHotSheets(loadedSheets);
      await loadHotSheetPreviewPhotos(loadedSheets.slice(0, 3));
    } catch (e) {
      console.error("loadBuyerHotSheetsForDashboard", e);
      setHotSheets([]);
      setHotSheetPreviewPhotosById({});
      setHotSheetPreviewMatchCountsById({});
    }
  };

  const loadHotSheetPreviewPhotos = async (sheets: HotSheet[]) => {
    if (!sheets.length) {
      setHotSheetPreviewPhotosById({});
      setHotSheetPreviewMatchCountsById({});
      return;
    }

    const { photosById, countsById } = await loadHotSheetPhotosAndCounts(
      supabase,
      sheets.map((s) => ({ id: s.id, criteria: s.criteria })),
    );
    setHotSheetPreviewPhotosById(photosById);
    setHotSheetPreviewMatchCountsById(countsById);
  };

  const handleDashboardHotSheetEditSuccess = async (
    hotSheetId: string,
    updatedHotSheet?: { id: string; name: string; criteria: Record<string, unknown> | null }
  ) => {
    if (updatedHotSheet) {
      setHotSheets((prev) =>
        prev.map((sheet) =>
          sheet.id === hotSheetId
            ? {
                ...sheet,
                name: updatedHotSheet.name,
                criteria: updatedHotSheet.criteria,
              }
            : sheet
        )
      );
      return;
    }
    if (currentUserId) await loadBuyerHotSheetsForDashboard(currentUserId);
  };

  const handleConfirmDeleteDashboardHotSheet = async () => {
    if (!hotSheetDeleteId || hotSheetDeleteLoading) return;
    const id = hotSheetDeleteId;
    setHotSheetDeleteLoading(true);

    const { error: clientsError } = await supabase
      .from("hot_sheet_clients")
      .delete()
      .eq("hot_sheet_id", id);

    if (clientsError) {
      console.error("Delete hot_sheet_clients failed:", clientsError);
      toast.error("Unable to delete this hot sheet.");
      setHotSheetDeleteLoading(false);
      return;
    }

    const { error: sheetError } = await supabase.from("hot_sheets").delete().eq("id", id);

    if (sheetError) {
      console.error("Delete hot_sheets failed:", sheetError);
      toast.error("Unable to delete this hot sheet.");
      setHotSheetDeleteLoading(false);
      return;
    }

    toast.success("Hot sheet deleted");
    setHotSheets((prev) => prev.filter((sheet) => sheet.id !== id));
    setHotSheetPreviewPhotosById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setHotSheetPreviewMatchCountsById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setHotSheetDeleteLoading(false);
    setHotSheetDeleteId(null);
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

    if (!data) {
      setFavorites([]);
      return;
    }

    type Row = typeof data[number] & { listing?: Favorite["listing"] | Favorite["listing"][] | null };
    const normalized = (data as Row[])
      .map((row) => {
        const raw = row.listing;
        const single = Array.isArray(raw) ? raw[0] : raw;
        if (single == null) return null;
        return { ...row, listing: single } as Favorite;
      })
      .filter((r): r is Favorite => r != null);

    setFavorites(normalized);
  };

  const loadMarketListings = async () => {
    const { data, error } = await supabase
      .from("listings")
      .select(
        "id, address, city, state, price, bedrooms, bathrooms, square_feet, photos, created_at, agent_id",
      )
      .in("status", ["coming_soon", "active", "back_on_market"])
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      console.error("Failed to load market listings", error);
      setMarketListings([]);
      return;
    }

    const rows = (data || []) as MarketListing[];
    const agentIds = Array.from(
      new Set(rows.map((r) => r.agent_id).filter((id): id is string => Boolean(id))),
    );
    if (agentIds.length === 0) {
      setMarketListings(rows);
      return;
    }

    const { data: agents, error: agentsErr } = await supabase
      .from("agent_profiles")
      .select("id, first_name, last_name, company, office_name")
      .in("id", agentIds);

    if (agentsErr || !agents?.length) {
      setMarketListings(rows);
      return;
    }

    const byId = new Map(agents.map((a) => [a.id, a]));
    setMarketListings(
      rows.map((r) => {
        const aid = r.agent_id;
        if (typeof aid !== "string" || !byId.has(aid)) return r;
        const a = byId.get(aid)!;
        return {
          ...r,
          agent_profile: {
            company: a.company,
            office_name: a.office_name,
            first_name: a.first_name,
            last_name: a.last_name,
          },
        };
      }),
    );
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

  const latestListingsPreview = (marketListings || [])
    .filter((l): l is MarketListing => l != null && Boolean(l.id))
    .slice(0, 4);

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

  const agentPhoneFmt = agent ? formatUsPhoneForDisplay(agent.phone) : null;

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 ${buyerPageShell}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">
          {relationshipHydrating ? "Connecting your inviting agent..." : "Loading your dashboard..."}
        </p>
      </div>
    );
  }

  return (
    <div className={buyerPageShell}>
      <main className={buyerPageMain}>
        <div className={buyerPageStack}>
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
                    type="button"
                    className={`h-9 rounded-full px-4 ${outlineSecondaryClass}`}
                    onClick={() => setAddFriendOpen(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add a Friend
                  </Button>
                  <Button size="sm" className={`h-9 ${primaryCtaClass}`} onClick={() => navigate("/messages")}>
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
                          <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
                            {agentPresenceOnline ? (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full bg-[#50C878]"
                                title="Recently active"
                                aria-label="Recently active"
                              />
                            ) : null}
                            <span>
                              {agent.first_name} {agent.last_name}
                            </span>
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

          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map(({ label, value, icon: Icon, subtle }) => (
              <div
                key={label}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (label === "Favorites") navigate("/favorites");
                  if (label === "New Matches") navigate("/client/search");
                  if (label === "Unread Messages") navigate("/messages");
                  if (label === "Hot Sheets") navigate("/hot-sheets");
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  if (label === "Favorites") navigate("/favorites");
                  if (label === "New Matches") navigate("/client/search");
                  if (label === "Unread Messages") navigate("/messages");
                  if (label === "Hot Sheets") navigate("/hot-sheets");
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
                  <CardHeader className={previewSectionHeaderClass}>
                    <div className={previewSectionHeaderRowClass}>
                      <div className={previewSectionTitleWrapClass}>
                        <CardTitle className={dashSectionTitleClass}>Hot Sheets</CardTitle>
                        <CardDescription className={`${dashSectionDescClass} mt-0 p-0`}>
                          Alerts for saved searches.
                        </CardDescription>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          className={aacPrimarySectionCta}
                          onClick={() => navigate("/hot-sheets")}
                        >
                          View all
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className={previewSectionContentClass}>
                    {hotSheets.length > 0 ? (
                      <div className={previewGridClass}>
                        {hotSheets.slice(0, 3).map((sheet) => {
                          const viewPath = `/client/hot-sheets/${sheet.id}`;
                          return (
                            <BuyerHotSheetPreviewCard
                              key={sheet.id}
                              photoUrls={hotSheetPreviewPhotosById[sheet.id] || []}
                              title={sheet.name}
                              subtitle={`${hotSheetPreviewMatchCountsById[sheet.id] ?? 0} matches`}
                              onClick={() => navigate(viewPath)}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter" && e.key !== " ") return;
                                e.preventDefault();
                                navigate(viewPath);
                              }}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                        <p className={`max-w-md ${dashSectionDescClass}`}>
                          No hot sheets yet. Create one from Hot Sheets for alerts, or ask your agent to share one.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </div>
              </div>

              <div className={`${aacCardShell} overflow-hidden`}>
                <div className="rounded-none bg-transparent">
                <CardHeader className={previewSectionHeaderClass}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className={previewSectionTitleWrapClass}>
                      <CardTitle className={dashSectionTitleClass}>Favorites</CardTitle>
                      <CardDescription className={`${dashSectionDescClass} mt-0 p-0`}>Homes you saved.</CardDescription>
                    </div>
                    <Button type="button" className={aacPrimarySectionCta} onClick={() => navigate("/favorites")}>
                      View all
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className={previewSectionContentClass}>
                  {favorites.length > 0 ? (
                    <div className="grid grid-cols-3 gap-4">
                      {favorites
                        .filter((fav) => fav.listing != null)
                        .slice(0, 3)
                        .map((fav) => {
                          const listing = fav.listing;
                          const photos = listing.photos ?? [];
                          const favPhotoUrl = getPrimaryPhotoUrl(photos);
                          return (
                            <button
                              key={fav.id}
                              type="button"
                              className={unifiedHotFavCardClass}
                              onClick={() => navigate(`/property/${listing.id}`)}
                            >
                              <div className={unifiedHotFavMediaWrap}>
                                <DashboardListingImage
                                  photoUrl={favPhotoUrl}
                                  alt=""
                                  imageClassName="absolute inset-0 h-full w-full object-cover"
                                />
                              </div>
                              <div className={unifiedHotFavBody}>
                                <p className={dashTileTitleClass}>
                                  {listing.price ? `$${listing.price.toLocaleString()}` : "—"}
                                </p>
                                <p className={`flex min-w-0 items-center gap-1 ${dashTileAddressClass}`}>
                                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[#50C878]" aria-hidden strokeWidth={2} />
                                  <span className="min-w-0 truncate">{listing.address}</span>
                                </p>
                                <p className={`flex min-w-0 items-center gap-1 truncate ${dashTileSecondaryClass}`}>
                                  <span className="min-w-0 truncate">
                                    {listing.city}, {listing.state}
                                  </span>
                                </p>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                      <p className={`max-w-sm ${dashSectionDescClass}`}>No favorites yet.</p>
                      <Button type="button" className={aacPrimarySectionCta} onClick={() => navigate("/client/search")}>
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
              <CardHeader className={previewSectionHeaderClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className={previewSectionTitleWrapClass}>
                    <CardTitle className={dashSectionTitleClass}>Market activity</CardTitle>
                    <CardDescription className={`${dashSectionDescClass} mt-0 p-0`}>
                      New listings on Direct Connect MLS.
                    </CardDescription>
                  </div>
                  <Button type="button" className={aacPrimarySectionCta} onClick={() => navigate("/client/search")}>
                    <Search className="mr-1.5 h-3.5 w-3.5" />
                    Search homes
                  </Button>
                </div>
              </CardHeader>
              <CardContent className={previewSectionMarketContentClass}>
                {latestListingsPreview.length > 0 ? (
                  <div className="overflow-visible">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {latestListingsPreview.map((listing) => {
                      const photos = listing.photos ?? [];
                      const listedBy = resolveListedByAttribution(
                        listing as ListedBySource,
                        listing.agent_profile ?? null,
                      );
                      return (
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
                        <div className={listingPreviewMediaWrap}>
                          <DashboardListingImage
                            photoUrl={getPrimaryPhotoUrl(photos)}
                            alt={listing.address}
                            imageClassName="absolute inset-0 h-full w-full object-cover"
                          />
                        </div>
                        <div className={listingPreviewBody}>
                          <p className={dashTileTitleClass}>{listing.price ? `$${listing.price.toLocaleString()}` : "—"}</p>
                          <p className={`flex min-w-0 items-center gap-1 ${dashTileAddressClass}`}>
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#50C878]" aria-hidden strokeWidth={2} />
                            <span className="min-w-0 truncate">{listing.address}</span>
                          </p>
                          <p className={`flex min-w-0 items-center gap-1 truncate ${dashTileSecondaryClass}`}>
                            <span className="min-w-0 truncate">
                              {listing.city}, {listing.state}
                            </span>
                          </p>
                          <div className="flex items-center gap-6 text-lg mt-1 text-neutral-950">
                            {listing.bedrooms ? (
                              <div className="flex items-center gap-1.5">
                                <Bed className="h-5 w-5 text-neutral-700" aria-hidden />
                                <span className="font-semibold">{listing.bedrooms}</span>
                              </div>
                            ) : null}
                            {listing.bathrooms ? (
                              <div className="flex items-center gap-1.5">
                                <Bath className="h-5 w-5 text-neutral-700" aria-hidden />
                                <span className="font-semibold">{listing.bathrooms}</span>
                              </div>
                            ) : null}
                            {listing.square_feet ? (
                              <div className="flex items-center gap-1.5">
                                <Maximize className="h-5 w-5 text-neutral-700" aria-hidden />
                                <span className="font-semibold">{listing.square_feet.toLocaleString()}</span>
                              </div>
                            ) : null}
                          </div>
                          {listedBy ? (
                            <p
                              className="mt-2 truncate text-[12px] font-normal text-neutral-500"
                              title={`Listed by: ${listedBy}`}
                            >
                              Listed by: {listedBy}
                            </p>
                          ) : null}
                        </div>
                      </article>
                      );
                    })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                    <p className={dashSectionDescClass}>No listings to show yet.</p>
                    <Button type="button" className={aacPrimarySectionCta} onClick={() => navigate("/client/search")}>
                      <Search className="mr-1.5 h-3.5 w-3.5" />
                      Search homes
                    </Button>
                  </div>
                )}
                {isDcmlsHost() ? (
                  <p className={`mt-4 text-center ${dashSectionDescClass}`}>
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
            <Button type="button" className={`h-9 px-5 ${primaryCtaClass}`} onClick={() => void handleEndRelationship()}>
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
          onSuccess={handleDashboardHotSheetEditSuccess}
        />
      ) : null}
      <AddFriendDialog open={addFriendOpen} onOpenChange={setAddFriendOpen} />
    </div>
  );
}

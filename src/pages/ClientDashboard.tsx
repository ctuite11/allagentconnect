import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Heart, Flame, Sparkle, MessageSquare } from "lucide-react";
import { clearPrimaryAgentId } from "@/utils/agentTracking";
import { toast } from "sonner";
import { AddFriendDialog } from "@/components/AddFriendDialog";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { useUnreadConversations } from "@/hooks/useUnreadConversations";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buyerPageMain, buyerPageShell } from "@/lib/buyerUi";
import { ClientDashboardView } from "@/components/buyer/ClientDashboardView";
import { ContactMyAgentDialog } from "@/components/ContactMyAgentDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Seo } from "@/components/Seo";
import { useAgentLastSeen } from "@/hooks/useAgentLastSeen";
import { loadHotSheetPhotosAndCounts } from "@/lib/hotSheetPreviewData";
import { deleteHotSheetWithClientLinks } from "@/lib/deleteHotSheetBuyerAuthorized";
import { loadBuyerHotSheetAccess } from "@/lib/loadBuyerHotSheetAccess";
import { consumeInviteAcceptance } from "@/lib/inviteAcceptanceHandoff";
import type { ListedByAgentProfile } from "@/lib/listingListedBy";
import { loadBuyerGenericFavorites } from "@/lib/loadBuyerFavorites";
import type { ClientDashboardFavoriteRow } from "@/components/buyer/ClientDashboardView";

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
  listing_number?: string | null;
  unit_number?: string | null;
  condo_details?: unknown;
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
  const [favorites, setFavorites] = useState<ClientDashboardFavoriteRow[]>([]);
  const [marketListings, setMarketListings] = useState<MarketListing[]>([]);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [buyerDisplayName, setBuyerDisplayName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState<string | null>(null);
  const [buyerPhoneRaw, setBuyerPhoneRaw] = useState<string | null>(null);
  const [hotSheetPreviewPhotosById, setHotSheetPreviewPhotosById] = useState<Record<string, string[]>>({});
  const [hotSheetPreviewMatchCountsById, setHotSheetPreviewMatchCountsById] = useState<Record<string, number>>({});
  const [hotSheetDeleteId, setHotSheetDeleteId] = useState<string | null>(null);
  const [hotSheetDeleteLoading, setHotSheetDeleteLoading] = useState(false);
  const [editingHotSheetId, setEditingHotSheetId] = useState<string | null>(null);
  const [editingHotSheetOwnerUserId, setEditingHotSheetOwnerUserId] = useState<string | null>(null);
  const [editHotSheetDialogOpen, setEditHotSheetDialogOpen] = useState(false);
  const [contactAgentEmailOpen, setContactAgentEmailOpen] = useState(false);
  /** True only when initial boot fails before identity is committed — full-page retry (partial fetch failures keep the dashboard). */
  const [loadError, setLoadError] = useState(false);

  const { isOnline: agentPresenceOnline } = useAgentLastSeen(agent?.id);
  const { isOnline: buyerPresenceOnline } = useAgentLastSeen(currentUserId ?? undefined);

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

  const consumeInviteHandoffMarker = (): { fresh: boolean; hotSheetId: string | null } => {
    return consumeInviteAcceptance();
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

      setLoadError(false);

      let identityReady = false;
      try {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("first_name, last_name, phone")
          .eq("id", user.id)
          .maybeSingle();
        const first = sanitizeFirstName(profileRow?.first_name);
        const lastRaw = profileRow?.last_name?.trim();
        const last = lastRaw && !lastRaw.includes("@") ? lastRaw : null;
        const firstFallback = await resolveBuyerGreetingName(
          user.id,
          user.email,
          (user.user_metadata?.display_name as string | undefined) ?? null,
        );
        const firstLine = first ?? firstFallback;
        const display = [firstLine, last].filter(Boolean).join(" ").trim();
        setBuyerDisplayName(display || (user.email ?? ""));
        setBuyerEmail(user.email ?? null);
        setBuyerPhoneRaw(profileRow?.phone ?? null);

        const cameFromInviteAcceptance = consumeInviteHandoffMarker();
        if (cameFromInviteAcceptance) {
          setRelationshipHydrating(true);
        }

        setCurrentUserId(user.id);
        identityReady = true;

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
      } catch (bootErr: unknown) {
        console.error("[ClientDashboard] dashboard boot failed:", bootErr);
        if (!identityReady) {
          setLoadError(true);
          toast.error("Couldn't load your dashboard.");
        } else {
          toast.error("Some dashboard data couldn't load. You can refresh or try again later.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const retryDashboardLoad = () => {
    setLoadError(false);
    setLoading(true);
    void checkAuth();
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
   * Buyer hot sheets via shared loader (RLS-safe).
   * Returns the loaded list so the boot path can decide whether to retry.
   */
  const loadBuyerHotSheetsForDashboard = async (userId: string): Promise<HotSheet[]> => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle();

      const { rows } = await loadBuyerHotSheetAccess(
        supabase,
        userId,
        profile?.email || authUser?.email || null,
      );

      const loadedSheets = rows as HotSheet[];
      setHotSheets(loadedSheets);
      if (loadedSheets.length) {
        await loadHotSheetPreviewPhotos(loadedSheets.slice(0, 3));
      } else {
        setHotSheetPreviewPhotosById({});
        setHotSheetPreviewMatchCountsById({});
      }
      return loadedSheets;
    } catch (e) {
      console.error("loadBuyerHotSheetsForDashboard", e);
      setHotSheets([]);
      setHotSheetPreviewPhotosById({});
      setHotSheetPreviewMatchCountsById({});
      return [];
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

    const { error: delErr } = await deleteHotSheetWithClientLinks(supabase, id);
    if (delErr) {
      console.error("Delete hot sheet failed:", delErr);
      toast.error(delErr.message || "Unable to delete this hot sheet.");
      setHotSheetDeleteLoading(false);
      return;
    }

    toast.success("Hot sheet deleted for your group");
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
    const rows = await loadBuyerGenericFavorites(supabase, userId, "buyer_self", { limit: 6 });
    setFavorites(rows);
  };

  const refreshFavoritesPreview = useCallback(async () => {
    if (!currentUserId) return;
    await loadFavorites(currentUserId);
  }, [currentUserId]);

  const loadMarketListings = async () => {
    const { data, error } = await supabase
      .from("listings")
      .select(
        "id, address, city, state, price, bedrooms, bathrooms, square_feet, photos, created_at, listing_number, unit_number, condo_details, agent_id",
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
      icon: Sparkle,
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
      icon: Flame,
      subtle:
        hotSheets.length > 0
          ? `${hotSheets.length} saved search${hotSheets.length === 1 ? "" : "es"}`
          : "No hot sheets yet",
    },
  ];

  const agentPhoneFmt = agent ? formatUsPhoneForDisplay(agent.phone) : null;
  const buyerPhoneFmt = formatUsPhoneForDisplay(buyerPhoneRaw);

  if (loading) {
    return (
      <>
        <Seo
          title="Dashboard | All Agent Connect"
          description="Your saved homes, hot sheets, market activity, and agent updates in one place."
          canonical="https://allagentconnect.com/client/dashboard"
          noindex
        />
        <div className={buyerPageShell}>
          <main className={buyerPageMain}>
            <div
              className="space-y-6 md:space-y-7"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <span className="sr-only">
                {relationshipHydrating
                  ? "Connecting your inviting agent…"
                  : "Loading your dashboard…"}
              </span>

              <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                  <div className="min-w-0 flex-1 space-y-3">
                    <Skeleton className="h-8 w-[min(100%,18rem)] rounded-md bg-neutral-100" />
                    <Skeleton className="h-4 w-full max-w-md rounded-md bg-neutral-100" />
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Skeleton className="h-9 w-24 rounded-full bg-neutral-100" />
                      <Skeleton className="h-9 w-28 rounded-full bg-neutral-100" />
                      <Skeleton className="h-9 w-32 rounded-full bg-neutral-100" />
                    </div>
                  </div>
                  <div className="flex w-full shrink-0 gap-3 lg:w-auto lg:max-w-[22rem]">
                    <Skeleton className="h-16 w-16 shrink-0 rounded-full bg-neutral-100" />
                    <div className="min-w-0 flex-1 space-y-2 pt-1">
                      <Skeleton className="h-4 w-36 rounded-md bg-neutral-100" />
                      <Skeleton className="h-3 w-48 rounded-md bg-neutral-100" />
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5"
                  >
                    <Skeleton className="h-4 w-4 rounded bg-neutral-100" />
                    <Skeleton className="mt-3 h-7 w-12 rounded-md bg-neutral-100" />
                    <Skeleton className="mt-2 h-3 w-24 rounded-md bg-neutral-100" />
                  </div>
                ))}
              </section>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
                <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                  <div className="border-b border-neutral-100 px-5 pb-4 pt-5 md:px-6 md:pb-5">
                    <Skeleton className="h-4 w-28 rounded-md bg-neutral-100" />
                    <Skeleton className="mt-2 h-3 w-48 rounded-md bg-neutral-100" />
                  </div>
                  <div className="px-5 pb-6 pt-4 md:px-6">
                    <Skeleton className="h-44 w-full rounded-xl bg-neutral-100" />
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                  <div className="border-b border-neutral-100 px-5 pb-4 pt-5 md:px-6 md:pb-5">
                    <Skeleton className="h-4 w-24 rounded-md bg-neutral-100" />
                    <Skeleton className="mt-2 h-3 w-40 rounded-md bg-neutral-100" />
                  </div>
                  <div className="grid grid-cols-3 gap-4 px-5 pb-6 pt-4 md:px-6">
                    {[1, 2, 3].map((j) => (
                      <Skeleton key={j} className="aspect-[4/5] w-full rounded-xl bg-neutral-100" />
                    ))}
                  </div>
                </div>
              </div>

              <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <div className="border-b border-neutral-100 px-5 pb-4 pt-5 md:px-6 md:pb-5">
                  <Skeleton className="h-4 w-36 rounded-md bg-neutral-100" />
                  <Skeleton className="mt-2 h-3 max-w-sm rounded-md bg-neutral-100" />
                </div>
                <div className="overflow-visible px-5 pb-6 pt-0 md:px-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[1, 2, 3, 4].map((k) => (
                      <div key={k} className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
                        <Skeleton className="h-48 w-full rounded-none bg-neutral-100" />
                        <div className="space-y-2 p-4">
                          <Skeleton className="h-4 w-[75%] rounded-md bg-neutral-100" />
                          <Skeleton className="h-3 w-full rounded-md bg-neutral-100" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </main>
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <Seo
          title="Dashboard | All Agent Connect"
          description="Your saved homes, hot sheets, market activity, and agent updates in one place."
          canonical="https://allagentconnect.com/client/dashboard"
          noindex
        />
        <div className={buyerPageShell}>
          <main className={buyerPageMain}>
            <div className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm md:p-10">
              <p className="text-sm font-medium text-neutral-900">Couldn&apos;t load your dashboard</p>
              <p className="mt-2 text-sm text-neutral-600">
                Check your connection and try again.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-5 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-zinc-400/40"
                onClick={() => void retryDashboardLoad()}
              >
                Try again
              </Button>
            </div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <Seo
        title="Dashboard | All Agent Connect"
        description="Your saved homes, hot sheets, market activity, and agent updates in one place."
        canonical="https://allagentconnect.com/client/dashboard"
        noindex
      />
      <ClientDashboardView
        variant="buyer"
        navigate={navigate}
        buyerDisplayName={buyerDisplayName}
        buyerEmail={buyerEmail}
        buyerPhoneFmt={buyerPhoneFmt}
        buyerPresenceOnline={buyerPresenceOnline}
        agent={agent}
        agentPresenceOnline={agentPresenceOnline}
        agentPhoneFmt={agentPhoneFmt}
        unreadCount={unreadCount}
        stats={stats}
        hotSheets={hotSheets}
        hotSheetPreviewPhotosById={hotSheetPreviewPhotosById}
        hotSheetPreviewMatchCountsById={hotSheetPreviewMatchCountsById}
        favorites={favorites}
        latestListingsPreview={latestListingsPreview}
        getHotSheetCardPath={(sheetId) => `/client/hot-sheets/${sheetId}`}
        showBuyerSelfServiceChrome
        setAddFriendOpen={setAddFriendOpen}
        setShowEndDialog={setShowEndDialog}
        onRequestDeleteHotSheet={(sheetId) => setHotSheetDeleteId(sheetId)}
        onBuyerMarketFavoriteToggle={refreshFavoritesPreview}
        onAgentEmailPrimary={() => setContactAgentEmailOpen(true)}
        onBuyerEmailPrimary={() => setContactAgentEmailOpen(true)}
      />

      {agent ? (
        <ContactMyAgentDialog
          open={contactAgentEmailOpen}
          onOpenChange={setContactAgentEmailOpen}
          agentUserId={agent.id}
          agentDisplayName={`${agent.first_name} ${agent.last_name}`.trim()}
        />
      ) : null}

      {/* End Relationship Dialog */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent className="border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:rounded-xl">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle className="text-lg font-semibold text-neutral-900">End relationship?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-snug text-neutral-500">
              You will still have access to your dashboard using Direct Connect MLS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 border-neutral-200 text-[13px] hover:bg-neutral-50/90">No, cancel</AlertDialogCancel>
            <Button
              type="button"
              className="h-9 bg-neutral-900 px-5 text-[13px] text-white shadow-sm hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2"
              onClick={() => void handleEndRelationship()}
            >
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
        <AlertDialogContent
          className="border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:rounded-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle className="text-lg font-semibold text-neutral-900">Delete this hot sheet for everyone?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed text-neutral-500">
              This removes{" "}
              <strong className="font-medium text-foreground">
                {hotSheets.find((s) => s.id === hotSheetDeleteId)?.name ?? "this hot sheet"}
              </strong>{" "}
              for the whole shared group — friends or family on the same sheet lose access too — and stops alerts. Your agent will
              no longer see it on your activity. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 border-neutral-200 text-[13px] hover:bg-neutral-50/90" disabled={hotSheetDeleteLoading}>
              Cancel
            </AlertDialogCancel>
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
    </>
  );
}

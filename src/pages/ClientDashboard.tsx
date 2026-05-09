import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Heart, Search, Sparkles, MessageSquare } from "lucide-react";
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
import { buyerPageShell, buyerPrimaryCta as primaryCtaClass } from "@/lib/buyerUi";
import { ClientDashboardView } from "@/components/buyer/ClientDashboardView";
import { useAgentLastSeen } from "@/hooks/useAgentLastSeen";
import { loadHotSheetPhotosAndCounts } from "@/lib/hotSheetPreviewData";
import { deleteHotSheetWithClientLinks } from "@/lib/deleteHotSheetBuyerAuthorized";
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

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("first_name, last_name")
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
    <>
      <ClientDashboardView
        variant="buyer"
        navigate={navigate}
        buyerDisplayName={buyerDisplayName}
        buyerEmail={buyerEmail}
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
      />

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
            <AlertDialogTitle>Delete this hot sheet for everyone?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes{" "}
              <strong className="font-medium text-foreground">
                {hotSheets.find((s) => s.id === hotSheetDeleteId)?.name ?? "this hot sheet"}
              </strong>{" "}
              for the whole shared group — friends or family on the same sheet lose access too — and stops alerts. Your agent will
              no longer see it on your activity. Cannot be undone.
            </AlertDialogDescription>
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
    </>
  );
}

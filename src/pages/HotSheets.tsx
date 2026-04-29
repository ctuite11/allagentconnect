import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import PageShell from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Users, Search, Pencil, MoreHorizontal, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { HotSheetCommentsDialog } from "@/components/HotSheetCommentsDialog";
import { BuyerCollectionCard } from "@/components/BuyerCollectionCard";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { Seo } from "@/components/Seo";
import { BuyerHotSheetPreviewCard } from "@/components/buyer/BuyerHotSheetPreviewCard";
import {
  buyerSectionDesc as buyerSectionDescClass,
  buyerSectionTitle as buyerSectionTitleClass,
  buyerPageMain,
  buyerPageStack,
} from "@/lib/buyerUi";
import { loadHotSheetPhotosAndCounts } from "@/lib/hotSheetPreviewData";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ALERT_FREQUENCY_STORAGE_KEY = "buyer_hot_sheets_alert_frequency";
const isAlertFrequency = (value: string): value is "instant" | "daily" | "weekly" =>
  value === "instant" || value === "daily" || value === "weekly";

interface BuyerCollection {
  clientId: string;
  clientName: string;
  clientInitials: string;
  hotSheets: { id: string; name: string }[];
  photos: string[];
  collaborators: string[];
}

const getInitials = (first?: string, last?: string): string => {
  const f = (first || "")[0]?.toUpperCase() || "";
  const l = (last || "")[0]?.toUpperCase() || "";
  return f + l || "?";
};

interface HotSheetsProps {
  isPublicMode?: boolean;
  isAgentMode?: boolean;
  isBuyerMode?: boolean;
}

interface BuyerHotSheetItem {
  id: string;
  name: string;
  user_id: string | null;
  criteria: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string | null;
  last_sent_at: string | null;
  is_active: boolean;
}

interface ShareTokenRow {
  token: string;
  payload: unknown;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
}

interface RelationshipRow {
  crm_client_id: string | null;
  client_id: string | null;
  status: string;
}

interface LinkedClient {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

interface HotSheetClientLink {
  client_id: string | null;
  clients: LinkedClient | LinkedClient[] | null;
}

interface HotSheetShare {
  id: string;
  shared_with_email: string;
  created_at: string;
}

interface AgentHotSheetRow {
  id: string;
  name: string;
  criteria: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  last_sent_at: string | null;
  hot_sheet_shares?: HotSheetShare[] | null;
  hot_sheet_clients?: HotSheetClientLink[] | null;
}

const HotSheets = ({
  isPublicMode = false,
  isAgentMode = false,
  isBuyerMode = false,
}: HotSheetsProps) => {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<BuyerCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [agentInitials, setAgentInitials] = useState("AG");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState<string | null>(null);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState<string | null>(null);
  const [friendEmail, setFriendEmail] = useState("");
  const [sharing, setSharing] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingHotSheetId, setEditingHotSheetId] = useState<string | null>(null);
  // Keep raw hot sheets for dialog lookups
  const [rawHotSheets, setRawHotSheets] = useState<AgentHotSheetRow[]>([]);
  const [buyerHotSheets, setBuyerHotSheets] = useState<BuyerHotSheetItem[]>([]);
  const [buyerTokenByHotSheetId, setBuyerTokenByHotSheetId] = useState<Record<string, string>>({});
  const [buyerPreviewPhotosById, setBuyerPreviewPhotosById] = useState<Record<string, string[]>>({});
  const [buyerMatchCountsById, setBuyerMatchCountsById] = useState<Record<string, number>>({});
  const [buyerLoading, setBuyerLoading] = useState(true);
  const [deleteBuyerSheetId, setDeleteBuyerSheetId] = useState<string | null>(null);
  const [deleteBuyerSheetLoading, setDeleteBuyerSheetLoading] = useState(false);
  /** `hot_sheets.user_id` (agent owner) — required for CreateHotSheetDialog `userId` in buyer edit mode. */
  const [editingSheetOwnerUserId, setEditingSheetOwnerUserId] = useState<string | null>(null);
  const [alertFrequency, setAlertFrequency] = useState<"instant" | "daily" | "weekly">("instant");
  const buyerMode = isBuyerMode;

  useEffect(() => {
    if (!buyerMode) return;
    const saved = window.localStorage.getItem(ALERT_FREQUENCY_STORAGE_KEY);
    if (saved && isAlertFrequency(saved)) {
      setAlertFrequency(saved);
    }
  }, [buyerMode]);

  useEffect(() => {
    if (!buyerMode) return;
    window.localStorage.setItem(ALERT_FREQUENCY_STORAGE_KEY, alertFrequency);
  }, [alertFrequency, buyerMode]);

  /** Hero / page sections: border only — no shadow so the white canvas beside panels stays clean. */
  const AAC_CARD_SHELL =
    "bg-white rounded-2xl border border-neutral-200 shadow-none transition-colors duration-150";
  const DASH_SECTION_TITLE = buyerSectionTitleClass;
  const DASH_SECTION_DESC = buyerSectionDescClass;

  const heroStatusItems = [
    "Coming Soon",
    "New Listings",
    "Active",
    "Price Drops",
    "Back on Market",
    "Under Agreement",
    "Pending",
    "Sold",
    "Withdrawn",
    "Private",
  ];

  const renderHotSheetsHero = () => (
    <section className={`${AAC_CARD_SHELL} p-5 md:p-6`}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_1.2fr_0.9fr] lg:items-start">
        <div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Hot Sheets</h1>
            <p className="text-sm text-gray-500">
              Track listings that matter most with real-time alerts based on your saved search criteria.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {heroStatusItems.map((item) => (
            <span
              key={item}
              className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-neutral-800 shadow-none"
            >
              {item}
            </span>
          ))}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-none">
          <p className={DASH_SECTION_TITLE}>Connected to your agent</p>
          <p className={`mt-1 ${DASH_SECTION_DESC}`}>
            Your agent can view your Hot Sheets, monitor activity, and share matching opportunities.
          </p>


            <p className={`mt-3.5 ${DASH_SECTION_TITLE}`}>Alert Frequency</p>
            <div className="mt-2 inline-flex w-full rounded-lg border border-neutral-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setAlertFrequency("instant")}
                className={`h-8 flex-1 rounded-md text-xs font-semibold transition-colors ${
                  alertFrequency === "instant"
                    ? "bg-[#0E56F5] text-white shadow-[0_4px_10px_rgba(14,86,245,0.28)]"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Instant
              </button>
              <button
                type="button"
                onClick={() => setAlertFrequency("daily")}
                className={`h-8 flex-1 rounded-md text-xs font-semibold transition-colors ${
                  alertFrequency === "daily"
                    ? "bg-[#0E56F5] text-white shadow-[0_4px_10px_rgba(14,86,245,0.28)]"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setAlertFrequency("weekly")}
                className={`h-8 flex-1 rounded-md text-xs font-semibold transition-colors ${
                  alertFrequency === "weekly"
                    ? "bg-[#0E56F5] text-white shadow-[0_4px_10px_rgba(14,86,245,0.28)]"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Weekly
              </button>
            </div>
        </div>
      </div>
    </section>
  );

  useEffect(() => {
    if (buyerMode) {
      loadBuyerHotSheets();
      return;
    }
    checkAuth();
  }, [buyerMode]);

  const openBuyerHotSheet = (hotSheetId: string, shareToken: string | undefined) => {
    if (shareToken) {
      navigate(`/client/hotsheet/${shareToken}`);
    } else {
      navigate(`/client/hot-sheets/${hotSheetId}`);
    }
  };

  const loadBuyerHotSheets = async () => {
    try {
      setBuyerLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .maybeSingle();

      const buyerEmailNorm = (profile?.email || user.email || "").toLowerCase().trim();

      const allHotSheetIds = new Set<string>();
      const tokenMap: Record<string, string> = {};

      // 1) Primary: hot_sheet_clients (RLS: buyer’s CRM links). Includes buyer-created sheets; no share token required.
      const { data: hscRows, error: hscErr } = await supabase
        .from("hot_sheet_clients")
        .select("hot_sheet_id");

      if (hscErr) {
        console.error("Failed to load hot_sheet_clients", hscErr);
      } else {
        for (const row of hscRows || []) {
          const hid = (row as { hot_sheet_id?: string }).hot_sheet_id;
          if (hid) allHotSheetIds.add(hid);
        }
      }

      // 2) Union: accepted share_token invites (optional /client/hotsheet/:token link)
      const { data: acceptedTokenRows, error: tokenErr } = await supabase
        .from("share_tokens")
        .select("token, payload, accepted_at, accepted_by_user_id")
        .not("accepted_at", "is", null);

      if (tokenErr) {
        console.error("Failed to load accepted tokens", tokenErr);
      } else {
        for (const tokenRow of (acceptedTokenRows || []) as ShareTokenRow[]) {
          const payload = (tokenRow.payload && typeof tokenRow.payload === "object"
            ? tokenRow.payload
            : {}) as Record<string, unknown>;
          if (payload.type !== "client_hotsheet_invite") continue;

          const hotSheetId = String(payload.hot_sheet_id || "");
          if (!hotSheetId) continue;

          const matchByUserId = tokenRow.accepted_by_user_id === user.id;
          const tokenEmail = String(payload.client_email || "").toLowerCase().trim();
          const matchByEmail = buyerEmailNorm && tokenEmail === buyerEmailNorm;

          if (matchByUserId || matchByEmail) {
            allHotSheetIds.add(hotSheetId);
            if (tokenRow.token) tokenMap[hotSheetId] = tokenRow.token;
          }
        }
      }

      if (!allHotSheetIds.size) {
        setBuyerHotSheets([]);
        setBuyerTokenByHotSheetId({});
        setBuyerPreviewPhotosById({});
        setBuyerMatchCountsById({});
        return;
      }

      const { data: hotSheetRows, error: sheetErr } = await supabase
        .from("hot_sheets")
        .select("id, name, user_id, criteria, created_at, updated_at, is_active, last_sent_at")
        .in("id", [...allHotSheetIds])
        .order("created_at", { ascending: false });

      if (sheetErr) {
        console.error("Failed to load hot sheets", sheetErr);
        setBuyerHotSheets([]);
        setBuyerTokenByHotSheetId({});
        setBuyerPreviewPhotosById({});
        setBuyerMatchCountsById({});
        return;
      }

      const rows = (hotSheetRows || []) as BuyerHotSheetItem[];
      setBuyerHotSheets(rows);
      setBuyerTokenByHotSheetId(tokenMap);

      const { photosById, countsById } = await loadHotSheetPhotosAndCounts(
        supabase,
        rows.map((r) => ({ id: r.id, criteria: r.criteria })),
      );
      setBuyerPreviewPhotosById(photosById);
      setBuyerMatchCountsById(countsById);
    } catch (error) {
      console.error("Error loading buyer hot sheets", error);
      toast.error("Unable to load Hot Sheets right now");
      setBuyerHotSheets([]);
      setBuyerTokenByHotSheetId({});
      setBuyerPreviewPhotosById({});
      setBuyerMatchCountsById({});
    } finally {
      setBuyerLoading(false);
    }
  };

  const handleDeleteBuyerHotSheet = async () => {
    if (!deleteBuyerSheetId || deleteBuyerSheetLoading) return;
    const id = deleteBuyerSheetId;
    setDeleteBuyerSheetLoading(true);

    const { error: clientsError } = await supabase
      .from("hot_sheet_clients")
      .delete()
      .eq("hot_sheet_id", id);

    if (clientsError) {
      console.error("Delete hot_sheet_clients failed:", clientsError);
      toast.error("Unable to delete this Hot Sheet");
      setDeleteBuyerSheetLoading(false);
      return;
    }

    const { error: sheetError } = await supabase.from("hot_sheets").delete().eq("id", id);

    if (sheetError) {
      console.error("Delete hot_sheets failed:", sheetError);
      toast.error("Unable to delete this Hot Sheet");
      setDeleteBuyerSheetLoading(false);
      return;
    }

    toast.success("Hot Sheet deleted");
    setBuyerHotSheets((prev) => prev.filter((sheet) => sheet.id !== id));
    setBuyerTokenByHotSheetId((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setBuyerPreviewPhotosById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setBuyerMatchCountsById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setDeleteBuyerSheetLoading(false);
    setDeleteBuyerSheetId(null);
  };

  const handleBuyerEditSuccess = async (
    hotSheetId: string,
    updatedHotSheet?: { id: string; name: string; criteria: Record<string, unknown> | null }
  ) => {
    if (updatedHotSheet) {
      setBuyerHotSheets((prev) =>
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
    await loadBuyerHotSheets();
  };

  if (buyerMode) {
    return (
      <>
        <Seo
          title="Hot Sheets | All Agent Connect"
          description="Personalized listing collections with instant updates based on your search criteria."
          canonical="https://allagentconnect.com/hot-sheets"
          noindex
        />
        <div className={buyerPageMain}>
          <div className={buyerPageStack}>
              <button
                type="button"
                onClick={() => navigate("/client/dashboard")}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Dashboard
              </button>

              {renderHotSheetsHero()}

              {buyerLoading ? (
                <section className="grid grid-cols-1 gap-5 bg-white md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-none">
                      <div className="h-5 w-1/2 animate-pulse rounded bg-zinc-100" />
                      <div className="mt-3 h-4 w-5/6 animate-pulse rounded bg-zinc-100" />
                      <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-zinc-100" />
                    </div>
                  ))}
                </section>
              ) : buyerHotSheets.length === 0 ? (
                <section className="rounded-2xl border border-neutral-100 bg-white px-6 py-6 sm:py-6 shadow-none">
                  <div className="mx-auto max-w-lg text-center">
                    <div className="relative mx-auto mb-3 h-14 w-14">
                      <div className="absolute inset-0 rounded-[22px] bg-gradient-to-br from-[#0E56F5]/15 to-[#0E56F5]/5" />
                      <div className="absolute inset-1.5 inline-flex items-center justify-center rounded-xl bg-white text-[#0E56F5] shadow-sm">
                        <Search className="h-6 w-6" />
                      </div>
                    </div>
                    <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900">No Hot Sheets yet</h3>
                    <p className="mt-2 text-[13px] leading-snug text-neutral-500">
                      Create your first Hot Sheet to track listings in your preferred neighborhoods, price range, and property type.
                    </p>
                    <Button
                      className="mt-4 h-10 rounded-xl bg-[#0E56F5] px-6 text-sm font-semibold text-white hover:bg-[#0B46CC]"
                      onClick={() => navigate("/hot-sheets/new")}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Hot Sheet
                    </Button>
                  </div>
                </section>
              ) : (
                <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {buyerHotSheets.map((sheet) => {
                    const token = buyerTokenByHotSheetId[sheet.id];
                    return (
                      <div key={sheet.id} className="relative">
                        <BuyerHotSheetPreviewCard
                          photoUrls={buyerPreviewPhotosById[sheet.id] ?? []}
                          title={sheet.name}
                          subtitle={`${buyerMatchCountsById[sheet.id] ?? 0} matches`}
                          onClick={() => openBuyerHotSheet(sheet.id, token)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openBuyerHotSheet(sheet.id, token);
                            }
                          }}
                        />
                        <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg border border-neutral-200 bg-white text-neutral-600 shadow-sm hover:bg-white"
                            aria-label="Edit hot sheet"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!sheet.user_id) {
                                toast.error("This hot sheet cannot be edited right now");
                                return;
                              }
                              setEditingHotSheetId(sheet.id);
                              setEditingSheetOwnerUserId(sheet.user_id);
                              setEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg border border-neutral-200 bg-white text-neutral-600 shadow-sm hover:bg-white"
                                aria-label="More options"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[10rem] p-1">
                              <DropdownMenuItem
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setDeleteBuyerSheetId(sheet.id);
                                }}
                                className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-gray-50 focus:bg-gray-50 focus:text-red-600 data-[highlighted]:bg-gray-50 data-[highlighted]:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 shrink-0 text-red-600" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}
          </div>
        </div>
        {editingHotSheetId && editingSheetOwnerUserId && (
          <CreateHotSheetDialog
            key={editingHotSheetId}
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              if (!open) {
                setEditingHotSheetId(null);
                setEditingSheetOwnerUserId(null);
              }
            }}
            userId={editingSheetOwnerUserId}
            hotSheetId={editingHotSheetId}
            editMode
            onSuccess={handleBuyerEditSuccess}
          />
        )}
        <Dialog
          open={Boolean(deleteBuyerSheetId)}
          onOpenChange={(open) => {
            if (!open && !deleteBuyerSheetLoading) setDeleteBuyerSheetId(null);
          }}
        >
          <DialogContent onClick={(event) => event.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Delete hot sheet?</DialogTitle>
              <DialogDescription>
                This will remove this hot sheet and its alerts.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteBuyerSheetId(null)}
                disabled={deleteBuyerSheetLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteBuyerHotSheet}
                disabled={deleteBuyerSheetLoading}
              >
                {deleteBuyerSheetLoading ? "Deleting..." : "Delete hot sheet"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to manage hot sheets");
      navigate("/auth");
      return;
    }
    setUser(user);

    // Fetch agent initials
    const { data: profile } = await supabase
      .from("agent_profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) {
      setAgentInitials(getInitials(profile.first_name, profile.last_name));
    }

    fetchData(user.id);
  };

  const fetchData = async (userId: string) => {
    try {
      setLoading(true);

      // 1. Fetch hot sheets with clients and shares
      const { data: hsData, error } = await supabase
        .from("hot_sheets")
        .select(`
          id, name, criteria, is_active, created_at, last_sent_at,
          hot_sheet_shares ( id, shared_with_email, created_at ),
          hot_sheet_clients ( client_id, clients ( id, first_name, last_name, email, phone ) )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const sheetsRaw = (hsData || []) as AgentHotSheetRow[];

      // 1b. Filter out hot sheets linked to removed/inactive buyers.
      // Keep: active + pending. Hide: anything else.
      const { data: relRows } = await supabase
        .from("client_agent_relationships")
        .select("crm_client_id, client_id, status")
        .eq("agent_id", userId)
        .in("status", ["active", "pending"]);

      const visibleClientIds = new Set<string>();
      (relRows || []).forEach((r: RelationshipRow) => {
        if (r.crm_client_id) visibleClientIds.add(String(r.crm_client_id));
        if (r.client_id) visibleClientIds.add(String(r.client_id));
      });

      const sheets = sheetsRaw
        .map((s) => {
          const links = s.hot_sheet_clients || [];
          if (links.length === 0) return s; // criteria-only sheet
          const filteredLinks = links.filter((hsc) =>
            hsc.client_id && visibleClientIds.has(String(hsc.client_id))
          );
          return { ...s, hot_sheet_clients: filteredLinks };
        })
        .filter((s) => {
          const original = sheetsRaw.find((o) => o.id === s.id);
          const hadClients = (original?.hot_sheet_clients || []).length > 0;
          if (!hadClients) return true;
          return (s.hot_sheet_clients || []).length > 0;
        });

      setRawHotSheets(sheets);

      if (!sheets.length) {
        setCollections([]);
        return;
      }

      // 2. Fetch listing photos from criteria-matched listings for each sheet
      const photosPerSheet = new Map<string, string[]>();
      for (const sheet of sheets) {
        const criteria = sheet.criteria;
        if (!criteria) continue;
        try {
          const { data: matchedListings } = await buildListingsQuery(supabase, criteria).limit(20);
          const photos: string[] = [];
          for (const l of (matchedListings || []) as Array<{ photos?: unknown }>) {
            const lPhotos = Array.isArray(l.photos) ? l.photos : null;
            if (lPhotos?.length && photos.length < 4) {
              const raw = lPhotos[0];
              const url =
                typeof raw === "string"
                  ? raw
                  : raw && typeof raw === "object" && "url" in raw && typeof (raw as { url?: unknown }).url === "string"
                    ? (raw as { url: string }).url
                    : null;
              if (url) photos.push(url);
            }
          }
          if (photos.length) photosPerSheet.set(sheet.id, photos);
        } catch (e) {
          console.error("Error fetching matches for", sheet.id, e);
        }
      }

      // 3. Group by client
      const clientMap = new Map<string, BuyerCollection>();

      for (const sheet of sheets) {
        const clients = (sheet.hot_sheet_clients || []).map((hsc) => {
          const c = hsc.clients;
          return Array.isArray(c) ? c[0] : c;
        }).filter(Boolean);

        // Collect collaborator emails from shares
        const shareEmails = (sheet.hot_sheet_shares || []).map((s) => s.shared_with_email);
        const collabInitials = shareEmails.map((e: string) => {
          const parts = e.split("@")[0].split(/[._-]/);
          return parts.map((p: string) => p[0]?.toUpperCase() || "").join("").slice(0, 2);
        });

        // Get photos for this sheet from criteria matches
        const sheetPhotos: string[] = photosPerSheet.get(sheet.id) || [];

        if (clients.length === 0) {
          // Hot sheet with no client — use criteria name or sheet name
          const key = `__no_client_${sheet.id}`;
          const criteriaFirstName =
            typeof sheet.criteria?.clientFirstName === "string" ? sheet.criteria.clientFirstName : undefined;
          const criteriaLastName =
            typeof sheet.criteria?.clientLastName === "string" ? sheet.criteria.clientLastName : undefined;
          clientMap.set(key, {
            clientId: sheet.id,
            clientName: criteriaFirstName
              ? [criteriaFirstName, criteriaLastName].filter(Boolean).join(" ")
              : sheet.name,
            clientInitials: getInitials(criteriaFirstName, criteriaLastName),
            hotSheets: [{ id: sheet.id, name: sheet.name }],
            photos: sheetPhotos,
            collaborators: collabInitials,
          });
        } else {
          for (const client of clients) {
            const existing = clientMap.get(client.id);
            if (existing) {
              existing.hotSheets.push({ id: sheet.id, name: sheet.name });
              // Merge photos up to 4
              for (const ph of sheetPhotos) {
                if (existing.photos.length < 4 && !existing.photos.includes(ph)) {
                  existing.photos.push(ph);
                }
              }
              // Merge collaborators
              for (const ci of collabInitials) {
                if (!existing.collaborators.includes(ci)) existing.collaborators.push(ci);
              }
            } else {
              clientMap.set(client.id, {
                clientId: client.id,
                clientName: [client.first_name, client.last_name].filter(Boolean).join(" ") || "Unnamed Client",
                clientInitials: getInitials(client.first_name, client.last_name),
                hotSheets: [{ id: sheet.id, name: sheet.name }],
                photos: sheetPhotos,
                collaborators: collabInitials,
              });
            }
          }
        }
      }

      setCollections(Array.from(clientMap.values()));
    } catch (error) {
      console.error("Error fetching hot sheets:", error);
      toast.error("Failed to load hot sheets");
    } finally {
      setLoading(false);
    }
  };

  const handleHotSheetSuccess = async (
    hotSheetId: string,
    updatedHotSheet?: { id: string; name: string; criteria: Record<string, unknown> | null }
  ) => {
    if (editingHotSheetId && user) {
      if (updatedHotSheet) {
        setRawHotSheets((prev) =>
          prev.map((sheet) =>
            sheet.id === hotSheetId
              ? { ...sheet, name: updatedHotSheet.name, criteria: updatedHotSheet.criteria }
              : sheet
          )
        );
        setCollections((prev) =>
          prev.map((collection) => ({
            ...collection,
            hotSheets: collection.hotSheets.map((sheet) =>
              sheet.id === hotSheetId ? { ...sheet, name: updatedHotSheet.name } : sheet
            ),
          }))
        );
        setEditingHotSheetId(null);
        return;
      }
      await fetchData(user.id);
      setEditingHotSheetId(null);
    } else {
      navigate(`/hot-sheets/${hotSheetId}/review`);
    }
  };

  const handleCardClick = (collection: BuyerCollection) => {
    if (collection.hotSheets.length === 1) {
      navigate(`/hot-sheets/${collection.hotSheets[0].id}/review`);
    } else {
      navigate(`/hot-sheets/buyer/${collection.clientId}`, { state: { from: "/agent/hot-sheets" } });
    }
  };

  // Share dialog handlers (kept for existing dialogs)
  const handleShareHotSheet = async (hotSheetId: string) => {
    if (!friendEmail.trim()) { toast.error("Please enter a friend's email"); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(friendEmail)) { toast.error("Please enter a valid email address"); return; }
    try {
      setSharing(true);
      const { error } = await supabase
        .from("hot_sheet_shares")
        .insert({ hot_sheet_id: hotSheetId, shared_with_email: friendEmail.toLowerCase(), shared_by_user_id: user.id });
      if (error) {
        if (error.code === "23505") toast.error("This hot sheet is already shared with this email");
        else throw error;
        return;
      }
      const hotSheet = rawHotSheets.find((s) => s.id === hotSheetId);
      if (hotSheet) {
        try {
          await supabase.functions.invoke("send-hot-sheet-invite", {
            body: { invitedEmail: friendEmail.toLowerCase(), inviterName: user.email?.split("@")[0] || "A friend", hotSheetName: hotSheet.name, hotSheetLink: `${window.location.origin}/hot-sheets` },
          });
        } catch (emailError) { console.error("Failed to send invite email:", emailError); }
      }
      toast.success("Hot sheet shared successfully");
      setFriendEmail("");
      setShareDialogOpen(null);
      fetchData(user.id);
    } catch (error) {
      console.error("Error sharing hot sheet:", error);
      toast.error("Failed to share hot sheet");
    } finally {
      setSharing(false);
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    try {
      const { error } = await supabase.from("hot_sheet_shares").delete().eq("id", shareId);
      if (error) throw error;
      toast.success("Share removed");
      fetchData(user.id);
    } catch (error) {
      console.error("Error deleting share:", error);
      toast.error("Failed to remove share");
    }
  };

  const handleDeleteHotSheet = async (hotSheetId: string) => {
    if (!user?.id) return;
    if (!confirm("Are you sure you want to delete this hot sheet?")) return;

    const { error: clientsError } = await supabase
      .from("hot_sheet_clients")
      .delete()
      .eq("hot_sheet_id", hotSheetId);

    if (clientsError) {
      console.error("Delete hot_sheet_clients failed:", clientsError);
      toast.error("Failed to delete hot sheet");
      return;
    }

    const { error: sheetError } = await supabase.from("hot_sheets").delete().eq("id", hotSheetId);

    if (sheetError) {
      console.error("Delete hot_sheets failed:", sheetError);
      toast.error("Failed to delete hot sheet");
      return;
    }

    toast.success("Hot sheet deleted");
    await fetchData(user.id);
  };

  if (loading) {
    return (
      <PageShell>
        <Seo
          title="Hot Sheets | All Agent Connect"
          description="Review saved listing feeds, curated market opportunities, and client-focused inventory updates."
          canonical="https://allagentconnect.com/hot-sheets"
          noindex
        />
        {renderHotSheetsHero()}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-zinc-200 bg-white animate-pulse">
              <div className="aspect-[4/3] bg-zinc-100 rounded-t-2xl" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-zinc-200 rounded w-2/3" />
                <div className="h-4 bg-zinc-100 rounded w-1/3" />
                <div className="flex gap-2 mt-3">
                  <div className="h-8 w-8 rounded-full bg-zinc-200" />
                  <div className="h-8 w-8 rounded-full bg-zinc-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <>
      <Seo
        title="Hot Sheets | All Agent Connect"
        description="Review saved listing feeds, curated market opportunities, and client-focused inventory updates."
        canonical="https://allagentconnect.com/hot-sheets"
        noindex
      />
      <PageShell className="bg-white pb-8">
        <div className="mb-5">
          {renderHotSheetsHero()}
        </div>

        {collections.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-12 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-zinc-300" />
            <h3 className="text-xl font-semibold text-zinc-900 mb-2">No buyer hot sheets yet</h3>
            <p className="text-zinc-500 mb-6">
              Create your first hot sheet to start curating listings for your buyers.
            </p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Client Hot Sheet
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-white">
            {collections.map((collection) => (
              <BuyerCollectionCard
                key={collection.clientId}
                clientId={collection.clientId}
                clientName={collection.clientName}
                hotSheetCount={collection.hotSheets.length}
                photos={collection.photos}
                agentInitials={agentInitials}
                clientInitials={collection.clientInitials}
                collaborators={collection.collaborators}
                onClick={() => handleCardClick(collection)}
              />
            ))}
          </div>
        )}
      </PageShell>

      {/* Share Dialog */}
      <Dialog
        open={!!shareDialogOpen}
        onOpenChange={(open) => { if (!open) { setShareDialogOpen(null); setFriendEmail(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Hot Sheet</DialogTitle>
            <DialogDescription>Share this hot sheet with friends. They'll receive the same listing alerts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="friend-email">Friend's Email</Label>
              <Input id="friend-email" type="email" placeholder="friend@example.com" value={friendEmail} onChange={(e) => setFriendEmail(e.target.value)} />
            </div>
            {shareDialogOpen && rawHotSheets.find((s) => s.id === shareDialogOpen)?.hot_sheet_shares?.length ? (
              <div>
                <Label>Currently Shared With:</Label>
                <div className="mt-2 space-y-2">
                  {rawHotSheets.find((s) => s.id === shareDialogOpen)?.hot_sheet_shares?.map((share) => (
                    <div key={share.id} className="flex items-center justify-between p-2 bg-white border border-zinc-200 rounded">
                      <span className="text-sm">{share.shared_with_email}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteShare(share.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShareDialogOpen(null); setFriendEmail(""); }}>Cancel</Button>
              <Button onClick={() => shareDialogOpen && handleShareHotSheet(shareDialogOpen)} disabled={sharing || !friendEmail.trim()}>Share</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hot Sheet Creation Dialog */}
      <CreateHotSheetDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} userId={user?.id} onSuccess={handleHotSheetSuccess} />

      {/* Hot Sheet Edit Dialog */}
      <CreateHotSheetDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} userId={user?.id} onSuccess={handleHotSheetSuccess} hotSheetId={editingHotSheetId || undefined} editMode={true} />

      {/* Comments Dialog */}
      {commentsDialogOpen && (
        <HotSheetCommentsDialog
          open={!!commentsDialogOpen}
          onOpenChange={(open) => !open && setCommentsDialogOpen(null)}
          hotSheetId={commentsDialogOpen}
          hotSheetName={rawHotSheets.find((s) => s.id === commentsDialogOpen)?.name || ""}
        />
      )}
    </>
  );
};

export default HotSheets;

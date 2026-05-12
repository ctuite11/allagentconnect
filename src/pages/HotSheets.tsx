import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import PageShell from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Bell, ChevronLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { HotSheetCommentsDialog } from "@/components/HotSheetCommentsDialog";
import { BuyerHotSheetPreviewCard } from "@/components/buyer/BuyerHotSheetPreviewCard";
import { Seo } from "@/components/Seo";
import {
  buyerCollectionCardRoot,
  buyerImageMosaicCell,
  buyerImageMosaicGrid,
  buyerSectionDesc as buyerSectionDescClass,
  buyerSectionTitle as buyerSectionTitleClass,
  buyerPageMain,
  buyerPageStack,
} from "@/lib/buyerUi";
import { loadHotSheetPhotosAndCounts } from "@/lib/hotSheetPreviewData";
import { deleteHotSheetWithClientLinks } from "@/lib/deleteHotSheetBuyerAuthorized";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

const ALERT_FREQUENCY_STORAGE_KEY = "buyer_hot_sheets_alert_frequency";
const isAlertFrequency = (value: string): value is "instant" | "daily" | "weekly" =>
  value === "instant" || value === "daily" || value === "weekly";

function AgentSheetPhotoCell({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className={buyerImageMosaicCell} aria-hidden />;
  }
  return (
    <div className={buyerImageMosaicCell}>
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

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

interface AgentHotSheetListCard {
  id: string;
  name: string;
  photos: string[];
  matchCount: number;
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
  const [agentSheetCards, setAgentSheetCards] = useState<AgentHotSheetListCard[]>([]);
  const [agentDeleteTarget, setAgentDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [agentDeleteBusy, setAgentDeleteBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
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
  const [buyerLinkedAgentName, setBuyerLinkedAgentName] = useState<string | null>(null);
  const [alertFrequency, setAlertFrequency] = useState<"instant" | "daily" | "weekly">("instant");
  const [buyerDeleteTarget, setBuyerDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [buyerDeleteBusy, setBuyerDeleteBusy] = useState(false);
  /** Agent list: last fetch failed (clears list in catch). */
  const [agentLoadError, setAgentLoadError] = useState(false);
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

  /** Hero / page sections — white surface, subtle border/shadow (matches polished agent surfaces). */
  const AAC_CARD_SHELL =
    "rounded-2xl border border-neutral-200 bg-white shadow-sm transition-colors duration-150";
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

  const renderHotSheetsHero = () => {
    const showHeroCreate = buyerMode || (!loading && !!user);

    const heroCreateButton = showHeroCreate ? (
      <Button
        type="button"
        size="sm"
        className="h-9 w-fit shrink-0 bg-neutral-900 px-4 text-white shadow-sm hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-zinc-400/40"
        onClick={() =>
          buyerMode ? navigate("/hot-sheets/new") : setCreateDialogOpen(true)
        }
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Create Hot Sheet
      </Button>
    ) : null;

    return (
    <section className={`${AAC_CARD_SHELL} p-5 md:p-6`}>
      {/*
        Mobile: title → statuses → CTA → panel (max-lg:order-* on left children only).
        lg: left column flex justify-between (title+desc top, CTA bottom); center lg:self-center; no mobile order on lg.
      */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_1.2fr_0.9fr] lg:grid-rows-1 lg:items-stretch lg:gap-x-5 lg:gap-y-0">
        <div className="max-lg:contents lg:col-start-1 lg:row-start-1 lg:flex lg:min-h-0 lg:w-full lg:flex-col lg:justify-between lg:items-start lg:self-stretch lg:pt-0.5">
          {/* order-* only for mobile grid stacking; at lg, document order = title → CTA (avoid order-0 above order-1 flex flip) */}
          <div className="max-lg:order-1 min-w-0 lg:min-h-0">
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Hot Sheets</h1>
              <p className="text-sm leading-snug text-neutral-600">
                Track listings that matter most with real-time alerts based on your saved search criteria.
              </p>
            </div>
          </div>
          {showHeroCreate ? (
            <div className="max-lg:order-3 flex shrink-0 justify-start lg:pb-0.5">
              {heroCreateButton}
            </div>
          ) : null}
        </div>

        <div className="order-2 grid grid-cols-2 gap-2.5 sm:gap-3 lg:col-start-2 lg:row-start-1 lg:self-center">
          {/* LOCKED UI — do not restyle without design approval
           * Matches AAC premium system (Dashboard-aligned) */}
          {heroStatusItems.map((item) => (
            <span
              key={item}
              className="flex items-center gap-2 text-[13px] font-medium text-neutral-700"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-neutral-400" aria-hidden />
              {item}
            </span>
          ))}
        </div>

        <div className="order-4 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm lg:col-start-3 lg:row-start-1 lg:self-start">
          <p className={DASH_SECTION_TITLE}>Connected to your agent</p>
          <p className={`mt-1 ${DASH_SECTION_DESC}`}>
            Your agent can view your Hot Sheets, monitor activity, and share matching opportunities.
          </p>


            <p className={`mt-3.5 ${DASH_SECTION_TITLE}`}>Alert Frequency</p>
            <div className="mt-2 inline-flex w-full rounded-lg border border-neutral-200 bg-neutral-50/80 p-1">
              <button
                type="button"
                onClick={() => setAlertFrequency("instant")}
                className={`h-8 flex-1 rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 ${
                  alertFrequency === "instant"
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "text-neutral-600 hover:bg-white/80 hover:text-neutral-900"
                }`}
              >
                Instant
              </button>
              <button
                type="button"
                onClick={() => setAlertFrequency("daily")}
                className={`h-8 flex-1 rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 ${
                  alertFrequency === "daily"
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "text-neutral-600 hover:bg-white/80 hover:text-neutral-900"
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setAlertFrequency("weekly")}
                className={`h-8 flex-1 rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 ${
                  alertFrequency === "weekly"
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "text-neutral-600 hover:bg-white/80 hover:text-neutral-900"
                }`}
              >
                Weekly
              </button>
            </div>
        </div>
      </div>
    </section>
    );
  };

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
      setBuyerLinkedAgentName(null);

      let user: User | null = null;
      try {
        const { data } = await supabase.auth.getUser();
        user = data?.user ?? null;
      } catch (authErr) {
        console.warn("[HotSheets] auth.getUser failed", authErr);
        user = null;
      }

      const userId = user?.id ?? null;
      if (!userId) {
        navigate("/auth");
        return;
      }

      try {
        const { data: relationship, error: relErr } = await supabase
          .from("client_agent_relationships")
          .select("agent_id")
          .eq("client_id", userId)
          .eq("status", "active")
          .maybeSingle();

        const rawAid =
          relationship && typeof relationship === "object"
            ? (relationship as Record<string, unknown>).agent_id
            : undefined;
        const agentId =
          typeof rawAid === "string" && rawAid.trim() ? rawAid.trim() : null;

        if (!relErr && agentId) {
          const { data: agentProfile, error: profileErr } = await supabase
            .from("agent_profiles")
            .select("first_name, last_name")
            .eq("id", agentId)
            .maybeSingle();

          if (!profileErr && agentProfile && typeof agentProfile === "object") {
            const ap = agentProfile as Record<string, unknown>;
            const parts = [ap.first_name, ap.last_name].filter(
              (x): x is string => typeof x === "string" && Boolean(x.trim()),
            );
            const display = parts.map((s) => s.trim()).join(" ");
            if (display) setBuyerLinkedAgentName(display);
          }
        }
      } catch (agentLookupErr) {
        console.warn("[HotSheets] Linked agent attribution skipped", agentLookupErr);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle();

      const buyerEmailNorm = (profile?.email || user?.email || "").toLowerCase().trim();

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

          const matchByUserId = tokenRow.accepted_by_user_id === userId;
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
      setBuyerLinkedAgentName(null);
      setBuyerHotSheets([]);
      setBuyerTokenByHotSheetId({});
      setBuyerPreviewPhotosById({});
      setBuyerMatchCountsById({});
    } finally {
      setBuyerLoading(false);
    }
  };

  const confirmDeleteBuyerHotSheet = async () => {
    if (!buyerDeleteTarget) return;
    setBuyerDeleteBusy(true);
    try {
      const { error } = await deleteHotSheetWithClientLinks(supabase, buyerDeleteTarget.id);
      if (error) {
        console.error("Buyer delete hot sheet failed:", error);
        toast.error(error.message || "Unable to delete this hot sheet.");
        return;
      }
      toast.success("Hot sheet deleted for your group.");
      setBuyerDeleteTarget(null);
      await loadBuyerHotSheets();
    } finally {
      setBuyerDeleteBusy(false);
    }
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
        <div className={`${buyerPageMain} pb-20`}>
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
                    <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                      <div className="h-5 w-1/2 animate-pulse rounded bg-neutral-100" />
                      <div className="mt-3 h-4 w-5/6 animate-pulse rounded bg-neutral-100" />
                      <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-neutral-100" />
                    </div>
                  ))}
                </section>
              ) : buyerHotSheets.length === 0 ? (
                <section className="rounded-2xl border border-neutral-200 bg-white px-6 py-8 shadow-sm sm:py-10">
                  <div className="mx-auto max-w-lg text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 shadow-sm">
                      <Bell className="h-6 w-6 text-neutral-500" />
                    </div>
                    <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900">No Hot Sheets yet</h3>
                    <p className="mt-2 text-[13px] leading-snug text-neutral-500">
                      Create your first Hot Sheet to track listings in your preferred neighborhoods, price range, and property type—use{" "}
                      <span className="font-medium text-neutral-700">Create Hot Sheet</span> at the top of this page.
                    </p>
                  </div>
                </section>
              ) : (
                <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {buyerHotSheets.map((sheet) => {
                    const token = buyerTokenByHotSheetId[sheet.id];
                    return (
                      <BuyerHotSheetPreviewCard
                        key={sheet.id}
                        variant="hotSheetsPage"
                        photoUrls={buyerPreviewPhotosById[sheet.id] ?? []}
                        title={sheet.name}
                        linkedAgentName={buyerLinkedAgentName}
                        onClick={() => openBuyerHotSheet(sheet.id, token)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openBuyerHotSheet(sheet.id, token);
                          }
                        }}
                        onDeleteClick={() => setBuyerDeleteTarget({ id: sheet.id, name: sheet.name })}
                      />
                    );
                  })}
                </section>
              )}
          </div>
        </div>

        <AlertDialog
          open={Boolean(buyerDeleteTarget)}
          onOpenChange={(open) => {
            if (!open && !buyerDeleteBusy) setBuyerDeleteTarget(null);
          }}
        >
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this hot sheet for everyone?</AlertDialogTitle>
              <AlertDialogDescription>
                You are removing <strong className="font-medium text-foreground">{buyerDeleteTarget?.name ?? "this hot sheet"}</strong>{" "}
                for the whole shared group — anyone on this sheet (including friends or family your agent added) will lose access,
                and alerts will stop. Your agent will no longer see this sheet on your activity. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={buyerDeleteBusy}>Cancel</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                disabled={buyerDeleteBusy}
                onClick={() => void confirmDeleteBuyerHotSheet()}
              >
                {buyerDeleteBusy ? "Deleting…" : "Delete"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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

    fetchData(user.id);
  };

  const fetchData = async (userId: string) => {
    try {
      setLoading(true);
      setAgentLoadError(false);

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
        setAgentSheetCards([]);
        return;
      }

      const { photosById, countsById } = await loadHotSheetPhotosAndCounts(
        supabase,
        sheets.map((s) => ({ id: s.id, criteria: s.criteria })),
      );

      const cards: AgentHotSheetListCard[] = sheets.map((sheet) => {
        const raw = photosById[sheet.id] || [];
        const padded = [raw[0], raw[1], raw[2], raw[3]].map((u) => (typeof u === "string" && u ? u : ""));
        return {
          id: sheet.id,
          name: sheet.name,
          photos: padded,
          matchCount: countsById[sheet.id] ?? 0,
        };
      });

      setAgentSheetCards(cards);
    } catch (error) {
      console.error("Error fetching hot sheets:", error);
      toast.error("Failed to load hot sheets");
      setAgentLoadError(true);
      setAgentSheetCards([]);
      setRawHotSheets([]);
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
        setAgentSheetCards((prev) =>
          prev.map((card) =>
            card.id === hotSheetId ? { ...card, name: updatedHotSheet.name } : card,
          ),
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

  const confirmAgentDeleteHotSheet = async () => {
    if (!agentDeleteTarget || !user) return;
    setAgentDeleteBusy(true);
    try {
      const { error: clientsError } = await supabase
        .from("hot_sheet_clients")
        .delete()
        .eq("hot_sheet_id", agentDeleteTarget.id);
      if (clientsError) throw clientsError;
      const { error: sheetError } = await supabase
        .from("hot_sheets")
        .delete()
        .eq("id", agentDeleteTarget.id)
        .eq("user_id", user.id);
      if (sheetError) throw sheetError;
      toast.success("Hot sheet deleted.");
      setAgentDeleteTarget(null);
      await fetchData(user.id);
    } catch (error: unknown) {
      console.error("Agent delete hot sheet failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not delete this hot sheet.",
      );
    } finally {
      setAgentDeleteBusy(false);
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

  if (loading) {
    return (
      <PageShell className="pb-8">
        <Seo
          title="Hot Sheets | All Agent Connect"
          description="Review saved listing feeds, curated market opportunities, and client-focused inventory updates."
          canonical="https://allagentconnect.com/agent/hot-sheets"
          noindex
        />
        <div className="mb-5">{renderHotSheetsHero()}</div>
        <div
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="sr-only">Loading hot sheets…</span>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
            >
              <Skeleton className="h-48 w-full rounded-none bg-neutral-100 md:h-52" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-6 w-[85%] max-w-[16rem] rounded-md bg-neutral-100" />
                <Skeleton className="h-4 w-24 rounded-md bg-neutral-100" />
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
        canonical="https://allagentconnect.com/agent/hot-sheets"
        noindex
      />
      <PageShell className="pb-8">
        <div className="mb-5">
          {renderHotSheetsHero()}
        </div>

        {agentLoadError ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm md:p-10">
            <p className="text-sm font-medium text-neutral-900">Couldn&apos;t load hot sheets</p>
            <p className="mt-2 text-sm text-neutral-600">
              Check your connection and try again.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-5 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-zinc-400/40"
              onClick={() => user && void fetchData(user.id)}
            >
              Try again
            </Button>
          </div>
        ) : agentSheetCards.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm md:p-12">
            <Bell className="mx-auto mb-4 h-14 w-14 text-neutral-300" />
            <h3 className="mb-2 text-lg font-semibold text-neutral-900">No hot sheets yet</h3>
            <p className="mx-auto max-w-md text-sm text-neutral-600">
              Create your first hot sheet to start curating listings for your buyers—use{" "}
              <span className="font-medium text-neutral-800">Create Hot Sheet</span> at the top of this page.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 bg-white md:grid-cols-2 lg:grid-cols-3">
            {agentSheetCards.map((card) => {
              const p = card.photos;
              return (
                <article
                  key={card.id}
                  className={`${buyerCollectionCardRoot} relative flex min-h-[19rem] flex-col md:min-h-[20rem]`}
                >
                  <button
                    type="button"
                    aria-label={`Delete hot sheet ${card.name}`}
                    onClick={() => setAgentDeleteTarget({ id: card.id, name: card.name })}
                    className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-md text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`Edit hot sheet ${card.name}`}
                    onClick={() => {
                      setEditingHotSheetId(card.id);
                      setEditDialogOpen(true);
                    }}
                    className="absolute right-11 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2"
                  >
                    <Pencil className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  </button>
                  <div className={buyerImageMosaicGrid}>
                    <AgentSheetPhotoCell src={p[0]} />
                    <AgentSheetPhotoCell src={p[1]} />
                    <AgentSheetPhotoCell src={p[2]} />
                    <AgentSheetPhotoCell src={p[3]} />
                  </div>
                  <div className="flex min-h-0 w-full flex-1 flex-col bg-white px-4 pb-4 pt-3 text-left">
                    <div className="min-w-0 shrink-0 pr-20">
                      <h3 className="truncate text-lg font-semibold leading-snug text-neutral-900">
                        <span className="font-medium text-neutral-600">Hot Sheet: </span>
                        <span>{card.name}</span>
                      </h3>
                      <p className="mt-2 text-sm text-neutral-600">
                        {card.matchCount}{" "}
                        {card.matchCount === 1 ? "listing matches" : "listings match"}
                      </p>
                    </div>
                    <div className="mt-auto flex shrink-0 justify-start pt-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/hot-sheets/${card.id}/review`)}
                        className="text-sm font-medium text-[#0E56F5] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2"
                      >
                        View all
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </PageShell>

      <AlertDialog
        open={Boolean(agentDeleteTarget)}
        onOpenChange={(open) => {
          if (!open && !agentDeleteBusy) setAgentDeleteTarget(null);
        }}
      >
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this hot sheet?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes{" "}
              <strong className="font-medium text-foreground">{agentDeleteTarget?.name ?? "this hot sheet"}</strong>{" "}
              and its client links. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={agentDeleteBusy}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={agentDeleteBusy}
              onClick={() => void confirmAgentDeleteHotSheet()}
            >
              {agentDeleteBusy ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Dialog */}
      <Dialog
        open={!!shareDialogOpen}
        onOpenChange={(open) => { if (!open) { setShareDialogOpen(null); setFriendEmail(""); } }}
      >
        <DialogContent className="border-neutral-200 bg-white sm:rounded-xl">
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
                    <div key={share.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-2">
                      <span className="text-sm text-neutral-800">{share.shared_with_email}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteShare(share.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="border-neutral-200" onClick={() => { setShareDialogOpen(null); setFriendEmail(""); }}>Cancel</Button>
              <Button
                className="bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-zinc-400/40"
                onClick={() => shareDialogOpen && handleShareHotSheet(shareDialogOpen)}
                disabled={sharing || !friendEmail.trim()}
              >
                Share
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hot Sheet Creation Dialog */}
      <CreateHotSheetDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} userId={user?.id} onSuccess={handleHotSheetSuccess} />

      {/* Hot Sheet Edit Dialog */}
      <CreateHotSheetDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} userId={user?.id} onSuccess={handleHotSheetSuccess} hotSheetId={editingHotSheetId || undefined} editMode={true} allowDeleteFromEdit />

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

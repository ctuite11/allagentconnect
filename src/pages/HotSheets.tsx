import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import PageShell from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Bell, ChevronLeft } from "lucide-react";
import { AacBackButton } from "@/components/layout/AacBackLink";
import { AacPageIntro } from "@/components/layout/AacPageIntro";
import { toast } from "sonner";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { HotSheetCommentsDialog } from "@/components/HotSheetCommentsDialog";
import { BuyerCollectionCard } from "@/components/BuyerCollectionCard";
import { BuyerHotSheetPreviewCard } from "@/components/buyer/BuyerHotSheetPreviewCard";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { Seo } from "@/components/Seo";
import {
  buyerSectionDesc as buyerSectionDescClass,
  buyerSectionTitle as buyerSectionTitleClass,
  buyerPageMain,
  buyerPageStack,
} from "@/lib/buyerUi";
import { loadHotSheetPhotosAndCounts } from "@/lib/hotSheetPreviewData";
import { deleteHotSheetWithClientLinks } from "@/lib/deleteHotSheetBuyerAuthorized";
import { loadBuyerHotSheetAccess } from "@/lib/loadBuyerHotSheetAccess";
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
import { useAuthRole } from "@/hooks/useAuthRole";

interface BuyerCollection {
  clientId: string;
  clientName: string;
  clientInitials: string;
  hotSheets: { id: string; name: string; isActive: boolean }[];
  photos: string[];
  collaborators: string[];
  /** False for criteria-only cards (no CRM `clients.id` for `/agent/buyers/:id/favorites`). */
  supportsBuyerFavorites: boolean;
}

interface AgentPersonalHotSheet {
  id: string;
  name: string;
  photos: string[];
  isActive: boolean;
}

const AAC_PRIMARY_BTN =
  "border border-[#0B46CC]/20 bg-[#0E56F5] text-white shadow-sm hover:bg-[#0B46CC] focus-visible:ring-2 focus-visible:ring-neutral-400/55 focus-visible:ring-offset-2";

/** Agent `/agent/hot-sheets` — shared grid for My Hot Sheets + Buyer Hot Sheets cards. */
const AGENT_HOT_SHEETS_CARD_GRID = "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3";

function AgentHotSheetCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <Skeleton className="h-48 w-full rounded-none bg-neutral-100 md:h-52" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-[85%] max-w-[16rem] rounded-md bg-neutral-100" />
        <Skeleton className="h-4 w-24 rounded-md bg-neutral-100" />
      </div>
    </div>
  );
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
  const { user: authSessionUser, loading: authRoleLoading } = useAuthRole();
  const [collections, setCollections] = useState<BuyerCollection[]>([]);
  const [personalHotSheets, setPersonalHotSheets] = useState<AgentPersonalHotSheet[]>([]);
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
  const [buyerDisplayName, setBuyerDisplayName] = useState("");
  const [buyerDeleteTarget, setBuyerDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [buyerDeleteBusy, setBuyerDeleteBusy] = useState(false);
  /** Agent list: last fetch failed (clears list in catch). */
  const [agentLoadError, setAgentLoadError] = useState(false);
  const buyerMode = isBuyerMode;

  /** Hero / page sections — white surface, subtle border/shadow (matches polished agent surfaces). */
  const AAC_CARD_SHELL =
    "rounded-2xl border border-neutral-200 bg-white shadow-sm transition-colors duration-150";
  const DASH_SECTION_TITLE = buyerSectionTitleClass;
  const DASH_SECTION_DESC = buyerSectionDescClass;

  const heroStatusItems = [
    "Coming Soon",
    "New Listings",
    "On MLS",
    "Price Drops",
    "Back on Market",
    "Under Agreement",
    "Pending",
    "Sold",
    "Withdrawn",
    "Private",
  ];

  const renderAgentBackLink = () =>
    isAgentMode ? (
      <AacPageIntro
        withTopPadding
        back={
          <AacBackButton
            type="button"
            onClick={() => navigate("/success-hub")}
            title="Return to Success Hub"
          />
        }
      />
    ) : null;

  const renderHotSheetsHero = () => {
    const showHeroCreate = buyerMode || (!loading && !!user);

    const heroCreateButton =
      showHeroCreate && buyerMode ? (
        <Button
          type="button"
          size="sm"
          className={`w-fit shrink-0 ${AAC_PRIMARY_BTN}`}
          onClick={() => navigate("/hot-sheets/new")}
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
      <div
        className={
          buyerMode
            ? "grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_1.2fr_0.9fr] lg:grid-rows-1 lg:items-stretch lg:gap-x-5 lg:gap-y-0"
            : "grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_1.2fr] lg:grid-rows-1 lg:items-stretch lg:gap-x-5 lg:gap-y-0"
        }
      >
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
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#16A34A]" aria-hidden />
              {item}
            </span>
          ))}
        </div>

        {buyerMode ? (
          <div className="order-4 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm lg:col-start-3 lg:row-start-1 lg:self-start">
            <p className={DASH_SECTION_TITLE}>Connected to your agent</p>
            <p className={`mt-1 ${DASH_SECTION_DESC}`}>
              Your agent can view your Hot Sheets, comment, and track activity.
            </p>

          </div>
        ) : null}
      </div>
    </section>
    );
  };

  useEffect(() => {
    if (buyerMode) {
      if (authRoleLoading) return;
      void loadBuyerHotSheets();
      return;
    }
    checkAuth();
  }, [buyerMode, authSessionUser?.id, authRoleLoading]);

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

      let user: User | null = authSessionUser ?? null;
      if (!user) {
        try {
          const { data } = await supabase.auth.getUser();
          user = data?.user ?? null;
        } catch (authErr) {
          console.warn("[HotSheets] auth.getUser failed", authErr);
          user = null;
        }
      }

      const userId = user?.id ?? null;
      if (!userId) {
        navigate("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("email, first_name, last_name")
        .eq("id", userId)
        .maybeSingle();

      const profileName = [profile?.first_name, profile?.last_name]
        .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
        .join(" ");
      setBuyerDisplayName(profileName);

      const { rows, tokenByHotSheetId } = await loadBuyerHotSheetAccess(
        supabase,
        userId,
        profile?.email || user?.email || null,
      );

      if (!rows.length) {
        setBuyerHotSheets([]);
        setBuyerTokenByHotSheetId({});
        setBuyerPreviewPhotosById({});
        setBuyerMatchCountsById({});
        return;
      }

      setBuyerHotSheets(rows as BuyerHotSheetItem[]);
      setBuyerTokenByHotSheetId(tokenByHotSheetId);

      const { photosById, countsById } = await loadHotSheetPhotosAndCounts(
        supabase,
        rows.map((r) => ({ id: r.id, criteria: r.criteria })),
      );
      setBuyerPreviewPhotosById(photosById);
      setBuyerMatchCountsById(countsById);
    } catch (error) {
      console.error("Error loading buyer hot sheets", error);
      toast.error("Unable to load Hot Sheets right now");
      setBuyerDisplayName("");
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
              <AacBackButton type="button" onClick={() => navigate("/client/dashboard")} />

              {renderHotSheetsHero()}

              {buyerLoading ? (
                <section className="grid grid-cols-1 gap-6 bg-white md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
                    >
                      <div className="h-48 w-full animate-pulse bg-neutral-100 md:h-52" />
                      <div className="space-y-3 p-4">
                        <div className="h-6 w-[85%] max-w-[16rem] animate-pulse rounded-md bg-neutral-100" />
                        <div className="h-4 w-24 animate-pulse rounded-md bg-neutral-100" />
                      </div>
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
                <section className="grid grid-cols-1 gap-6 bg-white md:grid-cols-2 lg:grid-cols-3">
                  {buyerHotSheets.map((sheet) => {
                    const token = buyerTokenByHotSheetId[sheet.id];
                    const matchCount = buyerMatchCountsById[sheet.id] ?? 0;
                    return (
                      <BuyerHotSheetPreviewCard
                        key={sheet.id}
                        variant="hotSheetsPage"
                        photoUrls={buyerPreviewPhotosById[sheet.id] ?? []}
                        title={sheet.name}
                        buyerName={buyerDisplayName}
                        matchCount={matchCount}
                        onClick={() => openBuyerHotSheet(sheet.id, token)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openBuyerHotSheet(sheet.id, token);
                          }
                        }}
                        onFavoritesClick={() => navigate("/favorites")}
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
        setCollections([]);
        setPersonalHotSheets([]);
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

      // 3. Personal (no CRM contact) vs buyer-linked sheets
      const clientMap = new Map<string, BuyerCollection>();
      const personal: AgentPersonalHotSheet[] = [];

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
          personal.push({ id: sheet.id, name: sheet.name, photos: sheetPhotos, isActive: !!sheet.is_active });
          continue;
        }

        for (const client of clients) {
          const existing = clientMap.get(client.id);
          if (existing) {
            existing.hotSheets.push({ id: sheet.id, name: sheet.name, isActive: !!sheet.is_active });
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
              hotSheets: [{ id: sheet.id, name: sheet.name, isActive: !!sheet.is_active }],
              photos: sheetPhotos,
              collaborators: collabInitials,
              supportsBuyerFavorites: true,
            });
          }
        }
      }

      setCollections(Array.from(clientMap.values()));
      setPersonalHotSheets(personal);
    } catch (error) {
      console.error("Error fetching hot sheets:", error);
      toast.error("Failed to load hot sheets");
      setAgentLoadError(true);
      setCollections([]);
      setPersonalHotSheets([]);
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
          const { error: inviteFnErr } = await supabase.functions.invoke("send-hot-sheet-invite", {
            body: { invitedEmail: friendEmail.toLowerCase(), inviterName: user.email?.split("@")[0] || "A friend", hotSheetName: hotSheet.name, hotSheetLink: `${window.location.origin}/hot-sheets` },
          });
          if (inviteFnErr) console.error("Failed to enqueue invite email:", inviteFnErr);
          else {
            void supabase.functions.invoke("kick-email-queue").catch((e) => {
              console.warn("[HotSheets] kick-email-queue failed after friend share enqueue", e);
            });
          }
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

  const openPersonalHotSheet = (sheetId: string) => {
    navigate(`/hot-sheets/${sheetId}/review`);
  };

  const renderMyHotSheetsSection = () => (
    <section className={`${AAC_CARD_SHELL} p-5 md:p-6`} aria-labelledby="agent-my-hot-sheets-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id="agent-my-hot-sheets-heading" className={DASH_SECTION_TITLE}>
            My Hot Sheets
          </h2>
          <p className={DASH_SECTION_DESC}>Hot sheets you saved for your own search.</p>
        </div>
        <Button
          type="button"
          size="sm"
          className={`h-8 shrink-0 gap-1.5 px-3 text-xs font-medium ${AAC_PRIMARY_BTN}`}
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          Create Hot Sheet
        </Button>
      </div>

      <div className="mt-5">
        {personalHotSheets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-10 text-center">
            <p className="text-sm text-neutral-600">
              No personal hot sheets yet. Save a search from listing results or create one here.
            </p>
          </div>
        ) : (
          <div className={AGENT_HOT_SHEETS_CARD_GRID}>
            {personalHotSheets.map((sheet) => (
              <BuyerCollectionCard
                key={sheet.id}
                clientName={sheet.name}
                hotSheetCount={1}
                photos={sheet.photos}
                nameLabel="Hot Sheet Name"
                titleCaseName={false}
                onClick={() => openPersonalHotSheet(sheet.id)}
                onEditClick={() => {
                  setEditingHotSheetId(sheet.id);
                  setEditDialogOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );

  const renderBuyersSection = () => (
    <section className={`${AAC_CARD_SHELL} p-5 md:p-6`} aria-labelledby="agent-buyer-hot-sheets-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id="agent-buyer-hot-sheets-heading" className={DASH_SECTION_TITLE}>
            Buyer Hot Sheets
          </h2>
          <p className={DASH_SECTION_DESC}>Hot sheets linked to your buyers.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 rounded-lg border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          Create new buyer hot sheet
        </Button>
      </div>

      <div className="mt-5">
        {collections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-10 text-center">
            <Bell className="mx-auto mb-3 h-10 w-10 text-neutral-300" aria-hidden />
            <p className="text-sm font-medium text-neutral-900">No buyer hot sheets yet</p>
            <p className="mt-1 text-sm text-neutral-600">
              Create a hot sheet and attach a buyer to see collections here.
            </p>
          </div>
        ) : (
          <div className={AGENT_HOT_SHEETS_CARD_GRID}>
            {collections.map((collection) => (
              <BuyerCollectionCard
                key={collection.clientId}
                clientName={collection.clientName}
                hotSheetCount={collection.hotSheets.length}
                photos={collection.photos}
                onClick={() => handleCardClick(collection)}
                onFavoritesClick={
                  isAgentMode && collection.supportsBuyerFavorites
                    ? () => navigate(`/agent/buyers/${collection.clientId}/favorites`)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );

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
        {renderAgentBackLink()}
        <div className="mb-5 md:mb-6">{renderHotSheetsHero()}</div>
        <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Loading hot sheets…</span>
          <div className={`${AAC_CARD_SHELL} p-5 md:p-6`}>
            <Skeleton className="h-5 w-40 rounded-md bg-neutral-100" />
            <Skeleton className="mt-2 h-4 w-64 max-w-full rounded-md bg-neutral-100" />
            <div className={`mt-5 ${AGENT_HOT_SHEETS_CARD_GRID}`}>
              {[1, 2].map((i) => (
                <AgentHotSheetCardSkeleton key={i} />
              ))}
            </div>
          </div>
          <div className={`${AAC_CARD_SHELL} p-5 md:p-6`}>
            <Skeleton className="h-5 w-36 rounded-md bg-neutral-100" />
            <Skeleton className="mt-2 h-4 w-56 max-w-full rounded-md bg-neutral-100" />
            <div className={`mt-5 ${AGENT_HOT_SHEETS_CARD_GRID}`}>
              {[1, 2, 3].map((i) => (
                <AgentHotSheetCardSkeleton key={i} />
              ))}
            </div>
          </div>
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
        {renderAgentBackLink()}
        <div className="mb-5 md:mb-6">
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
        ) : (
          <div className="space-y-6">
            {renderBuyersSection()}
            {renderMyHotSheetsSection()}
          </div>
        )}
      </PageShell>

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

import { useState, useEffect, useCallback, useMemo, type ComponentProps } from "react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { useParams, useNavigate, useMatch } from "react-router-dom";
import Footer from "@/components/Footer";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { ListChecks, MapPin, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";
import { cn } from "@/lib/utils";
import { AacBackButton } from "@/components/layout/AacBackLink";
import { enforceClientIdentity } from "@/lib/enforceClientIdentity";
import { User } from "@supabase/supabase-js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { AddFriendDialog } from "@/components/AddFriendDialog";
import ListingCard from "@/components/ListingCard";
import { ListingConversationSheet } from "@/components/messaging/ListingConversationSheet";
import {
  fetchListingConversationMessagesMap,
  mergeListingThreadMessages,
  type ListingCardThreadMessage,
} from "@/lib/listingConversationThread";
import type { ListedByAgentProfile } from "@/lib/listingListedBy";
import { formatCriteriaDisplayLabels } from "@/lib/formatCriteriaDisplay";
import { formatHotSheetRef } from "@/lib/formatHotSheetRef";
import {
  buyerMarketListingTileMediaWrap,
  buyerPageMain,
  buyerPageShell,
} from "@/lib/buyerUi";
import { deleteHotSheetWithClientLinks } from "@/lib/deleteHotSheetBuyerAuthorized";

/** Listing results grid — same rhythm as agent `HotSheetReview` matches. */
const BUYER_HOT_SHEET_RESULTS_GRID =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 lg:gap-5";

const BUYER_HOT_SHEET_ACTION_BTN =
  "h-8 shrink-0 gap-1.5 rounded-md border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:border-neutral-300 hover:bg-neutral-50/80";

function getCriteriaSummaryLine(criteria: Record<string, unknown>): {
  scope: string;
  state: string;
  statuses: string;
} {
  const c = criteria ?? {};
  const towns = (c.cities || c.towns || []) as string[];
  const scope =
    towns.length > 0
      ? towns.length > 4
        ? `${towns.slice(0, 3).join(", ")} (+${towns.length - 3} more)`
        : towns.join(", ")
      : c.state
        ? `All of ${String(c.state)}`
        : "No location filter";
  return {
    scope,
    state: c.state ? String(c.state) : "—",
    statuses: Array.isArray(c.statuses) && c.statuses.length
      ? formatCriteriaDisplayLabels(c.statuses as string[])
      : "—",
  };
}

/** Row from `buildListingsQuery` with optional embed for “Listed by” */
interface HotSheetListingRow {
  id: string;
  listing_number?: string | null;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  neighborhood?: string | null;
  agent_id: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  property_type: string | null;
  photos: any;
  description?: string | null;
  status: string;
  agent_profile?: ListedByAgentProfile;
  [key: string]: unknown;
}

function mergeListingAgentProfiles<T extends { agent_id?: string | null }>(
  rows: T[],
  agentsData: { id: string; first_name: string; last_name: string; company: string | null; office_name: string | null }[],
): (T & { agent_profile?: ListedByAgentProfile })[] {
  const byId = new Map(agentsData.map((a) => [a.id, a]));
  return rows.map((l) => {
    const aid = l.agent_id;
    if (typeof aid !== "string" || !byId.has(aid)) return { ...l } as T & { agent_profile?: ListedByAgentProfile };
    const a = byId.get(aid)!;
    return {
      ...l,
      agent_profile: {
        company: a.company,
        office_name: a.office_name,
        first_name: a.first_name,
        last_name: a.last_name,
      },
    };
  });
}

const ClientHotsheetPage = () => {
  const { token, id: hotSheetIdParam } = useParams<{ token?: string; id?: string }>();
  const navigate = useNavigate();
  const buyerByIdMatch = useMatch({ path: "/client/hot-sheets/:id", end: true });
  const isBuyerHotSheetByIdRoute = Boolean(buyerByIdMatch && hotSheetIdParam);
  /** Id route lives in BuyerShell; token route is standalone (legacy top offset). */
  const contentTopClass = isBuyerHotSheetByIdRoute ? "" : "pt-20";
  const buyerHotSheetMainClass = isBuyerHotSheetByIdRoute
    ? "mx-auto w-full max-w-7xl px-6 pt-4 pb-12 md:px-8"
    : buyerPageMain;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hotSheet, setHotSheet] = useState<any>(null);
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [listings, setListings] = useState<HotSheetListingRow[]>([]);
  const [tokenData, setTokenData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showEditCriteria, setShowEditCriteria] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  /** Per-listing `hot_sheet_comments` for compact card thread + drawer */
  const [listingChatByListingId, setListingChatByListingId] = useState<Record<string, ListingCardThreadMessage[]>>({});
  const [listingChatOpen, setListingChatOpen] = useState(false);
  const [listingChatListingId, setListingChatListingId] = useState<string | null>(null);
  const [deleteHotSheetOpen, setDeleteHotSheetOpen] = useState(false);
  const [deleteHotSheetBusy, setDeleteHotSheetBusy] = useState(false);
  const [selectedListingIds, setSelectedListingIds] = useState<Set<string>>(new Set());
  const hidePublicFooter = isBuyerHotSheetByIdRoute || Boolean(currentUser);
  /** Selection + share toolbar and card checkboxes (signed-in buyer with loaded sheet). */
  const enableBuyerListingSelection = Boolean(
    hotSheet?.id && (isBuyerHotSheetByIdRoute || currentUser),
  );

  /** Buyer portal listing detail + back (BuyerShell `/consumer-property/:id`). */
  const buyerHotSheetReturnPath = useMemo(() => {
    if (!hotSheet?.id || !currentUser) return null;
    if (isBuyerHotSheetByIdRoute && hotSheetIdParam) {
      return `/client/hot-sheets/${hotSheetIdParam}`;
    }
    return `/client/hot-sheets/${hotSheet.id}`;
  }, [hotSheet?.id, currentUser, isBuyerHotSheetByIdRoute, hotSheetIdParam]);

  const getBuyerListingDetailPath = useCallback(
    (listingId: string) => {
      if (!buyerHotSheetReturnPath) return undefined;
      const q = new URLSearchParams({ returnTo: buyerHotSheetReturnPath });
      return `/consumer-property/${listingId}?${q.toString()}`;
    },
    [buyerHotSheetReturnPath],
  );

  const toggleListingSelection = useCallback((id: string) => {
    setSelectedListingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllListings = useCallback(() => {
    if (selectedListingIds.size === listings.length && listings.length > 0) {
      setSelectedListingIds(new Set());
    } else {
      setSelectedListingIds(new Set(listings.map((l) => l.id)));
    }
  }, [listings, selectedListingIds.size]);

  const clearListingSelection = useCallback(() => {
    setSelectedListingIds(new Set());
  }, []);

  useEffect(() => {
    const validIds = new Set(listings.map((l) => l.id));
    setSelectedListingIds((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [listings]);

  const handleListingChatMessage = useCallback((msg: ListingCardThreadMessage) => {
    setListingChatByListingId((prev) => {
      const lid = msg.listing_id;
      const cur = prev[lid] ?? [];
      if (cur.some((m) => m.id === msg.id)) return prev;
      return { ...prev, [lid]: [...cur, msg] };
    });
  }, []);

  useEffect(() => {
    if (hotSheetIdParam) {
      loadBuyerHotSheetById(hotSheetIdParam);
    } else if (token) {
      validateAndLoadHotsheet();
    } else {
      setError("No hot sheet specified");
      setLoading(false);
    }
  }, [token, hotSheetIdParam]);

  // Check authentication status
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Enforce client identity after token data is loaded
  useEffect(() => {
    if (!tokenData || !tokenData.payload) return;

    const payload = tokenData.payload as any;
    const clientEmailFromToken = payload?.client_email || payload?.email || null;

    enforceClientIdentity({
      supabase,
      clientEmailFromToken,
      setCurrentUser,
      setShowLoginPrompt,
    });
  }, [tokenData]);

  // Persist invite acceptance for signed-in buyers so dashboard can reliably
  // restore shared hot sheets from accepted tokens.
  useEffect(() => {
    const markTokenAccepted = async () => {
      if (hotSheetIdParam || !token || !tokenData || !currentUser) return;

      const payload = (tokenData.payload as any) || {};
      const tokenEmail = String(payload?.client_email || payload?.email || "").toLowerCase().trim();
      const currentEmail = (currentUser.email || "").toLowerCase().trim();

      // Do not claim acceptance for a different intended recipient.
      if (tokenEmail && currentEmail && tokenEmail !== currentEmail) return;

      // Skip if already accepted by someone else.
      if (tokenData.accepted_by_user_id && tokenData.accepted_by_user_id !== currentUser.id) return;

      if (tokenData.accepted_by_user_id === currentUser.id && tokenData.accepted_at) return;

      const acceptedAt = new Date().toISOString();
      const { error } = await supabase
        .from("share_tokens")
        .update({
          accepted_at: tokenData.accepted_at || acceptedAt,
          accepted_by_user_id: currentUser.id,
        })
        .eq("token", token);

      if (error) {
        console.error("Failed to persist token acceptance", error);
        return;
      }

      setTokenData((prev: any) => ({
        ...prev,
        accepted_at: prev?.accepted_at || acceptedAt,
        accepted_by_user_id: currentUser.id,
      }));
    };

    void markTokenAccepted();
  }, [hotSheetIdParam, token, tokenData, currentUser]);

  useEffect(() => {
    const hsId = hotSheet?.id as string | undefined;
    if (!hsId || listings.length === 0) {
      setListingChatByListingId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const ids = listings.map((l) => l.id);
      const agentId = typeof hotSheet?.user_id === "string" ? hotSheet.user_id.trim() : "";
      const { data, error } = await supabase
        .from("hot_sheet_comments")
        .select("id, hot_sheet_id, listing_id, comment, sender_role, sender_id, created_at")
        .eq("hot_sheet_id", hsId)
        .in("listing_id", ids)
        .order("created_at", { ascending: true });
      if (error || cancelled) return;
      const map: Record<string, ListingCardThreadMessage[]> = {};
      for (const row of data ?? []) {
        const lid = row.listing_id;
        if (!lid) continue;
        if (!map[lid]) map[lid] = [];
        map[lid].push(row as ListingCardThreadMessage);
      }

      let merged = map;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id && agentId && ids.length > 0) {
        const convoMap = await fetchListingConversationMessagesMap(ids, user.id, agentId, agentId);
        merged = mergeListingThreadMessages(convoMap, map);
      }

      if (!cancelled) setListingChatByListingId(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [hotSheet?.id, listings]);

  const loadBuyerHotSheetById = async (hotSheetId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        toast.error("Please sign in to view this hot sheet.");
        navigate("/auth", { replace: true });
        return;
      }

      const { data: linkRow, error: linkError } = await supabase
        .from("hot_sheet_clients")
        .select("hot_sheet_id")
        .eq("hot_sheet_id", hotSheetId)
        .maybeSingle();

      if (linkError) {
        throw linkError;
      }
      if (!linkRow) {
        throw new Error("You do not have access to this hot sheet.");
      }

      const { data: hotSheetRaw, error: hotSheetError } = await supabase
        .rpc("get_hot_sheet_for_member" as any, { _hot_sheet_id: hotSheetId } as any)
        .single();

      if (hotSheetError || !hotSheetRaw) {
        throw hotSheetError || new Error("Saved search not found");
      }
      const hotSheetData = hotSheetRaw as any;

      if (hotSheetData.user_id) {
        document.cookie = `primary_agent_id=${hotSheetData.user_id}; path=/; max-age=${
          60 * 60 * 24 * 365
        }`;
        localStorage.setItem("primary_agent_id", hotSheetData.user_id);
      }
      if (hotSheetData.client_id) {
        localStorage.setItem("client_id", hotSheetData.client_id);
      }

      setHotSheet(hotSheetData);

      const { data: agentData, error: agentError } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("id", hotSheetData.user_id)
        .single();

      if (agentError) {
        throw agentError;
      }

      setAgentProfile(agentData);
      setAgent(agentData);

      const loadedCriteria = (hotSheetData.criteria as any) || {};
      const query = buildListingsQuery(supabase, loadedCriteria).limit(200);
      const { data: listingsData, error: listingsError } = await query;

      if (listingsError) {
        throw listingsError;
      }

      const rawListings = listingsData || [];
      const agentIds = Array.from(
        new Set(rawListings.map((l: { agent_id?: string | null }) => l.agent_id).filter((id): id is string => Boolean(id))),
      );
      let hydrated: HotSheetListingRow[] = rawListings as HotSheetListingRow[];
      if (agentIds.length > 0) {
        const { data: agentsData, error: agentsError } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, company, office_name")
          .in("id", agentIds);
        if (!agentsError && agentsData?.length) {
          hydrated = mergeListingAgentProfiles(rawListings as { agent_id?: string }[], agentsData) as any;
        }
      }
      setListings(hydrated);

      setLoading(false);
    } catch (err: any) {
      console.error("Client hotsheet by id load error", err);
      setLoading(false);
      toast.error("We couldn't open this hot sheet.");
      navigate("/hot-sheets", { replace: true });
    }
  };

  const validateAndLoadHotsheet = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!token) {
        throw new Error("Missing token in URL params");
      }

      // 1) Validate token via SECURITY DEFINER RPC
      const { data: tokenRpc, error: tokenError } = await supabase
        .rpc("resolve_share_token", { _token: token });
      const tokenData = (tokenRpc ?? null) as any;

      if (tokenError) {
        throw tokenError;
      }

      if (!tokenData) {
        throw new Error("Share token not found");
      }

      console.log("Client hotsheet share token", tokenData);
      
      // Store token data for identity enforcement
      setTokenData(tokenData);

      // Check if token is expired (only if expires_at is set and in the past)
      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        throw new Error("Share token expired");
      }

      // 2) Parse payload - assume it contains hot_sheet_id and optional client_id
      let payload: any = tokenData.payload;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch (parseError) {
          throw new Error("Invalid payload JSON on share token");
        }
      }

      console.log("Client hotsheet payload", payload);

      const hotSheetId =
        payload?.hot_sheet_id || payload?.hotSheetId || payload?.hotsheetId;

      if (!hotSheetId) {
        throw new Error("No hot_sheet_id found in share token payload");
      }

      // 3) Set agent + client context (cookie / localStorage)
      if (tokenData.agent_id) {
        document.cookie = `primary_agent_id=${tokenData.agent_id}; path=/; max-age=${
          60 * 60 * 24 * 365
        }; SameSite=Lax`;
        localStorage.setItem("primary_agent_id", tokenData.agent_id);
      }

      if (payload.client_id) {
        localStorage.setItem("client_id", payload.client_id);
      }

      // 4) Fetch agent profile
      if (tokenData.agent_id) {
        const { data: agentData, error: agentError } = await supabase
          .from("agent_profiles")
          .select("*")
          .eq("id", tokenData.agent_id)
          .single();

        if (agentError) {
          throw agentError;
        }

        setAgentProfile(agentData);
        setAgent(agentData);
      }

      // 5) Fetch hot sheet details
      const { data: hotSheetRaw, error: hotSheetError } = await supabase
        .rpc("get_hot_sheet_by_token" as any, { _token: token } as any)
        .single();

      if (hotSheetError || !hotSheetRaw) {
        throw hotSheetError || new Error("Saved search not found");
      }
      const hotSheetData = hotSheetRaw as any;

      console.log("Client hotsheet hotSheet", hotSheetData);
      setHotSheet(hotSheetData);

      // 6) Fetch matching listings using hot sheet criteria
      const loadedCriteria = (hotSheetData.criteria as any) || {};
      const query = buildListingsQuery(supabase, loadedCriteria).limit(200);
      const { data: listingsData, error: listingsError } = await query;

      if (listingsError) {
        throw listingsError;
      }

      console.log("Client hotsheet listings", listingsData);
      const rawListings = listingsData || [];
      const agentIds = Array.from(
        new Set(rawListings.map((l: { agent_id?: string | null }) => l.agent_id).filter((id): id is string => Boolean(id))),
      );
      let hydrated: HotSheetListingRow[] = rawListings as HotSheetListingRow[];
      if (agentIds.length > 0) {
        const { data: agentsData, error: agentsError } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, company, office_name")
          .in("id", agentIds);
        if (!agentsError && agentsData?.length) {
          hydrated = mergeListingAgentProfiles(rawListings as { agent_id?: string }[], agentsData) as any;
        }
      }
      setListings(hydrated);

      // ✅ SUCCESS – stop loading
      setLoading(false);
    } catch (err: any) {
      console.error("Client hotsheet load error", err);

      const reason =
        err?.message ||
        err?.error_description ||
        err?.hint ||
        (typeof err === "string" ? err : JSON.stringify(err));

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        toast.error("We could not open this specific shared hot sheet. Taking you to your dashboard.");
        navigate("/client/dashboard", { replace: true });
        return;
      }

      setError(
        `We could not load this saved search. (${reason}) Please contact your agent or try the link again.`
      );
      setLoading(false);
    }
  };

  const handleUpdateCriteria = async (
    _hotSheetId?: string,
    updatedHotSheet?: { id: string; name: string; criteria: Record<string, unknown> | null }
  ) => {
    if (updatedHotSheet) {
      setHotSheet((prev: any) =>
        prev
          ? {
              ...prev,
              name: updatedHotSheet.name,
              criteria: updatedHotSheet.criteria,
            }
          : prev
      );
      return;
    }

    if (hotSheetIdParam) {
      await loadBuyerHotSheetById(hotSheetIdParam);
    } else {
      await validateAndLoadHotsheet();
    }
  };

  const handleConfirmDeleteHotSheet = async () => {
    const id = hotSheet?.id as string | undefined;
    if (!id || deleteHotSheetBusy) return;
    setDeleteHotSheetBusy(true);
    try {
      const { error } = await deleteHotSheetWithClientLinks(supabase, id);
      if (error) {
        toast.error(error.message || "Unable to delete this hot sheet.");
        return;
      }
      toast.success("Hot sheet deleted for your group.");
      setDeleteHotSheetOpen(false);
      navigate("/hot-sheets", { replace: true });
    } finally {
      setDeleteHotSheetBusy(false);
    }
  };

  const handleSetupLogin = () => {
    setShowLoginPrompt(false);

    // Canonical green-branded invite acceptance page (token in the URL path).
    // Pass email/agent/client as query params for prefill; the page also reads
    // them from the token payload itself.
    const payload = tokenData?.payload as any;
    const clientEmail = payload?.client_email || payload?.email || "";
    const clientId = payload?.client_id || "";

    const params = new URLSearchParams();
    if (clientEmail) params.set("email", clientEmail);
    if (agentProfile?.id) params.set("agent_id", agentProfile.id);
    if (clientId) params.set("client_id", clientId);

    const query = params.toString();
    navigate(`/invite/${token}${query ? `?${query}` : ""}`);
  };

  if (loading) {
    return (
      <div className={`flex min-h-screen flex-col bg-white ${contentTopClass}`}>
        <main className="flex flex-1 items-center justify-center px-4">
          <AacMonogramLoader variant="section" className="min-h-[50vh]" message="Loading your saved search..." />
        </main>
        {!hidePublicFooter && <Footer />}
      </div>
    );
  }

  if (!loading && error) {
    return (
      <div className={`flex min-h-screen flex-col bg-white ${contentTopClass}`}>
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full p-6 text-center">
            <h1 className="text-xl font-semibold mb-2">We hit a snag</h1>
            <p className="text-muted-foreground mb-4">
              We could not load this saved search. Please contact your agent or try the link again.
            </p>
            <Button onClick={() => navigate("/")}>Back to home</Button>
          </Card>
        </main>
        {!hidePublicFooter && <Footer />}
      </div>
    );
  }

  const criteriaSummary = getCriteriaSummaryLine(
    (hotSheet?.criteria || {}) as Record<string, unknown>
  );

  // Show luxury onboarding modal for anonymous users BEFORE rendering main content
  if (showLoginPrompt && !currentUser && agentProfile) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-[600px]" hideCloseButton>
            <DialogHeader>
              {/* Buyer Portal brand lockup */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                <AACMonogram className="h-9 w-9 flex-shrink-0 text-[#16A34A]" />
                <div className="leading-tight text-left">
                  <p className="text-[15px] font-semibold tracking-[-0.01em] text-zinc-900">All Agent Connect</p>
                  <p className="text-[12px] font-medium tracking-[0.02em] text-zinc-500">Buyer Portal</p>
                </div>
              </div>

              {/* Agent Header Section */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                <div className="relative h-12 w-12 rounded-full overflow-hidden border border-neutral-200 bg-white flex items-center justify-center">
                  {agentProfile.headshot_url ? (
                    <img 
                      src={agentProfile.headshot_url} 
                      alt={agentProfile.first_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-semibold text-muted-foreground">
                      {agentProfile.first_name?.charAt(0)}{agentProfile.last_name?.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">You're setting up your access with</p>
                  <p className="font-semibold text-foreground">{agentProfile.first_name} {agentProfile.last_name}</p>
                </div>
              </div>
              
              <DialogTitle className="text-2xl">
                Secure Your Access to All Agent Connect
              </DialogTitle>
              <DialogDescription className="pt-4 space-y-4 text-base leading-relaxed">
                <p className="text-foreground/90">
                  {agentProfile.first_name} has curated a personalized collection of homes for you. 
                  To continue exploring your saved search, please set up your All Agent Connect login.
                </p>
                <div className="pt-2">
                  <p className="font-medium text-foreground/90 mb-3">Creating your login ensures you can:</p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-3">
                      <span className="text-[#16A34A] mt-0.5">•</span>
                      <span className="text-foreground/80">View your homes anytime</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#16A34A] mt-0.5">•</span>
                      <span className="text-foreground/80">Save and organize your saved homes</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#16A34A] mt-0.5">•</span>
                      <span className="text-foreground/80">Message {agentProfile.first_name} directly</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#16A34A] mt-0.5">•</span>
                      <span className="text-foreground/80">Access your search securely from any device</span>
                    </li>
                  </ul>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="pt-4">
              <Button
                onClick={handleSetupLogin}
                className="w-full h-11 bg-[#16A34A] hover:bg-[#15803D] text-white font-medium"
                size="lg"
              >
                Set Up My Account
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${buyerPageShell} ${contentTopClass}`}>
      <main className={`flex-1 ${buyerHotSheetMainClass}`}>
        <div>
          <header className="mb-4">
            <AacBackButton
              type="button"
              onClick={() => navigate(isBuyerHotSheetByIdRoute ? "/hot-sheets" : "/client/dashboard")}
              className="mb-3 max-w-full py-0.5 text-left"
            />

            <div className="flex flex-col gap-1 border-b border-neutral-200 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl">Hot sheet matches</h1>
                <p className="mt-1.5 text-[13px] leading-snug sm:text-[14px]" title={hotSheet?.name ?? undefined}>
                  <span className="text-neutral-500">Hot Sheet Name: </span>
                  <span className="font-semibold text-neutral-900">{hotSheet?.name || "Untitled hot sheet"}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:mb-0.5">
                {isBuyerHotSheetByIdRoute ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={BUYER_HOT_SHEET_ACTION_BTN}
                    onClick={() => navigate("/client/hotsheets/new")}
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    New hot sheet
                  </Button>
                ) : null}
                {hotSheet?.id ? (
                  <span className="text-[11px] font-medium tabular-nums text-neutral-400">
                    {formatHotSheetRef(hotSheet.id)}
                  </span>
                ) : null}
              </div>
            </div>
          </header>

          <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:px-4 sm:py-3.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">Search criteria</p>
                    <p className="text-[13px] leading-snug text-neutral-700">
                      <span className="font-medium text-neutral-800">Scope</span>{" "}
                      <span className="text-neutral-600">{criteriaSummary.scope}</span>
                      <span className="mx-2 text-neutral-200" aria-hidden>
                        ·
                      </span>
                      <span className="font-medium text-neutral-800">State</span>{" "}
                      <span className="tabular-nums text-neutral-600">{criteriaSummary.state}</span>
                      <span className="mx-2 text-neutral-200" aria-hidden>
                        ·
                      </span>
                      <span className="font-medium text-neutral-800">Status</span>{" "}
                      <span className="text-neutral-600">{criteriaSummary.statuses}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:self-center">
                <Button
                  type="button"
                  variant="outline"
                  className={BUYER_HOT_SHEET_ACTION_BTN}
                  onClick={() => setShowAddFriend(true)}
                >
                  <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Add a friend
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!hotSheet?.user_id}
                  className={BUYER_HOT_SHEET_ACTION_BTN}
                  onClick={() => {
                    if (!hotSheet?.user_id) {
                      toast.error("This hot sheet cannot be edited right now");
                      return;
                    }
                    setShowEditCriteria(true);
                  }}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  Edit criteria
                </Button>
                {isBuyerHotSheetByIdRoute ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={`${BUYER_HOT_SHEET_ACTION_BTN} border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50/90`}
                    onClick={() => setDeleteHotSheetOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Delete hot sheet
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Add Friend Dialog */}
          <AddFriendDialog open={showAddFriend} onOpenChange={setShowAddFriend} />

          {hotSheet?.user_id && (
            <CreateHotSheetDialog
              key={hotSheet.id}
              open={showEditCriteria}
              onOpenChange={setShowEditCriteria}
              userId={hotSheet.user_id}
              hotSheetId={hotSheet.id}
              editMode
              onSuccess={handleUpdateCriteria}
            />
          )}

          {/* Listings — toolbar + grid (matches agent Hot Sheet results) */}
          <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 sm:px-0.5">
                <span className="text-[13px] font-semibold tracking-tight text-neutral-900">
                  Matches <span className="font-normal tabular-nums text-neutral-500">{listings.length}</span>
                </span>
                {enableBuyerListingSelection && listings.length > 0 && selectedListingIds.size > 0 ? (
                  <span className="text-[12px] tabular-nums text-neutral-500">
                    ({selectedListingIds.size} selected)
                  </span>
                ) : null}
              </div>
              {enableBuyerListingSelection && listings.length > 0 ? (
                <div
                  className="flex flex-wrap items-center gap-2 px-1 sm:px-0.5"
                  aria-label="Result actions"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAllListings}
                    className={BUYER_HOT_SHEET_ACTION_BTN}
                  >
                    <ListChecks className="mr-1 h-3 w-3 shrink-0 text-neutral-600" aria-hidden />
                    {selectedListingIds.size === listings.length ? "Deselect all" : "Select all"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={selectedListingIds.size === 0}
                    onClick={clearListingSelection}
                    className={cn(BUYER_HOT_SHEET_ACTION_BTN, "disabled:opacity-50")}
                  >
                    Clear selection
                  </Button>
                  <BulkShareListingsDialog
                    listingIds={Array.from(selectedListingIds)}
                    listingCount={selectedListingIds.size}
                    senderProfileSource="buyer"
                    triggerVariant="outline"
                    triggerClassName={cn(
                      BUYER_HOT_SHEET_ACTION_BTN,
                      "[&_svg]:mr-1 [&_svg]:!h-3 [&_svg]:!w-3 [&_svg]:text-neutral-600",
                    )}
                    triggerLabel="Share selected"
                    onSuccessfulShare={clearListingSelection}
                  />
                </div>
              ) : isBuyerHotSheetByIdRoute && !currentUser ? (
                <p className="px-1 text-[12px] leading-snug text-neutral-500 sm:px-0.5">
                  Results update as new listings match your saved criteria.
                </p>
              ) : null}
            </div>
          </div>

          {listings.length === 0 ? (
            <Card className="rounded-xl border border-neutral-200 bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-10">
              <CardContent className="mx-auto max-w-md space-y-2 p-0 text-center">
                <p className="text-sm font-semibold text-neutral-900">No matching homes on the network right now</p>
                <p className="text-[13px] leading-relaxed text-neutral-500">
                  Your hot sheet and criteria are saved. Check back soon — new listings that fit your search will show up here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className={BUYER_HOT_SHEET_RESULTS_GRID}>
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing as ComponentProps<typeof ListingCard>["listing"]}
                  viewMode="compact"
                  showActions={false}
                  showCompactComments
                  hideFavoriteTooltip
                  hotSheetId={hotSheet?.id}
                  chatMessages={listingChatByListingId[listing.id] ?? []}
                  onNewMessage={handleListingChatMessage}
                  compactListingDetailTo={
                    buyerHotSheetReturnPath ? getBuyerListingDetailPath(listing.id) : undefined
                  }
                  compactDetailNavigateState={
                    buyerHotSheetReturnPath ? { from: buyerHotSheetReturnPath } : undefined
                  }
                  onOpenChat={() => {
                    setListingChatListingId(listing.id);
                    setListingChatOpen(true);
                  }}
                  {...(enableBuyerListingSelection
                    ? {
                        onSelect: toggleListingSelection,
                        isSelected: selectedListingIds.has(listing.id),
                        compactSelectionAccent: "aacGreen" as const,
                      }
                    : {})}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {listingChatListingId && hotSheet?.user_id ? (
        <ListingConversationSheet
          open={listingChatOpen}
          onOpenChange={(open) => {
            setListingChatOpen(open);
            if (!open) setListingChatListingId(null);
          }}
          listingId={listingChatListingId}
          otherUserId={hotSheet.user_id}
          hotSheetId={hotSheet.id}
          hotSheetAgentUserId={hotSheet.user_id}
          threadTitle={(() => {
            const row = listings.find((l) => l.id === listingChatListingId);
            return row ? `${row.address}, ${row.city}` : "Listing discussion";
          })()}
          onInboxInvalidate={() => {
            void (async () => {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              const agentId = hotSheet?.user_id;
              if (!user?.id || !agentId || !listingChatListingId) return;
              const convoMap = await fetchListingConversationMessagesMap(
                [listingChatListingId],
                user.id,
                agentId,
                agentId,
              );
              setListingChatByListingId((prev) =>
                mergeListingThreadMessages(convoMap, {
                  [listingChatListingId]: prev[listingChatListingId] ?? [],
                }),
              );
            })();
          }}
        />
      ) : null}

      <AlertDialog
        open={deleteHotSheetOpen}
        onOpenChange={(open) => {
          if (!open && !deleteHotSheetBusy) setDeleteHotSheetOpen(false);
        }}
      >
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this hot sheet for everyone?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <strong className="font-medium text-foreground">{hotSheet?.name ?? "this hot sheet"}</strong> for the
              whole shared group — anyone on this sheet (friends, family, shared contacts) loses access — and stops alerts. Your
              agent will no longer see it on your activity. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteHotSheetBusy}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteHotSheetBusy}
              onClick={() => void handleConfirmDeleteHotSheet()}
            >
              {deleteHotSheetBusy ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!hidePublicFooter && <Footer />}
    </div>
  );
};

export default ClientHotsheetPage;

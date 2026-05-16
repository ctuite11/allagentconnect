import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, MapPin, ChevronDown, ArrowLeft, Pencil, Heart } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { EditHotsheetCriteriaDialog } from "@/components/EditHotsheetCriteriaDialog";
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
import ListingCard from "@/components/ListingCard";
import { type ChatMessage } from "@/components/ListingChatDrawer";
import { ListingConversationSheet } from "@/components/messaging/ListingConversationSheet";
import {
  fetchListingConversationMessagesMap,
  mergeListingThreadMessages,
} from "@/lib/listingConversationThread";
import { BuyerRowStatusPill } from "@/components/agent/BuyerRowStatusPill";
import { useAgentLastSeen } from "@/hooks/useAgentLastSeen";

function BuyerInitialsAvatar({ displayName, userId }: { displayName: string; userId?: string | null }) {
  const { isOnline } = useAgentLastSeen(userId || undefined);
  const initials = (displayName || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("") || "?";
  return (
    <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700">
      {initials}
      {isOnline && (
        <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
      )}
    </span>
  );
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { buildListingsQuery } from "@/lib/buildListingsQuery";
import type { ListedByAgentProfile } from "@/lib/listingListedBy";
import { formatHotSheetRef } from "@/lib/formatHotSheetRef";
import { formatCriteriaDisplayLabels } from "@/lib/formatCriteriaDisplay";

/** One row per `hot_sheet_clients` recipient for compact review strip. */
interface ReviewRecipient {
  clientId: string;
  displayName: string;
  email: string;
  phone: string | null;
  inviteAccepted: boolean;
  /** Present when invite pending and a share token exists (for Resend). */
  resendTokenId?: string;
  resendToken?: string;
  /**
   * True only if this CRM contact has never been invited (agent-wide) and is not buyer-linked —
   * primary Send may enqueue a one-time dashboard/search invite email.
   */
  sendDashboardInvite: boolean;
  /** Active agent–client relationship with a linked buyer account (they are already in search). */
  buyerLinked: boolean;
  /** Linked auth user id (when buyer has accepted) — drives presence dot. */
  authUserId?: string;
}

function getCriteriaSummaryLine(criteria: any): { scope: string; state: string; statuses: string } {
  const c = criteria ?? {};
  const towns = c.cities || c.towns || [];
  const scope =
    towns.length > 0
      ? towns.length > 4
        ? `${towns.slice(0, 3).join(", ")} (+${towns.length - 3} more)`
        : towns.join(", ")
      : c.state
        ? `All of ${c.state}`
        : "No location filter";
  return {
    scope,
    state: c.state ? String(c.state) : "—",
    statuses: c.statuses?.length ? formatCriteriaDisplayLabels(c.statuses as string[]) : "—",
  };
}

interface Listing {
  id: string;
  listing_number: string;
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
  attom_data?: any;
  created_at: string;
  status: string;
  agent_profile?: ListedByAgentProfile;
}

interface HotSheet {
  id: string;
  name: string;
  criteria: any;
  last_sent_at?: string | null;
  client_id?: string | null;
}

const HotSheetReview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const originFrom = (location.state as any)?.from as string | undefined;
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hotSheet, setHotSheet] = useState<HotSheet | null>(null);
  const [editCriteriaOpen, setEditCriteriaOpen] = useState(false);
  const [agentUserId, setAgentUserId] = useState<string | null>(null);
  const [agentDisplayName, setAgentDisplayName] = useState("Your agent");
  const [listings, setListings] = useState<Listing[]>([]);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>({});
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState("newest");
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [chatListingId, setChatListingId] = useState<string | null>(null);
  const [confirmInviteOpen, setConfirmInviteOpen] = useState(false);
  const [clientCount, setClientCount] = useState<number>(0);
  const [invitesSent, setInvitesSent] = useState(false);
  const [unacceptedCount, setUnacceptedCount] = useState(0);
  const [acceptedCount, setAcceptedCount] = useState(0);
  /** Buyer auth user id for mirroring listing comments into `/messages`; null if none linked */
  const [conversationRecipientBuyerId, setConversationRecipientBuyerId] = useState<string | null>(null);
  /** CRM buyer id to return to buyer hot sheet list when applicable */
  const [buyerContextClientId, setBuyerContextClientId] = useState<string | null>(null);
  const [reviewRecipients, setReviewRecipients] = useState<ReviewRecipient[]>([]);
  const [removedListingsOpen, setRemovedListingsOpen] = useState(false);
  /** Buyer hot-sheet saves — read-only hearts on shared workspace cards */
  const [buyerHotSheetFavoriteIds, setBuyerHotSheetFavoriteIds] = useState<Set<string>>(new Set());

  const isSharedWorkspace = useMemo(
    () =>
      reviewRecipients.length > 0 &&
      reviewRecipients.every((r) => r.inviteAccepted || r.buyerLinked),
    [reviewRecipients],
  );

  useEffect(() => {
    setConversationRecipientBuyerId(null);
    setBuyerContextClientId(null);
    setReviewRecipients([]);
    setRemovedListingsOpen(false);
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchHotSheetAndListings();
    }
  }, [id]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`hotsheet-chat-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "hot_sheet_comments",
          filter: `hot_sheet_id=eq.${id}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessagesMap((prev) => {
            const lid = newMsg.listing_id;
            const existing = prev[lid] || [];
            // Dedupe by id
            if (existing.some((m) => m.id === newMsg.id)) return prev;
            return { ...prev, [lid]: [...existing, newMsg] };
          });
          // Toast for client messages
          if (newMsg.sender_role === "client") {
            const listing = listings.find((l) => l.id === newMsg.listing_id);
            const addr = listing ? `${listing.address}, ${listing.city}` : "a listing";
            toast.info(`New message — ${addr}`);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, listings]);

  const handleNewMessage = useCallback((msg: ChatMessage) => {
    setMessagesMap((prev) => {
      const lid = msg.listing_id;
      const existing = prev[lid] || [];
      if (existing.some((m) => m.id === msg.id)) return prev;
      return { ...prev, [lid]: [...existing, msg] };
    });
  }, []);

  const fetchHotSheetAndListings = async () => {
    let workspaceIsShared = false;
    try {
      setLoading(true);
      setReviewRecipients([]);
      setBuyerHotSheetFavoriteIds(new Set());

      // Resolve current agent identity
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAgentUserId(user.id);
        const { data: ap } = await supabase
          .from("agent_profiles")
          .select("first_name, last_name")
          .eq("id", user.id)
          .maybeSingle();
        if (ap) setAgentDisplayName(`${ap.first_name} ${ap.last_name}`.trim());
      }

      // Fetch hot sheet + client count in parallel
      const [{ data: hotSheetData, error: hotSheetError }, { count: hscCount, error: hscErr }] =
        await Promise.all([
          supabase
            .from("hot_sheets")
            .select("id, name, criteria, last_sent_at, client_id")
            .eq("id", id)
            .maybeSingle(),
          supabase
            .from("hot_sheet_clients")
            .select("client_id", { count: "exact", head: true })
            .eq("hot_sheet_id", id!),
        ]);

      if (hotSheetError) throw hotSheetError;
      setHotSheet(hotSheetData);
      if (!hscErr) setClientCount(hscCount ?? 0);

      let buyerAuthForConversationSync: string | null = null;
      if (hotSheetData && user) {
        const { data: hscRelRows } = await supabase
          .from("hot_sheet_clients")
          .select("client_id")
          .eq("hot_sheet_id", hotSheetData.id);
        const fallbackCrmClientId =
          (typeof hotSheetData.client_id === "string" && hotSheetData.client_id) ||
          ((hscRelRows?.[0] as any)?.client_id ?? null);
        const crmIds = new Set<string>();
        for (const row of hscRelRows ?? []) {
          if (row.client_id) crmIds.add(row.client_id);
        }
        if (hotSheetData.client_id) crmIds.add(hotSheetData.client_id);
        if (crmIds.size > 0) {
          const { data: relRows } = await supabase
            .from("client_agent_relationships")
            .select("client_id, crm_client_id")
            .eq("agent_id", user.id)
            .eq("status", "active")
            .in("crm_client_id", [...crmIds]);
          const relList = relRows ?? [];
          const primaryCrm = hotSheetData.client_id;
          const chosen =
            primaryCrm && relList.some((r) => r.crm_client_id === primaryCrm)
              ? relList.find((r) => r.crm_client_id === primaryCrm)
              : relList[0];
          buyerAuthForConversationSync = chosen?.client_id ?? null;
          setBuyerContextClientId((chosen?.crm_client_id as string | null) ?? fallbackCrmClientId);
        } else {
          setBuyerContextClientId(fallbackCrmClientId);
        }
      } else {
        setBuyerContextClientId(null);
      }
      setConversationRecipientBuyerId(buyerAuthForConversationSync);

      // Check if invites already sent: ALL eligible clients have an email_enqueued/invite_resent event
      if (hotSheetData && user) {
        const { data: hscRows, error: hscErr2 } = await supabase
          .from("hot_sheet_clients")
          .select("client_id")
          .eq("hot_sheet_id", hotSheetData.id);

        if (!hscErr2 && hscRows && hscRows.length > 0) {
          const clientIds = hscRows.map((r: any) => r.client_id);

          const { data: clientsRows } = await supabase
            .from("clients")
            .select("id, email, first_name, last_name, phone")
            .in("id", clientIds);

          const eligibleClientIds = (clientsRows ?? [])
            .filter((c: any) => !!c.email)
            .map((c: any) => c.id);

          if (eligibleClientIds.length === 0) {
            setInvitesSent(false);
          } else {
            const { data: eventRows, error: eventErr } = await supabase
              .from("invite_events")
              .select("client_id")
              .eq("hot_sheet_id", hotSheetData.id)
              .in("event_type", ["email_enqueued", "invite_resent"])
              .in("client_id", eligibleClientIds);

            if (!eventErr) {
              const sentSet = new Set((eventRows ?? []).map((e: any) => e.client_id));
              setInvitesSent(sentSet.size === eligibleClientIds.length);
            }
          }

          // --- Token-based accepted/unaccepted counts (canonical payload keys) ---
          try {
            const emailByClientId = new Map<string, string>();
            for (const c of clientsRows ?? []) {
              if (c?.id && c?.email) emailByClientId.set(String(c.id), String(c.email).toLowerCase());
            }

            const { data: stRows, error: stErr } = await supabase
              .from("share_tokens")
              .select("id, token, payload, accepted_at, created_at")
              .eq("agent_id", user.id);

            if (stErr) throw stErr;

            const tokensForThisHotSheet = (stRows ?? []).filter((t: any) => {
              return (
                t?.payload?.type === "client_hotsheet_invite" &&
                String(t?.payload?.hot_sheet_id ?? "") === String(hotSheetData.id)
              );
            });

            /** Any hot-sheet invite tokens for this agent (all sheets / buyers) — one-time dashboard invite eligibility. */
            const allInviteForAgent = (stRows ?? []).filter(
              (t: any) => t?.payload?.type === "client_hotsheet_invite",
            );
            const globalInviteByClientId = new Map<string, any[]>();
            const globalInviteByEmail = new Map<string, any[]>();
            for (const t of allInviteForAgent) {
              const cid = (t as any)?.payload?.client_id ?? null;
              const em = (t as any)?.payload?.client_email ?? null;
              if (cid) {
                const k = String(cid);
                const arr = globalInviteByClientId.get(k) ?? [];
                arr.push(t);
                globalInviteByClientId.set(k, arr);
              }
              if (em) {
                const k = String(em).toLowerCase();
                const arr = globalInviteByEmail.get(k) ?? [];
                arr.push(t);
                globalInviteByEmail.set(k, arr);
              }
            }

            const mergeGlobalInviteTokens = (cid: string, emailKey: string | null) => {
              const uniq = new Map<string, any>();
              for (const t of globalInviteByClientId.get(cid) ?? []) uniq.set(String((t as any).id), t);
              if (emailKey) {
                for (const t of globalInviteByEmail.get(emailKey) ?? []) uniq.set(String((t as any).id), t);
              }
              return [...uniq.values()];
            };

            const { data: relationshipRows } = await supabase
              .from("client_agent_relationships")
              .select("crm_client_id, client_id, status")
              .eq("agent_id", user.id)
              .in("crm_client_id", clientIds);

            const buyerLinkedCrmIds = new Set(
              (relationshipRows ?? [])
                .filter((r: any) => String(r.status) === "active" && r.client_id != null)
                .map((r: any) => String(r.crm_client_id)),
            );

            const authUserIdByCrmId = new Map<string, string>();
            for (const r of (relationshipRows ?? []) as any[]) {
              if (String(r.status) === "active" && r.client_id != null && r.crm_client_id != null) {
                authUserIdByCrmId.set(String(r.crm_client_id), String(r.client_id));
              }
            }

            const tokensByClientId = new Map<string, any[]>();
            const tokensByEmail = new Map<string, any[]>();

            for (const t of tokensForThisHotSheet) {
              const cid = (t as any)?.payload?.client_id ?? null;
              const email = (t as any)?.payload?.client_email ?? null;
              if (cid) {
                const key = String(cid);
                const arr = tokensByClientId.get(key) ?? [];
                arr.push(t);
                tokensByClientId.set(key, arr);
              }
              if (email) {
                const key = String(email).toLowerCase();
                const arr = tokensByEmail.get(key) ?? [];
                arr.push(t);
                tokensByEmail.set(key, arr);
              }
            }

            let accepted = 0;
            let unaccepted = 0;

            for (const hscRow of hscRows) {
              const clientId = (hscRow as any)?.client_id ?? null;
              const clientEmail =
                (clientId && emailByClientId.get(String(clientId))) ||
                ((hscRow as any)?.client_email ? String((hscRow as any).client_email).toLowerCase() : null);

              const byId = clientId ? (tokensByClientId.get(String(clientId)) ?? []) : [];
              const byEmail = clientEmail ? (tokensByEmail.get(clientEmail) ?? []) : [];
              const tokens = [...byId, ...byEmail];
              const hasAccepted = tokens.some((t) => Boolean(t?.accepted_at));

              if (hasAccepted) accepted += 1;
              else unaccepted += 1;
            }

            setAcceptedCount(accepted);
            setUnacceptedCount(unaccepted);

            const clientById = new Map((clientsRows ?? []).map((c: any) => [String(c.id), c]));

            const mergeTokensForClient = (cid: string, emailKey: string | null) => {
              const byId = tokensByClientId.get(cid) ?? [];
              const byEm = emailKey ? (tokensByEmail.get(emailKey) ?? []) : [];
              const uniq = new Map<string, any>();
              for (const t of [...byId, ...byEm]) uniq.set(String((t as any).id), t);
              return [...uniq.values()];
            };

            const pickPendingTokenRow = (rows: any[]): { id: string; token: string } | null => {
              if (!rows?.length) return null;
              const pend = rows.find((t: any) => !t.accepted_at);
              const t = pend ?? rows[0];
              if (!t?.id || !t?.token) return null;
              return { id: String(t.id), token: String(t.token) };
            };

            const built: ReviewRecipient[] = [];
            for (const hscRow of hscRows as any[]) {
              const cid = hscRow?.client_id != null ? String(hscRow.client_id) : "";
              if (!cid) continue;
              const cRow = clientById.get(cid);
              if (!cRow) continue;
              const email = cRow.email ? String(cRow.email) : "";
              const displayName =
                `${cRow.first_name ?? ""} ${cRow.last_name ?? ""}`.trim() || email || "Contact";
              const phone = cRow.phone != null && String(cRow.phone).trim() ? String(cRow.phone) : null;
              const emailKey = email ? email.toLowerCase() : null;
              const merged = mergeTokensForClient(cid, emailKey);
              const hasAccepted = merged.some((t: any) => Boolean(t?.accepted_at));
              const pick = pickPendingTokenRow(merged);
              const globalMerged = mergeGlobalInviteTokens(cid, emailKey);
              const sendDashboardInvite =
                !buyerLinkedCrmIds.has(cid) && globalMerged.length === 0;

              built.push({
                clientId: cid,
                displayName,
                email,
                phone,
                inviteAccepted: hasAccepted,
                resendTokenId: !hasAccepted && pick ? pick.id : undefined,
                resendToken: !hasAccepted && pick ? pick.token : undefined,
                sendDashboardInvite,
                buyerLinked: buyerLinkedCrmIds.has(cid),
                authUserId: authUserIdByCrmId.get(cid),
              });
            }
            workspaceIsShared =
              built.length > 0 && built.every((r) => r.inviteAccepted || r.buyerLinked);
            setReviewRecipients(built);
          } catch (e) {
            console.warn("Token count computation failed:", e);
            setAcceptedCount(0);
            setUnacceptedCount(hscRows?.length ?? 0);
            setReviewRecipients([]);
          }
        } else {
          setInvitesSent(false);
          setAcceptedCount(0);
          setUnacceptedCount(0);
          setReviewRecipients([]);
        }
      } else {
        setReviewRecipients([]);
      }

      // Build query using unified search utility
      const criteria = hotSheetData.criteria as any;
      const query = buildListingsQuery(supabase, criteria).limit(200);

      const { data: listingsData, error: listingsError } = await query;

      if (listingsError) throw listingsError;

      let nextListings: Listing[] = (listingsData || []) as Listing[];
      const agentIds = Array.from(new Set(nextListings.map((l) => l.agent_id).filter(Boolean)));
      if (agentIds.length > 0) {
        const { data: agents } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, company, office_name")
          .in("id", agentIds as string[]);

        const byId = new Map((agents ?? []).map((a) => [a.id, a]));
        nextListings = nextListings.map((l) => ({
          ...l,
                  agent_profile:
            typeof l.agent_id === "string" && byId.has(l.agent_id)
              ? {
                  company: byId.get(l.agent_id)?.company ?? null,
                  office_name: byId.get(l.agent_id)?.office_name ?? null,
                  first_name: byId.get(l.agent_id)?.first_name ?? null,
                  last_name: byId.get(l.agent_id)?.last_name ?? null,
                }
              : undefined,
        }));
      }

      let visibleListings = nextListings;
      if (workspaceIsShared && hotSheetData?.id) {
        const { data: deletedRows } = await supabase
          .from("hot_sheet_listing_status")
          .select("listing_id")
          .eq("hot_sheet_id", hotSheetData.id)
          .eq("status", "deleted");
        const deletedIds = new Set((deletedRows ?? []).map((r: any) => String(r.listing_id)));
        visibleListings = nextListings.filter((l) => !deletedIds.has(l.id));
      }

      if (workspaceIsShared && hotSheetData?.id) {
        const { data: favRows } = await supabase
          .from("hot_sheet_favorites")
          .select("listing_id")
          .eq("hot_sheet_id", hotSheetData.id);
        const favIds = new Set<string>();
        for (const row of favRows ?? []) {
          if ((row as any)?.listing_id) favIds.add(String((row as any).listing_id));
        }
        setBuyerHotSheetFavoriteIds(favIds);
      } else {
        setBuyerHotSheetFavoriteIds(new Set());
      }

      setListings(visibleListings);
      setAllListings(workspaceIsShared ? visibleListings : nextListings);
      setSelectedListings(new Set());

      const listingIdsForChat = visibleListings.map((l) => l.id);
      const grouped: Record<string, ChatMessage[]> = {};
      const { data: comments } = await supabase
        .from("hot_sheet_comments")
        .select("id, hot_sheet_id, listing_id, comment, sender_role, sender_id, created_at")
        .eq("hot_sheet_id", id as string)
        .order("created_at", { ascending: true });
      for (const c of comments ?? []) {
        const lid = (c as ChatMessage).listing_id;
        if (!lid) continue;
        if (!grouped[lid]) grouped[lid] = [];
        grouped[lid].push(c as ChatMessage);
      }

      let merged = grouped;
      if (user?.id && buyerAuthForConversationSync && listingIdsForChat.length > 0) {
        const convoMap = await fetchListingConversationMessagesMap(
          listingIdsForChat,
          user.id,
          buyerAuthForConversationSync,
          user.id,
        );
        merged = mergeListingThreadMessages(convoMap, grouped);
      }
      setMessagesMap(merged);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load hot sheet data");
    } finally {
      setLoading(false);
    }
  };

  const fetchHotSheetRef = useRef(fetchHotSheetAndListings);
  fetchHotSheetRef.current = fetchHotSheetAndListings;

  useEffect(() => {
    if (!id || !isSharedWorkspace) return;
    const channel = supabase
      .channel(`hotsheet-listing-status-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hot_sheet_listing_status",
          filter: `hot_sheet_id=eq.${id}`,
        },
        () => {
          fetchHotSheetRef.current();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, isSharedWorkspace]);

  const sortedListings = [...listings].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "price-high":
        return b.price - a.price;
      case "price-low":
        return a.price - b.price;
      default:
        return 0;
    }
  });

  const toggleListing = (listingId: string) => {
    const newSelected = new Set(selectedListings);
    if (newSelected.has(listingId)) {
      newSelected.delete(listingId);
    } else {
      newSelected.add(listingId);
    }
    setSelectedListings(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedListings.size === listings.length) {
      setSelectedListings(new Set());
      setListings(allListings);
    } else {
      setSelectedListings(new Set(listings.map((l) => l.id)));
    }
  };

  const removedListings = useMemo(() => {
    const visible = new Set(listings.map((l) => l.id));
    return allListings.filter((l) => !visible.has(l.id));
  }, [allListings, listings]);

  const restoreListing = useCallback(
    (listingId: string) => {
      const item = allListings.find((l) => l.id === listingId);
      if (!item) return;
      if (listings.some((l) => l.id === listingId)) return;
      const order = new Map(allListings.map((l, i) => [l.id, i]));
      setListings((prev) =>
        [...prev, item].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)),
      );
      toast.success("Listing restored");
    },
    [allListings, listings],
  );

  const handleKeepSelected = () => {
    if (selectedListings.size === 0) {
      toast.error("No listings selected");
      return;
    }
    const filtered = listings.filter(l => selectedListings.has(l.id));
    setListings(filtered);
    setSelectedListings(new Set());
    if (filtered.length < allListings.length) setRemovedListingsOpen(true);
    toast.success(`Kept ${filtered.length} listings, removed ${listings.length - filtered.length}`);
  };


  const handleSendInvites = async () => {
    if (!hotSheet?.id) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // ── 1) Fetch all client IDs in one query ──────────────────────────────
      const { data: hscRows, error: hscErr } = await supabase
        .from("hot_sheet_clients")
        .select("client_id")
        .eq("hot_sheet_id", hotSheet.id);

      if (hscErr) throw hscErr;
      if (!hscRows?.length) {
        toast.error("No clients linked to this Hot Sheet yet.");
        return;
      }

      const recipientClientIds = hscRows.map((r: any) => r.client_id);
      const dashEligibleByClientId = new Map(
        reviewRecipients.map((r) => [r.clientId, r.sendDashboardInvite]),
      );

      // ── 2) Batch-fetch agent name, client emails, existing tokens ─────────
      const [agentProfileRes, clientsRes, existingTokensRes] = await Promise.all([
        supabase
          .from("agent_profiles")
          .select("first_name, last_name")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("clients")
          .select("id, email, first_name, last_name")
          .in("id", recipientClientIds),
        supabase
          .from("share_tokens")
          .select("id, token, payload, accepted_at")
          .eq("agent_id", user.id),
      ]);

      const agentName = agentProfileRes.data
        ? `${agentProfileRes.data.first_name} ${agentProfileRes.data.last_name}`.trim()
        : agentDisplayName;

      // Map client data by id for O(1) lookup
      const clientMap = new Map<string, { email: string; name: string }>();
      for (const c of (clientsRes.data ?? [])) {
        if (c.email) {
          clientMap.set(c.id, {
            email: c.email,
            name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email,
          });
        }
      }

      /** Pick a pending token when available; Postgres JSON containment filters are unreliable vs UUID shapes. */
      type SheetInviteToken = { id: string; token: string; accepted_at: string | null };
      const tokensByClientId = new Map<string, SheetInviteToken[]>();
      const hotSheetIdNorm = String(hotSheet.id);
      for (const t of existingTokensRes.data ?? []) {
        const payload = t.payload as Record<string, unknown> | null;
        if (payload?.type !== "client_hotsheet_invite") continue;
        if (String(payload.hot_sheet_id ?? "") !== hotSheetIdNorm) continue;
        const cid = typeof payload.client_id === "string" ? payload.client_id : null;
        if (!cid) continue;
        const row: SheetInviteToken = {
          id: String(t.id),
          token: String(t.token ?? ""),
          accepted_at: t.accepted_at != null ? String(t.accepted_at) : null,
        };
        const arr = tokensByClientId.get(cid) ?? [];
        arr.push(row);
        tokensByClientId.set(cid, arr);
      }
      const pickTokenForInvite = (rows: SheetInviteToken[]): SheetInviteToken | null => {
        if (!rows?.length) return null;
        const pending = rows.find((r) => !r.accepted_at);
        return pending ?? rows[0] ?? null;
      };

      // ── 3) Build invite list (create tokens for clients that don't have one) ─
      const invitePromises: Promise<any>[] = [];
      let skippedNoEmail = 0;
      let skippedTokenInsert = 0;
      let skippedAcceptedInvite = 0;
      let skippedDashboardIneligible = 0;
      let resendCount = 0;

      for (const clientId of recipientClientIds) {
        const clientData = clientMap.get(clientId);
        if (!clientData?.email) { skippedNoEmail++; continue; }

        const dashboardInviteOk = dashEligibleByClientId.get(clientId) ?? false;

        let tokenId: string;
        let finalToken: string;
        let mode: "initial" | "resend";

        const existing = pickTokenForInvite(tokensByClientId.get(clientId) ?? []);
        if (existing?.accepted_at) {
          skippedAcceptedInvite++;
          console.log(`[handleSendInvites] Skipping invite enqueue — token already accepted for client ${clientId}`);
          continue;
        }
        if (!dashboardInviteOk) {
          skippedDashboardIneligible++;
          console.log(
            `[handleSendInvites] Skipping dashboard invite — buyer already invited or in search (client ${clientId})`,
          );
          continue;
        }
        if (existing && !existing.accepted_at) {
          // Token already exists → send as resend so the email actually goes out.
          tokenId = existing.id;
          finalToken = existing.token;
          mode = "resend";
          resendCount++;
          console.log(`[handleSendInvites] Reusing existing token for client ${clientId} (resend)`);
        } else {
          // Generate token (UUID is the established format in this app)
          const token = crypto.randomUUID();

          const { data: newTokenRow, error: tokenError } = await supabase
            .from("share_tokens")
            .insert({
              token,
              agent_id: user.id,
              payload: {
                type: "client_hotsheet_invite",
                client_id: clientId,
                client_email: clientData.email,
                hot_sheet_id: hotSheet.id,
                suppress_initial_matches: true,
              },
            })
            .select("id, token")
            .single();

          if (tokenError) {
            console.error(`[handleSendInvites] Token insert error for ${clientId}:`, tokenError);
            skippedTokenInsert++;
            continue;
          }

          tokenId = newTokenRow.id;
          finalToken = newTokenRow.token ?? token;
          mode = "initial";

          // Audit log (fire-and-forget — non-critical)
          supabase.from("invite_events").insert({
            token_id: tokenId,
            hot_sheet_id: hotSheet.id,
            client_id: clientId,
            client_email: clientData.email,
            event_type: "token_created",
            actor_user_id: user.id,
          }).then(() => {});
        }

        const hotSheetLink =
          `${window.location.origin}/client-invite` +
          `?invitation_token=${encodeURIComponent(finalToken)}` +
          `&email=${encodeURIComponent(clientData.email)}` +
          `&agent_id=${encodeURIComponent(user.id)}` +
          `&client_id=${encodeURIComponent(clientId)}`;

        console.log(
          `[handleSendInvites] enqueue attempt → ${clientData.email} (mode=${mode}, tokenId=${tokenId})`,
        );

        invitePromises.push(
          supabase.functions.invoke("send-hot-sheet-invite", {
            body: {
              invitedEmail: clientData.email,
              inviterName: agentName,
              hotSheetName: hotSheet.name,
              hotSheetLink,
              hotSheetId: hotSheet.id,
              tokenId,
              clientId,
              mode,
            },
          }).then((res) => {
            if (res.error) {
              console.error(
                `[handleSendInvites] enqueue FAILED for ${clientData.email}:`,
                res.error,
              );
            } else {
              console.log(
                `[handleSendInvites] enqueue OK for ${clientData.email} → jobId=${(res.data as any)?.jobId} skipped=${(res.data as any)?.skipped ?? false}`,
              );
            }
            return res;
          }),
        );
      }

      const recipientsWithEmail = recipientClientIds.filter((cid) => clientMap.has(cid)).length;

      if (invitePromises.length === 0) {
        if (recipientsWithEmail === 0) {
          toast.error("No clients with valid emails found.");
          return;
        }
        if (skippedAcceptedInvite > 0 && skippedAcceptedInvite >= recipientsWithEmail) {
          toast.info(
            "Everyone on this hot sheet has already accepted the invitation. Use Notify to send listing updates.",
          );
          await fetchHotSheetAndListings();
          return;
        }
        if (
          recipientsWithEmail > 0 &&
          skippedAcceptedInvite + skippedDashboardIneligible >= recipientsWithEmail
        ) {
          toast.info(
            "No new search invitations needed — buyers were already invited or are in your search. Use Notify to send listings.",
          );
          await fetchHotSheetAndListings();
          return;
        }
        if (skippedTokenInsert > 0) {
          toast.error(
            "Could not prepare invitations for one or more contacts. Check the console and try again.",
          );
          return;
        }
        toast.error("No clients with valid emails found.");
        return;
      }

      // ── 4) Await all sends; collect partial failures ──────────────────────
      const results = await Promise.all(invitePromises);
      const failures = results.filter((r) => r.error);
      const succeeded = results.length - failures.length;

      if (failures.length > 0) {
        console.error("[handleSendInvites] Partial failures:", failures.map((f) => f.error));
        toast.error(
          `Queued ${succeeded}, failed ${failures.length}. Check console for details.`
        );
        // Don't set invitesSent if any failed — let agent retry
        return;
      }

      setInvitesSent(true);
      toast.success(
        `Invites queued (${succeeded} client${succeeded !== 1 ? "s" : ""}` +
          (resendCount > 0 ? ` — ${resendCount} resend${resendCount !== 1 ? "s" : ""}` : "") +
          ")",
      );
      void supabase.functions.invoke("kick-email-queue").catch((e) => {
        console.warn(
          "[HotSheetReview] kick-email-queue failed — emails stay in queue until worker runs",
          e,
        );
      });
      await fetchHotSheetAndListings();
    } catch (e: any) {
      console.error("[HotSheetReview] handleSendInvites error", e);
      toast.error(e?.message ?? "Failed to send invites");
    } finally {
      setSending(false);
    }
  };

  const handleSendFirstBatch = async () => {
    if (selectedListings.size === 0) return;
    try {
      setSending(true);

      const { error } = await supabase.functions.invoke("process-hot-sheet", {
        body: {
          hotSheetId: id,
          sendInitialBatch: true,
          selectedListingIds: Array.from(selectedListings),
        },
      });
      if (error) throw error;
      toast.success(`Sent ${selectedListings.size} listing${selectedListings.size !== 1 ? "s" : ""} to client`);
    } catch (error: any) {
      console.error("Error sending listings:", error);
      toast.error("Failed to send listings");
    } finally {
      setSending(false);
    }
  };

  const handleNotifyWithMatches = async () => {
    try {
      setSending(true);
      const { error } = await supabase.functions.invoke("process-hot-sheet", {
        body: { hotSheetId: id, sendInitialBatch: true },
      });
      if (error) throw error;
      toast.success("Current matches sent to accepted clients.");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to notify clients.");
    } finally {
      setSending(false);
    }
  };

  const handleNotifyUpdate = async () => {
    try {
      setSending(true);
      toast.info("Message-only updates are coming soon. Use 'Send current matches' for now.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[55vh] bg-white px-4 pb-16 pt-8 sm:px-6">
        <AacMonogramLoader variant="section" className="min-h-[48vh]" message="Loading hot sheet..." />
      </div>
    );
  }

  if (!hotSheet) {
    return (
      <div className="min-h-[40vh] bg-white px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-lg flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white px-6 py-10 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <p className="text-sm font-semibold text-neutral-900">Hot sheet not found</p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            It may have been removed or this link may be outdated.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-6 h-9 rounded-md border-neutral-200 px-4 text-xs font-medium shadow-sm transition-colors duration-200 hover:border-neutral-300 hover:bg-neutral-50/90"
            onClick={() => navigate("/hot-sheets")}
          >
            Back to Hot Sheets
          </Button>
        </div>
      </div>
    );
  }

  const criteriaSummary = getCriteriaSummaryLine(hotSheet.criteria);
  const maySendDashboardInviteToSomeRecipients =
    !isSharedWorkspace && reviewRecipients.some((r) => r.sendDashboardInvite);
  const backLinkLabel =
    (typeof originFrom === "string" && originFrom.includes("/hot-sheets/buyer/")) || buyerContextClientId
      ? "Back to buyer's hot sheets"
      : "Back to hot sheets";

  return (
      <div className="min-h-[50vh] bg-white pt-4 px-4 pb-10 sm:px-6">
        <div className="mx-auto w-full max-w-[88rem] min-w-0">
          {/* Back link + page title */}
          <header className="mb-4">
            <button
              type="button"
              onClick={() => {
                const preferBuyerFrom =
                  typeof originFrom === "string" && originFrom.includes("/hot-sheets/buyer/")
                    ? originFrom
                    : null;
                const buyerBack =
                  !originFrom && buyerContextClientId ? `/hot-sheets/buyer/${buyerContextClientId}` : null;
                navigate(preferBuyerFrom || buyerBack || originFrom || "/hot-sheets");
              }}
              className="group -ml-1 mb-3 inline-flex max-w-full items-center gap-1.5 py-0.5 text-left text-[13px] font-medium text-neutral-600 transition-colors duration-200 hover:text-neutral-900"
            >
              <ArrowLeft className="h-4 w-4 shrink-0 transition-colors group-hover:text-neutral-900" aria-hidden />
              <span className="min-w-0 truncate">{backLinkLabel}</span>
            </button>
            <div className="flex flex-col gap-1 border-b border-neutral-200 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl">
                  {isSharedWorkspace ? "Buyer activity" : "Review matches"}
                </h1>
                <p className="mt-1.5 text-[13px] leading-snug sm:text-[14px]" title={hotSheet.name}>
                  <span className="text-neutral-500">Hot Sheet Name: </span>
                  <span className="font-semibold text-neutral-900">{hotSheet.name}</span>
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-medium tabular-nums text-neutral-400 sm:mb-0.5">
                {id ? formatHotSheetRef(id) : ""}
              </span>
            </div>
          </header>

          {/* Buyer recipients strip */}
          {!isSharedWorkspace && reviewRecipients.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {reviewRecipients.map((r) => {
                const pending = !r.inviteAccepted && !r.buyerLinked;
                return (
                  <span
                    key={r.clientId}
                    className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white py-1 pl-1 pr-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  >
                    <BuyerInitialsAvatar displayName={r.displayName} userId={r.authUserId} />
                    <span className="text-[12px] font-medium text-neutral-800">{r.displayName}</span>
                    <BuyerRowStatusPill
                      buyer={{
                        status: pending ? "pending" : "active",
                        buyerWorkspaceLinked: r.buyerLinked,
                      }}
                    />
                  </span>
                );
              })}
            </div>
          )}

          {/* Search criteria */}
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditCriteriaOpen(true)}
                className="h-8 shrink-0 self-start rounded-md border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:border-neutral-300 hover:bg-neutral-50/80 sm:self-center"
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Edit criteria
              </Button>
            </div>
          </div>

          {/* Results + controls */}
          <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 sm:px-0.5">
                <span className="text-[13px] font-semibold tracking-tight text-neutral-900">
                  Matches <span className="font-normal tabular-nums text-neutral-500">{listings.length}</span>
                </span>
                {!isSharedWorkspace && (
                  <>
                    <div className="hidden h-4 w-px bg-neutral-200 sm:block" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={selectedListings.size === listings.length && listings.length > 0}
                        onCheckedChange={toggleSelectAll}
                        className="border-zinc-300 data-[state=checked]:border-[#16A34A] data-[state=checked]:bg-[#16A34A] data-[state=checked]:text-white data-[state=indeterminate]:border-[#16A34A] data-[state=indeterminate]:bg-[#16A34A] data-[state=indeterminate]:text-white"
                      />
                      <label htmlFor="select-all" className="cursor-pointer text-[13px] font-medium text-neutral-800">
                        {selectedListings.size === listings.length && listings.length > 0
                          ? `Unselect All (${listings.length} listings)`
                          : `Select All (${listings.length} listings)`}
                      </label>
                    </div>
                    {selectedListings.size > 0 && (
                      <>
                        <div className="h-4 w-px bg-neutral-200" />
                        <span className="tabular-nums text-[13px] font-medium text-neutral-700">{selectedListings.size} selected</span>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-md border-neutral-200 bg-white px-3 text-[12px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:border-neutral-300 hover:bg-neutral-50/90"
                          onClick={handleKeepSelected}
                        >
                          Keep Selected
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 px-1 sm:justify-end sm:px-0.5">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-8 w-full rounded-md border-neutral-200 bg-white text-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-neutral-300 focus-visible:ring-neutral-300/40 focus-visible:ring-offset-2 sm:w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest to Oldest</SelectItem>
                    <SelectItem value="oldest">Oldest to Newest</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                  </SelectContent>
                </Select>
                {buyerContextClientId ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 gap-1.5 rounded-md border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:border-neutral-300 hover:bg-neutral-50/80"
                    onClick={() => navigate(`/agent/buyers/${buyerContextClientId}/favorites`)}
                  >
                    <Heart
                      className="h-3.5 w-3.5 shrink-0 fill-[#FF2D55] text-[#FF2D55] stroke-[#FF2D55]"
                      strokeWidth={2}
                      aria-hidden
                    />
                    Favorites
                  </Button>
                ) : null}
                {!isSharedWorkspace && !invitesSent && (unacceptedCount > 0 || acceptedCount > 0) ? (
                  <Button
                    type="button"
                    className="h-8 gap-1.5 rounded-md border border-[#0B46CC]/20 bg-[#0E56F5] px-3 text-[12px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors duration-200 hover:bg-[#0B46CC] focus-visible:ring-2 focus-visible:ring-neutral-400/60 focus-visible:ring-offset-2"
                    onClick={() => {
                      if (
                        listings.length > 0 &&
                        selectedListings.size === 0 &&
                        (unacceptedCount > 0 || clientCount > 0)
                      ) {
                        setConfirmInviteOpen(true);
                      } else {
                        handleSendInvites();
                      }
                    }}
                    disabled={sending || clientCount === 0}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {sending
                      ? "Sending…"
                      : (() => {
                          const pendingRecipients = reviewRecipients.filter(
                            (r) => !r.inviteAccepted && !r.buyerLinked,
                          );
                          if (pendingRecipients.length === 0) return "Send Listings";
                          const allAlreadyInvited =
                            pendingRecipients.every((r) => !!r.resendTokenId);
                          return allAlreadyInvited ? "Resend Invite" : "Send Listings with Invite";
                        })()}
                  </Button>
                ) : !isSharedWorkspace && !invitesSent && acceptedCount > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={sending}
                        className="h-8 gap-1.5 rounded-md border-neutral-200 bg-white px-3 text-[12px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/80"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Notify Clients ({acceptedCount})
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleNotifyUpdate}>
                        Send update (message only)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleNotifyWithMatches}>
                        Send current matches
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </div>
          </div>

          {listings.length === 0 ? (
            <Card className="rounded-xl border border-neutral-200 bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-10">
              <div className="mx-auto max-w-md space-y-4 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <MapPin className="h-4 w-4 text-neutral-400" aria-hidden />
                </div>
                <p className="text-sm font-semibold text-neutral-900">No listings match yet</p>
                <p className="text-[13px] leading-relaxed text-neutral-500">
                  Broaden location, status, price, or property type in Search criteria—or open your Hot Sheets list.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-md border-neutral-200 bg-white px-3 text-[12px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/90"
                    onClick={() => setEditCriteriaOpen(true)}
                  >
                    Adjust criteria
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-md border-neutral-200 bg-white px-3 text-[12px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/90"
                    onClick={() => navigate("/hot-sheets")}
                  >
                    All hot sheets
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <>
              {!isSharedWorkspace && removedListings.length > 0 && (
                <Collapsible
                  open={removedListingsOpen}
                  onOpenChange={setRemovedListingsOpen}
                  className="mb-4 rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[12px] font-medium text-neutral-800 transition-colors duration-200 hover:bg-neutral-50/80">
                    <ChevronDown
                      className={cn("h-4 w-4 shrink-0 text-neutral-500 transition-transform", removedListingsOpen && "rotate-180")}
                    />
                    Removed listings ({removedListings.length})
                    <span className="truncate font-normal text-neutral-500">— restore if removed by mistake</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t border-neutral-200 px-3 py-2">
                    <ul className="max-h-48 space-y-2 overflow-y-auto">
                      {removedListings.map((l) => (
                        <li
                          key={l.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200/90 bg-white px-2 py-2 text-[11px] transition-all duration-200 ease-out hover:border-neutral-300 hover:shadow-sm"
                        >
                          <span className="min-w-0 truncate text-neutral-700">
                            {l.address}, {l.city}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-7 shrink-0 rounded-md border-neutral-200 bg-white px-2 text-[11px] font-medium transition-colors duration-200 hover:border-neutral-300 hover:bg-neutral-50/90"
                            onClick={() => restoreListing(l.id)}
                          >
                            Restore
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 lg:gap-5">
                {sortedListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    viewMode="compact"
                    showActions={false}
                    showCompactComments
                    onSelect={isSharedWorkspace ? undefined : toggleListing}
                    isSelected={isSharedWorkspace ? false : selectedListings.has(listing.id)}
                    chatMessages={messagesMap[listing.id] || []}
                    onNewMessage={handleNewMessage}
                    onOpenChat={() => {
                      setChatListingId(listing.id);
                      setChatDrawerOpen(true);
                    }}
                    hotSheetId={id ?? undefined}
                    hideCompactFavorite={isSharedWorkspace}
                    isHotSheetFavorite={
                      isSharedWorkspace ? buyerHotSheetFavoriteIds.has(listing.id) : undefined
                    }
                    compactSelectionAccent="aacGreen"
                  />
                ))}
              </div>
            </>
          )}
        </div>

      {chatListingId && conversationRecipientBuyerId ? (
        <ListingConversationSheet
          open={chatDrawerOpen}
          onOpenChange={(open) => {
            setChatDrawerOpen(open);
            if (!open) setChatListingId(null);
          }}
          listingId={chatListingId}
          otherUserId={conversationRecipientBuyerId}
          threadTitle={
            listings.find((l) => l.id === chatListingId)
              ? `${listings.find((l) => l.id === chatListingId)!.address}, ${listings.find((l) => l.id === chatListingId)!.city}`
              : "Listing discussion"
          }
          onInboxInvalidate={() => {
            if (!agentUserId || !conversationRecipientBuyerId || !chatListingId) return;
            void fetchListingConversationMessagesMap(
              [chatListingId],
              agentUserId,
              conversationRecipientBuyerId,
              agentUserId,
            ).then((convoMap) => {
              setMessagesMap((prev) => mergeListingThreadMessages(convoMap, { [chatListingId]: prev[chatListingId] ?? [] }));
            });
          }}
        />
      ) : null}

      {/* Confirm send (invite flow only — not shared workspace) */}
      {!isSharedWorkspace && (
        <AlertDialog open={confirmInviteOpen} onOpenChange={setConfirmInviteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send without selected listings?</AlertDialogTitle>
              <AlertDialogDescription>
                {maySendDashboardInviteToSomeRecipients ? (
                  <>
                    You haven&apos;t selected listings yet. Contacts marked{" "}
                    <span className="font-medium text-foreground">&quot;Needs Invite&quot;</span> may receive a one-time invitation to
                    join your search when you continue. Invite status for each person is shown on their row above.
                  </>
                ) : (
                  <>
                    There are matches, but no listings selected. Pick matches first so they&apos;re included in what goes out—or
                    continue only if that&apos;s intentional.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:justify-end">
              <AlertDialogCancel className="h-8 rounded-md px-3 text-xs font-medium mt-0">
                Go Back and Select Listings
              </AlertDialogCancel>
              <AlertDialogAction
                className="h-8 rounded-md border border-[#0B46CC]/20 bg-[#0E56F5] px-3 text-xs font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors hover:bg-[#0B46CC]"
                onClick={() => {
                  setConfirmInviteOpen(false);
                  handleSendInvites();
                }}
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {hotSheet && (
        <EditHotsheetCriteriaDialog
          open={editCriteriaOpen}
          onOpenChange={setEditCriteriaOpen}
          hotSheetId={hotSheet.id}
          initialCriteria={hotSheet.criteria}
          onUpdate={fetchHotSheetAndListings}
        />
      )}

    </div>
  );
};

export default HotSheetReview;

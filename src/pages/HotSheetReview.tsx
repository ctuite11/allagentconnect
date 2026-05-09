import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, MapPin, RefreshCw, CheckCircle2, Clock, ChevronDown, ArrowLeft, Pencil } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
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
import ListingChatDrawer, { type ChatMessage } from "@/components/ListingChatDrawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { buildListingsQuery } from "@/lib/buildListingsQuery";
import type { ListedByAgentProfile } from "@/lib/listingListedBy";
import { fetchBuyerActivityMetrics, type BuyerActivityMetrics } from "@/lib/fetchBuyerActivityMetrics";
import { AgentBuyerActivityHeaderCard } from "@/components/agent/AgentBuyerActivityHeaderCard";

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
}

/** Per-contact dashboard invite UX: accepted, pending invite elsewhere, or still needs first invite. */
function recipientInviteStatus(r: ReviewRecipient): "accepted" | "sent" | "needs" {
  if (r.inviteAccepted || r.buyerLinked) return "accepted";
  if (!r.sendDashboardInvite) return "sent";
  return "needs";
}

function CompactClientRecipientsStrip({
  recipients,
  hotSheetId,
  hotSheetName,
  agentName,
  agentUserId,
  onRefresh,
  collaborativeMode,
  recipientActivity,
  recipientActivityLoading,
}: {
  recipients: ReviewRecipient[];
  hotSheetId: string;
  hotSheetName: string;
  agentName: string;
  agentUserId: string;
  onRefresh: () => void;
  /** Shared workspace — hide invite/resend affordances; neutral collaboration labels */
  collaborativeMode?: boolean;
  recipientActivity: Record<string, BuyerActivityMetrics>;
  recipientActivityLoading: boolean;
}) {
  const [cooldownUntil, setCooldownUntil] = useState<Record<string, number>>({});
  const [resendingId, setResendingId] = useState<string | null>(null);

  if (!recipients.length) return null;

  const handleResend = async (r: ReviewRecipient) => {
    if (!r.resendTokenId || !r.resendToken) return;
    setResendingId(r.clientId);

    const hotSheetLink =
      `${window.location.origin}/client-invite` +
      `?invitation_token=${encodeURIComponent(r.resendToken)}` +
      `&email=${encodeURIComponent(r.email)}` +
      `&agent_id=${encodeURIComponent(agentUserId)}` +
      `&client_id=${encodeURIComponent(r.clientId)}`;

    const { error } = await supabase.functions.invoke("send-hot-sheet-invite", {
      body: {
        invitedEmail: r.email,
        inviterName: agentName,
        hotSheetName,
        hotSheetLink,
        hotSheetId,
        tokenId: r.resendTokenId,
        actorUserId: agentUserId,
        mode: "resend",
      },
    });

    if (error) {
      toast.error("Failed to resend invite");
    } else {
      toast.success(`Invite resent to ${r.email}`);
    }

    setCooldownUntil((prev) => ({ ...prev, [r.clientId]: Date.now() + 2 * 60 * 1000 }));
    setResendingId(null);
    await onRefresh();
  };

  return (
    <div className="mb-2 space-y-2">
      {recipients.map((r) => {
        const inCooldown = cooldownUntil[r.clientId] != null && Date.now() < cooldownUntil[r.clientId]!;
        const trailing = (() => {
          const st = recipientInviteStatus(r);
          if (collaborativeMode || st === "accepted") {
            return (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
                <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                {collaborativeMode ? "In search" : "Invite Accepted"}
              </span>
            );
          }
          if (st === "sent") {
            return (
              <>
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-200/90 bg-sky-50 px-2.5 py-0.5 text-[11px] font-medium text-sky-900">
                  <Clock className="h-3 w-3" />
                  Invite Sent
                </span>
                {!collaborativeMode && r.resendTokenId && r.resendToken && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-md border-zinc-200 px-3 text-xs font-medium shadow-sm"
                    disabled={resendingId === r.clientId || inCooldown}
                    onClick={() => handleResend(r)}
                  >
                    <RefreshCw
                      className={`mr-1.5 h-3.5 w-3.5 ${resendingId === r.clientId ? "animate-spin" : ""}`}
                    />
                    {resendingId === r.clientId ? "Sending…" : inCooldown ? "Wait 2 min" : "Resend"}
                  </Button>
                )}
              </>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/90 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-900">
              Needs Invite
            </span>
          );
        })();
        return (
          <AgentBuyerActivityHeaderCard
            key={r.clientId}
            displayName={r.displayName}
            email={r.email}
            phone={r.phone}
            crmClientId={r.clientId}
            metrics={recipientActivity[r.clientId] ?? null}
            metricsLoading={recipientActivityLoading}
            trailing={trailing}
          />
        );
      })}
    </div>
  );
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
    statuses: c.statuses?.length ? c.statuses.join(", ") : "—",
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
  const [recipientActivity, setRecipientActivity] = useState<Record<string, BuyerActivityMetrics>>({});
  const [recipientActivityLoading, setRecipientActivityLoading] = useState(false);
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
    setRecipientActivity({});
    setRecipientActivityLoading(false);
    setRemovedListingsOpen(false);
  }, [id]);

  useEffect(() => {
    if (!reviewRecipients.length) {
      setRecipientActivity({});
      setRecipientActivityLoading(false);
      return;
    }
    let cancelled = false;
    setRecipientActivityLoading(true);
    (async () => {
      const results = await Promise.all(
        reviewRecipients.map((r) => fetchBuyerActivityMetrics(supabase, r.clientId)),
      );
      if (cancelled) return;
      const next: Record<string, BuyerActivityMetrics> = {};
      reviewRecipients.forEach((r, i) => {
        next[r.clientId] = results[i];
      });
      setRecipientActivity(next);
      setRecipientActivityLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reviewRecipients]);

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

      // Fetch all chat messages for this hot sheet
const { data: comments } = await supabase
  .from("hot_sheet_comments")
  .select("id, hot_sheet_id, listing_id, comment, sender_role, sender_id, created_at")
  .eq("hot_sheet_id", id as string)
  .order("created_at", { ascending: true });
if (comments && comments.length > 0) {
  const grouped: Record<string, ChatMessage[]> = {};
  comments.forEach((c: any) => {
    if (!c.listing_id) return;
    if (!grouped[c.listing_id]) grouped[c.listing_id] = [];
    grouped[c.listing_id].push(c as ChatMessage);
  });
  setMessagesMap(grouped);
}
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
      <div className="pt-6 px-6 pb-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="h-10 w-64 rounded-xl bg-muted animate-pulse mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!hotSheet) {
    return (
      <div className="pt-6 px-6 pb-6">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Hot sheet not found</p>
            <Button onClick={() => navigate("/hot-sheets")} className="mt-4">
              Back to Hot Sheets
            </Button>
          </div>
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
      <div className="pt-4 px-6 pb-6">
        <div className="mx-auto w-full max-w-[88rem] min-w-0">
          {/* Back link + page title — hot sheet name stays in criteria strip below */}
          <div className="mb-3">
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
              className="group -ml-1 mb-2 inline-flex max-w-full items-center gap-1.5 py-0.5 text-left text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
            >
              <ArrowLeft className="h-4 w-4 shrink-0 transition-colors group-hover:text-zinc-900" aria-hidden />
              <span className="min-w-0 truncate">{backLinkLabel}</span>
            </button>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
              {isSharedWorkspace ? "Buyer Activity" : "Review matches"}
            </h1>
          </div>

          {agentUserId && id && (
            <CompactClientRecipientsStrip
              recipients={reviewRecipients}
              hotSheetId={id}
              hotSheetName={hotSheet.name}
              agentName={agentDisplayName}
              agentUserId={agentUserId}
              onRefresh={fetchHotSheetAndListings}
              collaborativeMode={isSharedWorkspace}
              recipientActivity={recipientActivity}
              recipientActivityLoading={recipientActivityLoading}
            />
          )}

          {/* Search criteria — single compact strip */}
          <div className="mb-2 flex flex-col gap-2 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-1.5 text-[11px] leading-snug text-zinc-600 sm:items-center">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400 sm:mt-0" />
              <p className="min-w-0">
                <span className="font-semibold text-zinc-700">Hot Sheet Name:</span>{" "}
                <span className="text-zinc-800">{hotSheet.name}</span>
                <span className="text-zinc-300"> · </span>
                <span className="font-semibold text-zinc-700">Scope:</span> {criteriaSummary.scope}
                <span className="text-zinc-300"> · </span>
                <span className="font-semibold text-zinc-700">State:</span> {criteriaSummary.state}
                <span className="text-zinc-300"> · </span>
                <span className="font-semibold text-zinc-700">Status:</span> {criteriaSummary.statuses}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditCriteriaOpen(true)}
              className="h-8 shrink-0 rounded-md border-zinc-200 px-3 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          </div>

          {/* Results + controls */}
          <div className="mb-3 flex flex-col gap-2 sm:mb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-sm font-semibold tracking-tight text-zinc-900">
                  Results ({listings.length})
                </span>
                {!isSharedWorkspace && (
                  <>
                    <div className="hidden h-4 w-px bg-zinc-200 sm:block" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={selectedListings.size === listings.length && listings.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                      <label htmlFor="select-all" className="cursor-pointer text-sm font-medium text-zinc-800">
                        {selectedListings.size === listings.length && listings.length > 0
                          ? `Unselect All (${listings.length} listings)`
                          : `Select All (${listings.length} listings)`}
                      </label>
                    </div>
                    {selectedListings.size > 0 && (
                      <>
                        <div className="h-4 w-px bg-zinc-200" />
                        <span className="text-sm font-medium text-zinc-700">{selectedListings.size} Selected</span>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-md border-zinc-200 px-3 text-xs font-medium shadow-sm"
                          onClick={handleKeepSelected}
                        >
                          Keep Selected
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-8 w-full rounded-md border-zinc-200 text-xs shadow-sm sm:w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest to Oldest</SelectItem>
                    <SelectItem value="oldest">Oldest to Newest</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                  </SelectContent>
                </Select>
                {!isSharedWorkspace && !invitesSent && (unacceptedCount > 0 || acceptedCount > 0) ? (
                  <Button
                    type="button"
                    className="h-8 gap-1.5 rounded-md bg-[#0E56F5] px-3 text-xs font-medium text-white shadow-sm hover:bg-[#0B46CC]"
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
                    {sending ? "Sending…" : "Send Listings"}
                  </Button>
                ) : !isSharedWorkspace && !invitesSent && acceptedCount > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={sending}
                        className="h-8 gap-1.5 rounded-md border-zinc-200 px-3 text-xs font-medium shadow-sm"
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

          {listings.length === 0 ? (
            <Card className="rounded-xl border-zinc-200/90 p-10 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="space-y-3 text-center">
                <p className="font-medium text-muted-foreground">No listings match this hot sheet&apos;s criteria.</p>
                <p className="text-sm text-muted-foreground">
                  Try widening the price range, location, or property type.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-md border-zinc-200 px-3 text-xs font-medium shadow-sm"
                  onClick={() => navigate("/hot-sheets")}
                >
                  Edit Hot Sheet
                </Button>
              </div>
            </Card>
          ) : (
            <>
              {!isSharedWorkspace && removedListings.length > 0 && (
                <Collapsible
                  open={removedListingsOpen}
                  onOpenChange={setRemovedListingsOpen}
                  className="mb-3 rounded-lg border border-zinc-200/90 bg-zinc-50/50"
                >
                  <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100/80 rounded-lg">
                    <ChevronDown
                      className={cn("h-4 w-4 shrink-0 text-zinc-500 transition-transform", removedListingsOpen && "rotate-180")}
                    />
                    Removed listings ({removedListings.length})
                    <span className="truncate font-normal text-zinc-500">— restore if removed by mistake</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t border-zinc-200/80 px-3 py-2">
                    <ul className="max-h-48 space-y-2 overflow-y-auto">
                      {removedListings.map((l) => (
                        <li
                          key={l.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-zinc-200/60 bg-white px-2 py-1.5 text-xs"
                        >
                          <span className="min-w-0 truncate text-zinc-700">
                            {l.address}, {l.city}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-7 shrink-0 rounded-md px-2 text-[11px] font-medium border-zinc-200"
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
                  />
                ))}
              </div>
            </>
          )}
        </div>

      {/* Chat Drawer */}
      {chatListingId && (
        <ListingChatDrawer
          open={chatDrawerOpen}
          onOpenChange={setChatDrawerOpen}
          hotSheetId={id!}
          listingId={chatListingId}
          listingAddress={
            listings.find((l) => l.id === chatListingId)
              ? `${listings.find((l) => l.id === chatListingId)!.address}, ${listings.find((l) => l.id === chatListingId)!.city}`
              : ""
          }
          messages={messagesMap[chatListingId] || []}
          onNewMessage={handleNewMessage}
          conversationRecipientUserId={loading ? undefined : conversationRecipientBuyerId}
        />
      )}

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
                className="h-8 rounded-md px-3 text-xs font-medium bg-[#0E56F5] hover:bg-[#0B46CC]"
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

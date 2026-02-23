import { useState, useEffect, useCallback } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { PageHeader } from "@/components/ui/page-header";
import { useNavigate, useParams } from "react-router-dom";
// Navigation removed - rendered globally in App.tsx
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Image as ImageIcon, Bed, Bath, Maximize, Home, MapPin, Search, RefreshCw, CheckCircle2, Clock, ChevronDown, Activity } from "lucide-react";
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
import { ShareListingDialog } from "@/components/ShareListingDialog";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { buildListingsQuery } from "@/lib/buildListingsQuery";

// ─── Pending Invites section ────────────────────────────────────────────────

interface PendingInvite {
  token: string;
  token_id: string;
  client_id: string | null;
  client_email: string;
  client_name: string;
  sent_at: string | null;
  accepted_at: string | null;
  resending: boolean;
  cooldownUntil: number | null; // epoch ms
}

function PendingInvitesSection({
  hotSheetId,
  hotSheetName,
  agentName,
  agentUserId,
}: {
  hotSheetId: string;
  hotSheetName: string;
  agentName: string;
  agentUserId: string;
}) {
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch all share tokens for this hot sheet owned by this agent
    const { data: tokens, error } = await supabase
      .from("share_tokens")
      .select("id, token, payload, accepted_at, created_at")
      .eq("agent_id", agentUserId);

    if (error || !tokens) { setLoading(false); return; }

    // Filter by hot_sheet_id in payload (JS-side per arch spec)
    const matching = tokens.filter(
      (t: any) =>
        t.payload?.type === "client_hotsheet_invite" &&
        t.payload?.hot_sheet_id === hotSheetId
    );

    // For each token, try to get the latest email_job created_at for cooldown
    const results: PendingInvite[] = await Promise.all(
      matching.map(async (t: any) => {
        const clientEmail: string = t.payload?.client_email || "";

        // Look up client name
        let clientName = clientEmail;
        if (t.payload?.client_id) {
          const { data: c } = await supabase
            .from("clients")
            .select("first_name, last_name")
            .eq("id", t.payload.client_id)
            .maybeSingle();
          if (c) clientName = `${c.first_name} ${c.last_name}`.trim() || clientEmail;
        }

        // Find most recent email job for cooldown check
        const { data: lastJob } = await supabase
          .from("email_jobs")
          .select("created_at")
          .eq("idempotency_key", `hot_sheet_invite:${t.id}:resend`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastSentMs = lastJob ? new Date(lastJob.created_at).getTime() : null;
        const cooldownUntil = lastSentMs ? lastSentMs + 2 * 60 * 1000 : null;

        return {
          token: t.token,
          token_id: t.id,
          client_id: t.payload?.client_id || null,
          client_email: clientEmail,
          client_name: clientName,
          sent_at: t.created_at,
          accepted_at: t.accepted_at,
          resending: false,
          cooldownUntil,
        };
      })
    );

    setInvites(results);
    setLoading(false);
  }, [hotSheetId, agentUserId]);

  useEffect(() => { load(); }, [load]);

  const handleResend = async (invite: PendingInvite) => {
    setInvites((prev) =>
      prev.map((i) => i.token_id === invite.token_id ? { ...i, resending: true } : i)
    );

    const hotSheetLink =
      `${window.location.origin}/client-invite` +
      `?invitation_token=${encodeURIComponent(invite.token)}` +
      `&email=${encodeURIComponent(invite.client_email)}` +
      `&agent_id=${encodeURIComponent(agentUserId)}` +
      (invite.client_id ? `&client_id=${encodeURIComponent(invite.client_id)}` : "");

    const { error } = await supabase.functions.invoke("send-hot-sheet-invite", {
      body: {
        invitedEmail: invite.client_email,
        inviterName: agentName,
        hotSheetName,
        hotSheetLink,
        hotSheetId,
        tokenId: invite.token_id,
        actorUserId: agentUserId,
        mode: "resend",
      },
    });

    if (error) {
      toast.error("Failed to resend invite");
    } else {
      toast.success(`Invite resent to ${invite.client_email}`);
    }

    // Set local cooldown regardless
    const cooldownUntil = Date.now() + 2 * 60 * 1000;
    setInvites((prev) =>
      prev.map((i) =>
        i.token_id === invite.token_id ? { ...i, resending: false, cooldownUntil } : i
      )
    );
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading invites…</p>;
  if (invites.length === 0) return null;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-base">Client Invites</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {invites.map((inv) => {
            const isAccepted = !!inv.accepted_at;
            const inCooldown = inv.cooldownUntil !== null && Date.now() < inv.cooldownUntil;
            return (
              <div key={inv.token_id} className="flex items-center justify-between py-3 gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{inv.client_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{inv.client_email}</p>
                  {inv.sent_at && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sent {format(new Date(inv.sent_at), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isAccepted ? (
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Accepted
                    </Badge>
                  ) : (
                    <>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Pending
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={inv.resending || inCooldown}
                        onClick={() => handleResend(inv)}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${inv.resending ? "animate-spin" : ""}`} />
                        {inv.resending ? "Sending…" : inCooldown ? "Wait 2 min" : "Resend"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
// ────────────────────────────────────────────────────────────────────────────

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
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hotSheet, setHotSheet] = useState<HotSheet | null>(null);
  const [agentUserId, setAgentUserId] = useState<string | null>(null);
  const [agentDisplayName, setAgentDisplayName] = useState("Your agent");
  const [listings, setListings] = useState<Listing[]>([]);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [agentMap, setAgentMap] = useState<Record<string, { fullName: string; company?: string | null }>>({});
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

  const buildSearchUrl = () => {
    if (!hotSheet) return "";
    const criteria = hotSheet.criteria as any;
    const params = new URLSearchParams();
    
    if (criteria.statuses?.length) params.set("status", criteria.statuses.join(","));
    if (criteria.propertyTypes?.length) params.set("type", criteria.propertyTypes.join(","));
    if (criteria.state) params.set("state", criteria.state);
    if (criteria.cities?.length) params.set("towns", criteria.cities.join("|"));
    if (criteria.zipCode) params.set("zip", criteria.zipCode);
    if (criteria.minPrice) params.set("minPrice", criteria.minPrice.toString());
    if (criteria.maxPrice) params.set("maxPrice", criteria.maxPrice.toString());
    if (criteria.bedrooms) params.set("bedrooms", criteria.bedrooms.toString());
    if (criteria.bathrooms) params.set("bathrooms", criteria.bathrooms.toString());
    
    return `/search?${params.toString()}`;
  };

  const fetchHotSheetAndListings = async () => {
    try {
      setLoading(true);

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
            .select("id, email")
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
              if (c?.id && c?.email) emailByClientId.set(c.id, String(c.email).toLowerCase());
            }

            const { data: stRows, error: stErr } = await supabase
              .from("share_tokens")
              .select("id, token, payload, accepted_at, created_at")
              .eq("agent_id", user.id);

            if (stErr) throw stErr;

            const tokensForThisHotSheet = (stRows ?? []).filter((t: any) => {
              return (
                t?.payload?.type === "client_hotsheet_invite" &&
                t?.payload?.hot_sheet_id === hotSheetData.id
              );
            });

            const tokensByClientId = new Map<string, any[]>();
            const tokensByEmail = new Map<string, any[]>();

            for (const t of tokensForThisHotSheet) {
              const cid = (t as any)?.payload?.client_id ?? null;
              const email = (t as any)?.payload?.client_email ?? null;
              if (cid) {
                const arr = tokensByClientId.get(cid) ?? [];
                arr.push(t);
                tokensByClientId.set(cid, arr);
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
                (clientId && emailByClientId.get(clientId)) ||
                ((hscRow as any)?.client_email ? String((hscRow as any).client_email).toLowerCase() : null);

              const byId = clientId ? (tokensByClientId.get(clientId) ?? []) : [];
              const byEmail = clientEmail ? (tokensByEmail.get(clientEmail) ?? []) : [];
              const tokens = [...byId, ...byEmail];
              const hasAccepted = tokens.some((t) => Boolean(t?.accepted_at));

              if (hasAccepted) accepted += 1;
              else unaccepted += 1;
            }

            setAcceptedCount(accepted);
            setUnacceptedCount(unaccepted);
          } catch (e) {
            console.warn("Token count computation failed:", e);
            setAcceptedCount(0);
            setUnacceptedCount(hscRows?.length ?? 0);
          }
        } else {
          setInvitesSent(false);
          setAcceptedCount(0);
          setUnacceptedCount(0);
        }
      }

      // Build query using unified search utility
      const criteria = hotSheetData.criteria as any;
      const query = buildListingsQuery(supabase, criteria).limit(200);

      const { data: listingsData, error: listingsError } = await query;

      if (listingsError) throw listingsError;
      setListings(listingsData || []);
      setAllListings(listingsData || []);

// Load listing agents for display
const agentIds = Array.from(new Set((listingsData || []).map((l: any) => l.agent_id).filter(Boolean)));
if (agentIds.length > 0) {
  const { data: agents } = await supabase
    .from("agent_profiles")
    .select("id, first_name, last_name, company")
    .in("id", agentIds as string[]);
  const map: Record<string, { fullName: string; company?: string | null }> = {};
  (agents || []).forEach((a: any) => {
    map[a.id] = { fullName: `${a.first_name} ${a.last_name}`.trim(), company: a.company };
  });
  setAgentMap(map);
}

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

  const handleKeepSelected = () => {
    if (selectedListings.size === 0) {
      toast.error("No listings selected");
      return;
    }
    const filtered = listings.filter(l => selectedListings.has(l.id));
    setListings(filtered);
    toast.success(`Showing ${filtered.length} selected listings`);
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
          .select("id, token, payload")
          .eq("agent_id", user.id)
          .contains("payload", {
            type: "client_hotsheet_invite",
            hot_sheet_id: hotSheet.id,
          }),
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

      // Map existing tokens by client_id for O(1) lookup (JS-side per arch spec)
      const existingTokenByClientId = new Map<string, { id: string; token: string }>();
      for (const t of (existingTokensRes.data ?? [])) {
        const payload = t.payload as Record<string, unknown> | null;
        const cid = typeof payload?.client_id === "string" ? payload.client_id : null;
        if (cid) existingTokenByClientId.set(cid, { id: t.id, token: t.token });
      }

      // ── 3) Build invite list (create tokens for clients that don't have one) ─
      const invitePromises: Promise<any>[] = [];
      let skippedCount = 0;

      for (const clientId of recipientClientIds) {
        const clientData = clientMap.get(clientId);
        if (!clientData?.email) { skippedCount++; continue; }

        // If token already exists for this client → skip (resend is handled separately)
        if (existingTokenByClientId.has(clientId)) {
          console.log(`[handleSendInvites] Token already exists for client ${clientId} — skipping`);
          skippedCount++;
          continue;
        }

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
          skippedCount++;
          continue;
        }

        const tokenId = newTokenRow.id;
        const finalToken = newTokenRow.token ?? token;

        // Audit log (fire-and-forget — non-critical)
        supabase.from("invite_events").insert({
          token_id: tokenId,
          hot_sheet_id: hotSheet.id,
          client_id: clientId,
          client_email: clientData.email,
          event_type: "token_created",
          actor_user_id: user.id,
        }).then(() => {});

        const hotSheetLink =
          `${window.location.origin}/client-invite` +
          `?invitation_token=${encodeURIComponent(finalToken)}` +
          `&email=${encodeURIComponent(clientData.email)}` +
          `&agent_id=${encodeURIComponent(user.id)}` +
          `&client_id=${encodeURIComponent(clientId)}`;

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
              mode: "initial",
            },
          })
        );
      }

      if (invitePromises.length === 0) {
        toast.info(
          skippedCount > 0
            ? "All clients already have invites — use Resend to re-send."
            : "No clients with valid emails found."
        );
        setInvitesSent(true);
        return;
      }

      // ── 4) Await all sends; collect partial failures ──────────────────────
      const results = await Promise.all(invitePromises);
      const failures = results.filter((r) => r.error);

      if (failures.length > 0) {
        console.error("[handleSendInvites] Partial failures:", failures.map((f) => f.error));
        toast.error(
          `Sent ${results.length - failures.length}, failed ${failures.length}. Check console for details.`
        );
        // Don't set invitesSent if any failed — let agent retry
        return;
      }

      setInvitesSent(true);
      toast.success(`Invites sent (${results.length} client${results.length !== 1 ? "s" : ""})`);
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


  const getCriteriaDisplay = () => {
    if (!hotSheet?.criteria) return [];
    
    const criteria = hotSheet.criteria as any;
    const parts = [];

    if (criteria.propertyTypes?.length > 0) {
      parts.push(`Property: ${criteria.propertyTypes.join(", ")}`);
    }
    if (criteria.minPrice || criteria.maxPrice) {
      const min = criteria.minPrice ? `$${criteria.minPrice.toLocaleString()}` : "Any";
      const max = criteria.maxPrice ? `$${criteria.maxPrice.toLocaleString()}` : "Any";
      parts.push(`Price: ${min} - ${max}`);
    }
    if (criteria.bedrooms) {
      parts.push(`${criteria.bedrooms}+ beds`);
    }
    if (criteria.bathrooms) {
      parts.push(`${criteria.bathrooms}+ baths`);
    }
    if (criteria.cities?.length > 0) {
      const cityList = criteria.cities.length > 5
        ? `${criteria.cities.slice(0, 5).join(", ")} (+${criteria.cities.length - 5} more)`
        : criteria.cities.join(", ");
      parts.push(`Cities: ${cityList}`);
    }
    if (criteria.state) {
      parts.push(`State: ${criteria.state}`);
    }
    if (criteria.zipCode) {
      parts.push(`Zip: ${criteria.zipCode}`);
    }

    return parts;
  };

  const getClientDisplay = () => {
    if (!hotSheet?.criteria) return null;
    
    const criteria = hotSheet.criteria as any;
    if (criteria.clientFirstName || criteria.clientLastName) {
      return `${criteria.clientFirstName || ""} ${criteria.clientLastName || ""}`.trim();
    }
    return criteria.clientEmail || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col pt-20">
        <main className="flex-1 bg-background">
          <div className="container mx-auto px-4 py-8 max-w-5xl">
            <div className="h-10 w-64 rounded-xl bg-muted animate-pulse mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!hotSheet) {
    return (
      <div className="min-h-screen flex flex-col pt-20">
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Hot sheet not found</p>
            <Button onClick={() => navigate("/hot-sheets")} className="mt-4">
              Back to Hot Sheets
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pt-20">
      <main className="flex-1 bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header with inline back button */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <PageHeader
                title={hotSheet.name}
                subtitle={getClientDisplay() ? `Client: ${getClientDisplay()}` : undefined}
                backTo="/hot-sheets"
                actions={
                  <Button
                    variant="outline"
                    onClick={() => toast.info("Activity log coming soon")}
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Activity Log
                  </Button>
                }
              />
            </div>
          </div>

          {/* Pending Invites */}
          {agentUserId && id && (
            <PendingInvitesSection
              hotSheetId={id}
              hotSheetName={hotSheet.name}
              agentName={agentDisplayName}
              agentUserId={agentUserId}
            />
          )}

          {/* Search Criteria */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Search Criteria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <MapPin className="h-4 w-4" />
                  <span className="font-medium">Scope:</span>
                  {hotSheet.criteria.cities?.length > 0 ? (
                    <span>{hotSheet.criteria.cities.join(", ")}</span>
                  ) : hotSheet.criteria.state ? (
                    <span>All of {hotSheet.criteria.state}</span>
                  ) : (
                    <span>No location filter</span>
                  )}
                </div>
              </div>
              {getCriteriaDisplay().length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {getCriteriaDisplay().map((criterion, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-muted border border-border text-foreground rounded-full text-sm"
                    >
                      {criterion}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">All properties</p>
              )}
            </CardContent>
          </Card>

          {/* Controls */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <Checkbox
                id="select-all"
                checked={selectedListings.size === listings.length && listings.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <label htmlFor="select-all" className="cursor-pointer font-medium">
                Select All ({listings.length} listings)
              </label>
              {selectedListings.size > 0 && (
                <span className="text-sm text-muted-foreground">
                  {selectedListings.size} selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {selectedListings.size > 0 && (
                <>
                  <Button
                    onClick={handleKeepSelected}
                    disabled={selectedListings.size === 0}
                  >
                    Keep Selected ({selectedListings.size})
                  </Button>
                </>
              )}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest to Oldest</SelectItem>
                  <SelectItem value="oldest">Oldest to Newest</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                </SelectContent>
              </Select>
              {unacceptedCount > 0 ? (
                <Button
                  onClick={() => {
                    // Gate: if matches exist but none selected, confirm first
                    if (listings.length > 0 && selectedListings.size === 0 && (unacceptedCount > 0 || clientCount > 0)) {
                      setConfirmInviteOpen(true);
                    } else {
                      handleSendInvites();
                    }
                  }}
                  disabled={sending || clientCount === 0}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? "Sending…" : `Invite Clients (${unacceptedCount})`}
                </Button>
              ) : acceptedCount > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={sending}>
                      <Send className="h-4 w-4 mr-2" />
                      Notify Clients ({acceptedCount})
                      <ChevronDown className="h-4 w-4 ml-2" />
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

          {/* Listings Grid */}
          {listings.length === 0 ? (
            <Card className="p-12">
              <div className="text-center space-y-3">
                <p className="text-muted-foreground font-medium">No listings match this hot sheet's criteria.</p>
                <p className="text-sm text-muted-foreground">Try widening the price range, location, or property type.</p>
                <Button variant="outline" size="sm" onClick={() => navigate("/hot-sheets")}>
                  Edit Hot Sheet
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  viewMode="compact"
                  showActions={false}
                  onSelect={toggleListing}
                  isSelected={selectedListings.has(listing.id)}
                  agentInfo={
                    agentMap[listing.agent_id]
                      ? {
                          name: agentMap[listing.agent_id].fullName,
                          company: agentMap[listing.agent_id].company
                        }
                      : null
                  }
                  chatMessages={messagesMap[listing.id]}
                  hotSheetId={id}
                  onNewMessage={handleNewMessage}
                  onOpenChat={() => {
                    setChatListingId(listing.id);
                    setChatDrawerOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>

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
        />
      )}

      {/* Confirm Invite Modal */}
      <AlertDialog open={confirmInviteOpen} onOpenChange={setConfirmInviteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send invite without selected listings?</AlertDialogTitle>
            <AlertDialogDescription>
              There are current matches, but you haven't selected any listings to include. You can still invite the client to view matches after accepting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back and Select Listings</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmInviteOpen(false); handleSendInvites(); }}>
              Send Invite Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
};

export default HotSheetReview;

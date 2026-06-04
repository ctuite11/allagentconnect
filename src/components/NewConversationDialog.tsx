import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Search, User, Loader2, Building2, MessageSquare } from "lucide-react";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { supabase } from "@/integrations/supabase/client";
import { findOrCreateConversation } from "@/lib/startConversation";
import { showMessageSentToast } from "@/lib/messageSentFeedback";
import { fetchMessageableClientRecipients } from "@/lib/contactSearch";
import { fetchBuyerMessageRecipients } from "@/lib/fetchBuyerMessageRecipients";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import AACMonogram from "@/components/ui/AACMonogram";
import { useAgentLastSeen } from "@/hooks/useAgentLastSeen";
import { formatDistanceToNow } from "date-fns";

interface Recipient {
  id: string;
  name: string;
  email: string;
  group: "agent" | "client" | "shared";
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Navigate here after sending (matches workspace route), without trailing slash. */
  messagesRouteBase?: string;
  /** Agent inbox: CRM + agents. Buyer inbox: agents from active relationships only. */
  composeVariant?: "agent" | "buyer";
  /** Refresh thread list immediately after starting a DM. */
  onConversationCreated?: () => void;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  messagesRouteBase = "/messages",
  composeVariant = "agent",
  onConversationCreated,
}: NewConversationDialogProps) {
  const navigate = useNavigate();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [listingContext, setListingContext] = useState<"general" | "listing">("general");
  const [listingSearch, setListingSearch] = useState("");
  const [listings, setListings] = useState<Array<{ id: string; address: string; city: string; state: string }>>([]);
  const [selectedListing, setSelectedListing] = useState<{ id: string; address: string } | null>(null);
  const [loadingListings, setLoadingListings] = useState(false);
  const [recentListings, setRecentListings] = useState<
    Array<{ id: string; address: string; city: string; state: string }>
  >([]);
  const [loadingRecentListings, setLoadingRecentListings] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const [buyerAgentProfile, setBuyerAgentProfile] = useState<{
    headshot_url: string | null;
    company: string | null;
    office_city: string | null;
  } | null>(null);

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const results: Recipient[] = [];

      if (composeVariant === "buyer") {
        const buyerRecipients = await fetchBuyerMessageRecipients(user.id, user.email);
        setRecipients(buyerRecipients);
        return;
      }

      // Fetch agents (agent compose)
      const { data: agents } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, email")
        .neq("id", user.id)
        .order("last_name");

      (agents || []).forEach((a) => {
        results.push({
          id: a.id,
          name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || a.email,
          email: a.email,
          group: "agent",
        });
      });

      const clients = await fetchMessageableClientRecipients(user.id);
      for (const c of clients) {
        results.push({
          id: c.id,
          name: c.name,
          email: c.email,
          group: "client",
        });
      }

      setRecipients(results);
    } catch (err) {
      console.error("Error fetching recipients:", err);
    } finally {
      setLoading(false);
    }
  }, [composeVariant]);

  useEffect(() => {
    if (!open) return;
    void fetchRecipients();
  }, [open, fetchRecipients]);

  // Buyer favorites — preload on open so we know whether listing context is available.
  useEffect(() => {
    if (!open || composeVariant !== "buyer") return;

    let cancelled = false;
    void (async () => {
      setLoadingRecentListings(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data: favs } = await supabase
          .from("favorites")
          .select("listing_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(12);
        const ids = [...new Set((favs ?? []).map((f: { listing_id: string }) => f.listing_id).filter(Boolean))];
        if (ids.length === 0) {
          if (!cancelled) setRecentListings([]);
          return;
        }
        const { data: rows } = await supabase
          .from("listings")
          .select("id, address, city, state")
          .in("id", ids)
          .limit(12);
        if (!cancelled) setRecentListings(rows ?? []);
      } finally {
        if (!cancelled) setLoadingRecentListings(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, composeVariant]);

  // Search listings
  useEffect(() => {
    if (listingContext !== "listing" || listingSearch.length < 2) {
      setListings([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingListings(true);
      try {
        const { data } = await supabase
          .from("listings")
          .select("id, address, city, state")
          .ilike("address", `%${listingSearch}%`)
          .eq("status", "active")
          .limit(10);
        setListings(data || []);
      } catch {
        setListings([]);
      } finally {
        setLoadingListings(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [listingSearch, listingContext]);

  // Recent listings for agent compose, or buyer "About a listing" picker.
  useEffect(() => {
    if (!open || listingContext !== "listing") return;
    if (composeVariant === "buyer") return;

    let cancelled = false;
    void (async () => {
      setLoadingRecentListings(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data: rows } = await supabase
          .from("listings")
          .select("id, address, city, state")
          .eq("agent_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(12);
        if (!cancelled) setRecentListings(rows ?? []);
      } finally {
        if (!cancelled) setLoadingRecentListings(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, listingContext, composeVariant]);

  const resizeMessageArea = useCallback(() => {
    const el = messageRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxPx = composeVariant === "buyer" ? 240 : 160;
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }, [composeVariant]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => resizeMessageArea());
  }, [open, resizeMessageArea]);

  const filteredRecipients = useMemo(() => {
    if (composeVariant === "buyer") return recipients;
    if (!search.trim()) return recipients;
    const q = search.toLowerCase();
    return recipients.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
    );
  }, [recipients, search, composeVariant]);

  const agentRecipients = filteredRecipients.filter((r) => r.group === "agent");
  const buyerRecipients = filteredRecipients.filter((r) => r.group === "client");
  const sharedRecipients = filteredRecipients.filter((r) => r.group === "shared");
  const buyerAgent = agentRecipients[0] ?? null;
  const buyerHasConnectedGroup = sharedRecipients.length > 0;
  const buyerCanLinkListing = recentListings.length > 0;
  const buyerAgentPresence = useAgentLastSeen(
    composeVariant === "buyer" ? buyerAgent?.id : undefined,
  );

  // Pull richer profile fields (headshot, brokerage, city) for the buyer's agent card.
  useEffect(() => {
    if (composeVariant !== "buyer" || !open || !buyerAgent?.id) {
      setBuyerAgentProfile(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("agent_profiles")
        .select("headshot_url, company, office_city")
        .eq("id", buyerAgent.id)
        .maybeSingle();
      if (cancelled) return;
      setBuyerAgentProfile({
        headshot_url: data?.headshot_url ?? null,
        company: data?.company ?? null,
        office_city: data?.office_city ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [composeVariant, open, buyerAgent?.id]);

  const handleSend = async () => {
    const sendRecipient = composeVariant === "buyer" ? buyerAgent : selectedRecipient;
    if (!sendRecipient) {
      toast.error(
        composeVariant === "buyer"
          ? "Your agent is not linked yet. Finish setup with your agent to send messages."
          : "Please select a recipient",
      );
      return;
    }
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }
    if (listingContext === "listing" && !selectedListing) {
      toast.error("Please select a listing");
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const listingId = listingContext === "listing" ? selectedListing?.id : null;
      const conversationId = await findOrCreateConversation(
        user.id,
        sendRecipient.id,
        { listingId: listingId ?? null }
      );

      if (!conversationId) throw new Error("Could not create conversation");

      const { error } = await supabase.from("conversation_messages").insert({
        conversation_id: conversationId,
        sender_agent_id: user.id,
        recipient_agent_id: sendRecipient.id,
        body: message.trim(),
      });

      if (error) throw error;

      supabase.functions.invoke("kick-email-queue").catch(() => {});

      onConversationCreated?.();
      showMessageSentToast();
      handleClose();
      const base = messagesRouteBase.replace(/\/$/, "");
      navigate(`${base}/${conversationId}`);
    } catch (err: any) {
      console.error("Error sending message:", err);
      toast.error(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const resetComposeState = () => {
    setSearch("");
    setSelectedRecipient(null);
    setMessage("");
    setListingContext("general");
    setListingSearch("");
    setSelectedListing(null);
    setListings([]);
    setRecentListings([]);
    setSending(false);
  };

  const handleClose = () => {
    resetComposeState();
    onOpenChange(false);
  };

  const handleDialogOpenChange = (next: boolean) => {
    if (!next) resetComposeState();
    onOpenChange(next);
  };

  const canSend =
    composeVariant === "buyer"
      ? Boolean(buyerAgent) &&
        message.trim().length > 0 &&
        !(listingContext === "listing" && !selectedListing) &&
        !sending
      : Boolean(selectedRecipient) &&
        message.trim().length > 0 &&
        !(listingContext === "listing" && !selectedListing) &&
        !sending;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) void handleSend();
    }
  };

  const renderRecipientRow = (r: Recipient) => {
    const selected = selectedRecipient?.id === r.id;
    return (
      <button
        type="button"
        key={r.id}
        onClick={() => setSelectedRecipient(r)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
          selected
            ? "border-[#0E56F5] bg-blue-50/40"
            : "border-transparent hover:bg-zinc-50",
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100">
          <User className="h-4 w-4 text-neutral-500" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-900">{r.name}</p>
          {r.email ? <p className="truncate text-xs text-zinc-400">{r.email}</p> : null}
        </div>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden p-0 bg-white">
        <div className="p-6 pb-0">
          <DialogHeader>
            {composeVariant === "buyer" ? (
              <>
                <DialogTitle className="flex items-center gap-2.5 text-xl font-semibold text-zinc-900">
                  <AACMonogram className="h-8 w-8 shrink-0 text-[#22C55E]" size={32} />
                  <span>New Message</span>
                </DialogTitle>
                <DialogDescription className="pl-[42px] text-sm text-zinc-500">
                  Send a message to your agent.
                </DialogDescription>
              </>
            ) : (
              <DialogTitle className="flex items-center gap-2.5 text-xl font-semibold text-zinc-900">
                <AACMonogram className="h-8 w-8 shrink-0 text-[#50C878]" size={32} />
                <span>New Chat</span>
              </DialogTitle>
            )}
          </DialogHeader>
        </div>

        <div className="max-h-[calc(85vh-80px)] space-y-4 overflow-y-auto p-6 pt-4">
          {composeVariant === "buyer" ? (
            <>
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <AacMonogramLoader variant="inline" hideMessage className="min-h-0 gap-0 py-0" />
                  </div>
                ) : buyerAgent ? (
                  <div className="flex items-start gap-3">
                    {buyerAgentProfile?.headshot_url ? (
                      <img
                        src={buyerAgentProfile.headshot_url}
                        alt={buyerAgent.name}
                        className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-zinc-200"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-zinc-200">
                        <span className="text-base font-semibold text-zinc-500">
                          {buyerAgent.name
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((p) => p[0]?.toUpperCase() ?? "")
                            .join("") || "A"}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                        My Agent
                      </p>
                      <p className="truncate text-base font-semibold text-zinc-900">
                        {buyerAgent.name}
                      </p>
                      {(buyerAgentProfile?.company || buyerAgentProfile?.office_city) ? (
                        <p className="truncate text-sm text-zinc-500">
                          {[buyerAgentProfile?.company, buyerAgentProfile?.office_city]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            buyerAgentPresence.isOnline ? "bg-[#22C55E]" : "bg-zinc-300",
                          )}
                          aria-hidden
                        />
                        <span className="text-xs text-zinc-500">
                          {buyerAgentPresence.isOnline
                            ? "Online"
                            : buyerAgentPresence.lastSeenAt
                              ? `Last active ${formatDistanceToNow(
                                  new Date(buyerAgentPresence.lastSeenAt),
                                  { addSuffix: true },
                                )}`
                              : "Offline"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Your agent is not linked yet. Finish setup with your agent to send messages.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-zinc-700">Message</Label>
                <Textarea
                  ref={messageRef}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    requestAnimationFrame(() => resizeMessageArea());
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  rows={6}
                  autoFocus
                  className="min-h-[8.75rem] max-h-[15rem] w-full resize-none overflow-y-auto"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!canSend}
                  className="bg-[#0E56F5] text-white hover:bg-[#0C4ED1] disabled:pointer-events-auto disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500 disabled:opacity-100 disabled:hover:bg-neutral-200"
                >
                  {sending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send Message
                </Button>
              </div>
            </>
          ) : (
            <>
          {/* Recipient */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-zinc-700">To</Label>
            {selectedRecipient ? (
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-2 bg-zinc-100 rounded-full px-3 py-1.5 max-w-full">
                  <User className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="text-sm font-medium text-zinc-700 truncate">{selectedRecipient.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedRecipient(null)}
                    className="text-zinc-400 hover:text-zinc-600 ml-1 shrink-0"
                    aria-label="Change recipient"
                  >
                    ×
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="pl-9 w-full bg-white border-neutral-200 text-neutral-900 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none focus:border-[#0E56F5] focus-visible:border-[#0E56F5]"
                    autoFocus
                  />
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <AacMonogramLoader variant="inline" hideMessage className="min-h-0 gap-0 py-0" />
                  </div>
                ) : (
                  <ScrollArea className="max-h-[220px]">
                    <div className="space-y-1">
                      {buyerRecipients.length > 0 && (
                        <>
                          <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                            My Buyers
                          </p>
                          {buyerRecipients.map(renderRecipientRow)}
                        </>
                      )}
                      {agentRecipients.length > 0 && (
                        <>
                          <p
                            className={`px-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 ${
                              buyerRecipients.length > 0 ? "pt-3" : "pt-2"
                            }`}
                          >
                            Agents
                          </p>
                          {agentRecipients.map(renderRecipientRow)}
                        </>
                      )}
                      {agentRecipients.length === 0 && buyerRecipients.length === 0 && (
                        <p className="px-2 py-6 text-center text-sm text-zinc-400">No results found</p>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </>
            )}
          </div>

          {/* Context — always visible below To */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-zinc-700">Context</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setListingContext("general");
                  setSelectedListing(null);
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors bg-white hover:border-neutral-300 hover:bg-neutral-50",
                  listingContext === "general"
                    ? "border-[#0E56F5] text-[#0E56F5]"
                    : "border-neutral-200 text-neutral-600"
                )}
              >
                <MessageSquare
                  className={cn(
                    "w-4 h-4 shrink-0",
                    listingContext === "general" ? "text-[#0E56F5]" : "text-neutral-500"
                  )}
                />
                General
              </button>
              <button
                type="button"
                onClick={() => setListingContext("listing")}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors bg-white hover:border-neutral-300 hover:bg-neutral-50",
                  listingContext === "listing"
                    ? "border-[#0E56F5] text-[#0E56F5]"
                    : "border-neutral-200 text-neutral-600"
                )}
              >
                <Building2
                  className={cn(
                    "w-4 h-4 shrink-0",
                    listingContext === "listing" ? "text-[#0E56F5]" : "text-neutral-500"
                  )}
                />
                About a listing
              </button>
            </div>
          </div>

          {/* Listing — when contextual */}
          {listingContext === "listing" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-700">Listing</Label>
              {selectedListing ? (
                <div className="flex items-center gap-2 bg-zinc-50 rounded-lg px-3 py-2 border border-zinc-200 w-full">
                  <Building2 className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span className="text-sm text-zinc-700 flex-1 min-w-0 truncate">{selectedListing.address}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedListing(null)}
                    className="text-zinc-400 hover:text-zinc-600 shrink-0"
                    aria-label="Clear listing"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  {loadingRecentListings ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-400 px-1 py-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading recent listings…
                    </div>
                  ) : recentListings.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs text-zinc-500 px-1">Recent</p>
                      <div className="border border-zinc-200 rounded-lg overflow-hidden max-h-[140px] overflow-y-auto">
                        {recentListings.map((l) => (
                          <button
                            type="button"
                            key={l.id}
                            onClick={() =>
                              setSelectedListing({
                                id: l.id,
                                address: [l.address, l.city, l.state].filter(Boolean).join(", "),
                              })
                            }
                            className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-zinc-50 text-sm border-b border-zinc-100 last:border-b-0"
                          >
                            <Building2 className="w-4 h-4 text-zinc-400 shrink-0" />
                            <span className="truncate text-zinc-700">
                              {l.address}, {l.city}, {l.state}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <Input
                    value={listingSearch}
                    onChange={(e) => setListingSearch(e.target.value)}
                    placeholder="Search listing address..."
                    className="w-full"
                  />
                  {loadingListings && (
                    <div className="flex items-center gap-2 text-xs text-zinc-400 px-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Searching...
                    </div>
                  )}
                  {listings.length > 0 && (
                    <div className="border border-zinc-200 rounded-lg overflow-hidden">
                      {listings.map((l) => (
                        <button
                          type="button"
                          key={l.id}
                          onClick={() => {
                            setSelectedListing({
                              id: l.id,
                              address: `${l.address}, ${l.city}, ${l.state}`,
                            });
                            setListingSearch("");
                            setListings([]);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-zinc-50 text-sm border-b border-zinc-100 last:border-b-0"
                        >
                          <Building2 className="w-4 h-4 text-zinc-400 shrink-0" />
                          <span className="truncate text-zinc-700">
                            {l.address}, {l.city}, {l.state}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Message */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-zinc-700">Message</Label>
            <Textarea
              ref={messageRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                requestAnimationFrame(() => resizeMessageArea());
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={2}
              className="w-full min-h-[2.75rem] max-h-[10rem] overflow-y-auto resize-none"
            />
          </div>

          {/* Send */}
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend}
              className="bg-[#0E56F5] text-white hover:bg-[#0C4ED1] disabled:pointer-events-auto disabled:bg-neutral-200 disabled:text-neutral-500 disabled:hover:bg-neutral-200 disabled:opacity-100 disabled:cursor-not-allowed"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Message
            </Button>
          </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

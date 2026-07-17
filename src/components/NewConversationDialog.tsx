import { useState, useEffect, useCallback, useRef } from "react";
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
import { toast } from "sonner";
import { Send, Search, User, Loader2, Building2, MessageSquare } from "lucide-react";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { supabase } from "@/integrations/supabase/client";
import { findOrCreateConversation } from "@/lib/startConversation";
import { showMessageSentToast } from "@/lib/messageSentFeedback";
import {
  AGENT_CONTACT_MIN_QUERY_LENGTH,
  formatUnifiedMessageRecipientRoles,
  searchUnifiedMessageRecipients,
  type UnifiedMessageRecipient,
} from "@/lib/contactSearch";
import { fetchBuyerMessageRecipients } from "@/lib/fetchBuyerMessageRecipients";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import AACMonogram from "@/components/ui/AACMonogram";
import { useAgentLastSeen } from "@/hooks/useAgentLastSeen";
import { formatDistanceToNow } from "date-fns";
import { initialsFromDisplayName } from "@/lib/initials";

interface Recipient {
  id: string;
  name: string;
  email: string;
  group: "agent" | "client" | "shared";
  headshotUrl?: string | null;
}

const AGENT_RECIPIENT_SEARCH_DEBOUNCE_MS = 275;

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
  const [unifiedSearchResults, setUnifiedSearchResults] = useState<UnifiedMessageRecipient[]>([]);
  const [buyerComposeLoading, setBuyerComposeLoading] = useState(false);
  const [agentSearchLoading, setAgentSearchLoading] = useState(false);
  const [agentSearchError, setAgentSearchError] = useState<string | null>(null);
  const [agentSearchAttempt, setAgentSearchAttempt] = useState(0);
  const [debouncedAgentSearch, setDebouncedAgentSearch] = useState("");
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<UnifiedMessageRecipient | null>(null);
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

  const fetchBuyerComposeRecipients = useCallback(async () => {
    setBuyerComposeLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const buyerRecipients = await fetchBuyerMessageRecipients(user.id, user.email);
      setRecipients(buyerRecipients);
    } catch (err) {
      console.error("Error fetching buyer compose recipients:", err);
    } finally {
      setBuyerComposeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (composeVariant === "buyer") {
      void fetchBuyerComposeRecipients();
    }
  }, [open, composeVariant, fetchBuyerComposeRecipients]);

  // Agent compose: debounce search input before querying the unified directory.
  useEffect(() => {
    if (!open || composeVariant !== "agent") return;

    const q = search.trim();
    if (q.length < AGENT_CONTACT_MIN_QUERY_LENGTH) {
      setAgentSearchLoading(false);
      setDebouncedAgentSearch("");
      return;
    }

    // Same trimmed query as the last search (e.g. trailing space typed):
    // no new request will fire, so don't leave the spinner running.
    if (q === debouncedAgentSearch) {
      setAgentSearchLoading(false);
      return;
    }

    setAgentSearchLoading(true);
    const timer = setTimeout(() => {
      setDebouncedAgentSearch(q);
    }, AGENT_RECIPIENT_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search, open, composeVariant, debouncedAgentSearch]);

  // Agent compose: unified contact search (My Contacts + network agents, one row per person).
  useEffect(() => {
    if (!open || composeVariant !== "agent") return;

    const q = debouncedAgentSearch.trim();
    if (q.length < AGENT_CONTACT_MIN_QUERY_LENGTH) {
      setUnifiedSearchResults([]);
      setAgentSearchLoading(false);
      setAgentSearchError(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      setAgentSearchLoading(true);
      setAgentSearchError(null);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const results = await searchUnifiedMessageRecipients(user.id, q);
        if (!cancelled) setUnifiedSearchResults(results);
      } catch (err) {
        console.error("Error searching unified message recipients:", err);
        if (!cancelled) {
          setUnifiedSearchResults([]);
          // Surface a real error state — a failed request must not present
          // itself as an empty "no results" outcome.
          setAgentSearchError("Search failed. Check your connection and try again.");
        }
      } finally {
        if (!cancelled) setAgentSearchLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedAgentSearch, agentSearchAttempt, open, composeVariant]);

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

  const agentSearchQuery = search.trim();
  const agentSearchReady = agentSearchQuery.length >= AGENT_CONTACT_MIN_QUERY_LENGTH;

  const handleSelectContact = useCallback((contact: UnifiedMessageRecipient) => {
    setSelectedContact(contact);
    setSearch("");
    setDebouncedAgentSearch("");
    setUnifiedSearchResults([]);
    setAgentSearchError(null);
    requestAnimationFrame(() => messageRef.current?.focus());
  }, []);

  const buyerAgent = composeVariant === "buyer" ? recipients.find((r) => r.group === "agent") ?? null : null;
  const sharedRecipients =
    composeVariant === "buyer" ? recipients.filter((r) => r.group === "shared") : [];
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
    const sendRecipient = composeVariant === "buyer" ? buyerAgent : selectedContact;
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

    const recipientUserId =
      composeVariant === "buyer"
        ? (sendRecipient as Recipient).id
        : (sendRecipient as UnifiedMessageRecipient).messageUserId;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const listingId = listingContext === "listing" ? selectedListing?.id : null;
      const conversationId = await findOrCreateConversation(
        user.id,
        recipientUserId,
        { listingId: listingId ?? null }
      );

      if (!conversationId) {
        const contact = composeVariant === "agent" ? (sendRecipient as UnifiedMessageRecipient) : null;
        throw new Error(
          contact?.roles.includes("buyer")
            ? "Could not start this conversation. Make sure the buyer has an active workspace link."
            : "Could not create conversation",
        );
      }

      const { error } = await supabase.from("conversation_messages").insert({
        conversation_id: conversationId,
        sender_agent_id: user.id,
        recipient_agent_id: recipientUserId,
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
    setDebouncedAgentSearch("");
    setAgentSearchLoading(false);
    setAgentSearchError(null);
    setSelectedContact(null);
    setUnifiedSearchResults([]);
    setMessage("");
    setListingContext("general");
    setListingSearch("");
    setSelectedListing(null);
    setListings([]);
    setRecentListings([]);
    setRecipients([]);
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
      : Boolean(selectedContact) &&
        message.trim().length > 0 &&
        !(listingContext === "listing" && !selectedListing) &&
        !sending;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) void handleSend();
    }
  };

  const renderUnifiedSearchRow = (contact: UnifiedMessageRecipient) => {
    const selected = selectedContact?.mergeKey === contact.mergeKey;
    const primaryLabel = contact.displayName.trim() || contact.email.trim();
    const roleLabel = formatUnifiedMessageRecipientRoles(contact.roles);

    return (
      <button
        type="button"
        key={contact.mergeKey}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleSelectContact(contact)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
          selected ? "bg-blue-50/60 ring-1 ring-[#0E56F5]/30" : "hover:bg-zinc-50",
        )}
      >
        {contact.headshotUrl ? (
          <img
            src={contact.headshotUrl}
            alt={primaryLabel}
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-zinc-200"
          />
        ) : (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              contact.roles.includes("buyer")
                ? "bg-neutral-200 text-neutral-700"
                : "bg-zinc-100 text-zinc-600",
            )}
          >
            {initialsFromDisplayName(primaryLabel)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900">{primaryLabel}</p>
          {roleLabel ? (
            <p className="truncate text-xs font-medium text-zinc-500">{roleLabel}</p>
          ) : null}
          {contact.email.trim() ? (
            <p className="truncate text-xs text-zinc-600">{contact.email.trim()}</p>
          ) : null}
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
                <span>New Message</span>
              </DialogTitle>
            )}
          </DialogHeader>
        </div>

        <div className="max-h-[calc(85vh-80px)] space-y-4 overflow-y-auto p-6 pt-4">
          {composeVariant === "buyer" ? (
            <>
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
                {buyerComposeLoading ? (
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
            {selectedContact ? (
              <div className="flex items-center gap-2">
                <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5">
                  <User className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  <span className="truncate text-sm font-medium text-zinc-700">{selectedContact.displayName}</span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {formatUnifiedMessageRecipientRoles(selectedContact.roles)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedContact(null)}
                    className="ml-1 shrink-0 text-zinc-400 hover:text-zinc-600"
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
                    placeholder="Search buyers and agents..."
                    className="pl-9 w-full bg-white border-neutral-200 text-neutral-900 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none focus:border-[#0E56F5] focus-visible:border-[#0E56F5]"
                    autoFocus
                  />
                </div>
                {!agentSearchReady ? (
                  <p className="px-2 py-6 text-center text-sm text-zinc-400">
                    Start typing to search buyers and agents.
                  </p>
                ) : unifiedSearchResults.length > 0 ? (
                  <div className="max-h-[240px] overflow-y-auto rounded-lg border border-zinc-100">
                    <div className="space-y-0.5 p-1">
                      {unifiedSearchResults.map(renderUnifiedSearchRow)}
                    </div>
                  </div>
                ) : agentSearchLoading ? (
                  <p className="flex items-center justify-center gap-2 px-2 py-6 text-sm text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching…
                  </p>
                ) : agentSearchError ? (
                  <div className="space-y-2 px-2 py-6 text-center">
                    <p className="text-sm text-zinc-600">{agentSearchError}</p>
                    <button
                      type="button"
                      onClick={() => setAgentSearchAttempt((n) => n + 1)}
                      className="text-sm font-medium text-[#0E56F5] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
                    >
                      Try again
                    </button>
                  </div>
                ) : (
                  <p className="px-2 py-6 text-center text-sm text-zinc-400">
                    No matching buyers or agents found.
                  </p>
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

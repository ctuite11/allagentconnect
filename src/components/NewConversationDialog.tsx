import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
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
import { supabase } from "@/integrations/supabase/client";
import { findOrCreateConversation } from "@/lib/startConversation";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Recipient {
  id: string;
  name: string;
  email: string;
  group: "agent" | "client";
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

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const results: Recipient[] = [];

      if (composeVariant === "buyer") {
        const { data: rels } = await supabase
          .from("client_agent_relationships")
          .select("agent_id")
          .eq("client_id", user.id)
          .eq("status", "active");

        const agentIds = [...new Set((rels ?? []).map((r) => r.agent_id).filter(Boolean))];
        if (agentIds.length > 0) {
          const { data: profiles } = await supabase
            .from("agent_profiles")
            .select("id, first_name, last_name, email")
            .in("id", agentIds);

          (profiles || []).forEach((a) => {
            results.push({
              id: a.id,
              name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || a.email || "Unknown",
              email: a.email,
              group: "agent",
            });
          });
        }
        setRecipients(results);
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

      // Fetch my clients (active relationships)
      const { data: relationships } = await supabase
        .from("client_agent_relationships")
        .select("client_id")
        .eq("agent_id", user.id)
        .eq("status", "active");

      if (relationships && relationships.length > 0) {
        const clientIds = relationships.map((r) => r.client_id);
        const { data: clients } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", clientIds);

        (clients || []).forEach((c) => {
          results.push({
            id: c.id,
            name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Unknown",
            email: c.email || "",
            group: "client",
          });
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

  const filteredRecipients = useMemo(() => {
    if (!search.trim()) return recipients;
    const q = search.toLowerCase();
    return recipients.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
    );
  }, [recipients, search]);

  const agentRecipients = filteredRecipients.filter((r) => r.group === "agent");
  const buyerRecipients = filteredRecipients.filter((r) => r.group === "client");

  const handleSend = async () => {
    if (!selectedRecipient) {
      toast.error("Please select a recipient");
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
        selectedRecipient.id,
        { listingId: listingId ?? null }
      );

      if (!conversationId) throw new Error("Could not create conversation");

      const { error } = await supabase.from("conversation_messages").insert({
        conversation_id: conversationId,
        sender_agent_id: user.id,
        recipient_agent_id: selectedRecipient.id,
        body: message.trim(),
      });

      if (error) throw error;

      supabase.functions.invoke("kick-email-queue").catch(() => {});

      onConversationCreated?.();
      toast.success("Message sent!");
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

  const handleClose = () => {
    setSearch("");
    setSelectedRecipient(null);
    setMessage("");
    setListingContext("general");
    setListingSearch("");
    setSelectedListing(null);
    setListings([]);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden p-0 bg-white">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-zinc-900">
              New Chat
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-6 pt-4 space-y-4 overflow-y-auto max-h-[calc(85vh-80px)]">
          {/* Recipient Selection */}
          {!selectedRecipient ? (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-zinc-700">To</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="pl-9"
                  autoFocus
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                </div>
              ) : (
                <ScrollArea className="max-h-[280px]">
                  <div className="space-y-1">
                    {buyerRecipients.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-2 pt-2">
                          My Buyers
                        </p>
                        {buyerRecipients.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setSelectedRecipient(r)}
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-900 truncate">{r.name}</p>
                              <p className="text-xs text-zinc-400 truncate">{r.email}</p>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                    {agentRecipients.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-2 pt-3">
                          Agents
                        </p>
                        {agentRecipients.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setSelectedRecipient(r)}
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-zinc-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-900 truncate">{r.name}</p>
                              <p className="text-xs text-zinc-400 truncate">{r.email}</p>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                    {agentRecipients.length === 0 && buyerRecipients.length === 0 && (
                      <p className="text-sm text-zinc-400 text-center px-2 py-6">
                        {composeVariant === "buyer"
                          ? "No agent linked yet. Accept your invitation or finish setup with your agent to message them here."
                          : "No results found"}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          ) : (
            <>
              {/* Selected recipient chip */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-zinc-700">To</Label>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-2 bg-zinc-100 rounded-full px-3 py-1.5">
                    <User className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-sm font-medium text-zinc-700">{selectedRecipient.name}</span>
                    <button
                      onClick={() => setSelectedRecipient(null)}
                      className="text-zinc-400 hover:text-zinc-600 ml-1"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>

              {/* Context selector */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-zinc-700">Context</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setListingContext("general");
                      setSelectedListing(null);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
                      listingContext === "general"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    )}
                  >
                    <MessageSquare className="w-4 h-4" />
                    General
                  </button>
                  <button
                    onClick={() => setListingContext("listing")}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
                      listingContext === "listing"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    )}
                  >
                    <Building2 className="w-4 h-4" />
                    About a listing
                  </button>
                </div>
              </div>

              {/* Listing picker */}
              {listingContext === "listing" && (
                <div className="space-y-2">
                  {selectedListing ? (
                    <div className="flex items-center gap-2 bg-zinc-50 rounded-lg px-3 py-2 border border-zinc-200">
                      <Building2 className="w-4 h-4 text-zinc-500" />
                      <span className="text-sm text-zinc-700 flex-1 truncate">{selectedListing.address}</span>
                      <button
                        onClick={() => setSelectedListing(null)}
                        className="text-zinc-400 hover:text-zinc-600"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <Input
                        value={listingSearch}
                        onChange={(e) => setListingSearch(e.target.value)}
                        placeholder="Search listing address..."
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
                              key={l.id}
                              onClick={() => {
                                setSelectedListing({ id: l.id, address: `${l.address}, ${l.city}, ${l.state}` });
                                setListingSearch("");
                                setListings([]);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-zinc-50 text-sm border-b border-zinc-100 last:border-b-0"
                            >
                              <Building2 className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                              <span className="truncate text-zinc-700">{l.address}, {l.city}, {l.state}</span>
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
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  className="min-h-[100px] resize-none"
                  rows={4}
                />
              </div>

              {/* Send */}
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700"
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

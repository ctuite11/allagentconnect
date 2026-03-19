import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, User, Building2, MessageSquare } from "lucide-react";
import { useConversation } from "@/hooks/useConversation";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageRow } from "./MessageRow";
import { DateSeparator } from "./DateSeparator";
import { MessageComposer } from "./MessageComposer";
import { isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ConversationPanelProps {
  conversationId: string | undefined;
}

export function ConversationPanel({ conversationId }: ConversationPanelProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from as string | undefined;
  const { messages, details, loading, notFound, sending, sendMessage } =
    useConversation(conversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [listingAddress, setListingAddress] = useState<string | null>(null);

  // Hydrate listing address
  useEffect(() => {
    if (!details?.listingId) {
      setListingAddress(null);
      return;
    }
    supabase
      .from("listings")
      .select("address, city, state")
      .eq("id", details.listingId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setListingAddress(
            [data.address, data.city, data.state].filter(Boolean).join(", ")
          );
        } else {
          setListingAddress("Listing conversation");
        }
      });
  }, [details?.listingId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Empty state — no conversation selected
  if (!conversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <MessageSquare className="w-12 h-12 text-zinc-200 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-1">
          Select a conversation
        </h3>
        <p className="text-sm text-muted-foreground">
          Choose a thread from the right to start messaging
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <p className="text-muted-foreground mb-3">Conversation not found</p>
        <button
          onClick={() => navigate(from ?? "/agent-dashboard")}
          className="text-sm text-primary hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  // Build thread with date separators and same-sender grouping
  const threadElements: React.ReactNode[] = [];
  let lastDate: Date | null = null;
  let lastSenderId: string | null = null;

  messages.forEach((msg, idx) => {
    const msgDate = new Date(msg.createdAt);

    // Insert date separator at day boundary
    if (!lastDate || !isSameDay(lastDate, msgDate)) {
      threadElements.push(<DateSeparator key={`date-${idx}`} date={msgDate} />);
      lastSenderId = null; // reset grouping at day boundary
    }

    const showHeader = msg.senderId !== lastSenderId;

    threadElements.push(
      <MessageRow key={msg.id} message={msg} showHeader={showHeader} />
    );

    lastDate = msgDate;
    lastSenderId = msg.senderId;
  });

  const contextLabel = details?.listingId
    ? listingAddress || "Listing conversation"
    : "General";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex-shrink-0" style={{ minHeight: 72 }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(from ?? "/agent-dashboard")}
            className="p-2 hover:bg-muted rounded-lg transition-colors -ml-2"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div
            className={cn(
              "flex items-center gap-3",
              details?.otherUserIsAgent && "cursor-pointer hover:opacity-80"
            )}
            onClick={() =>
              details?.otherUserIsAgent &&
              navigate(`/agent/${details.otherUserId}`)
            }
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <span className="text-lg font-semibold text-foreground block truncate">
                {details?.otherUserName}
              </span>
              <div className="flex items-center gap-1.5">
                {details?.listingId && (
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-sm text-muted-foreground truncate">
                  {contextLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">
            No messages yet. Start the conversation!
          </div>
        ) : (
          threadElements
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <MessageComposer onSend={sendMessage} sending={sending} />
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X, MessageSquare } from "lucide-react";
import { useConversation } from "@/hooks/useConversation";
import { useAgentLastSeen } from "@/hooks/useAgentLastSeen";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageRow } from "./MessageRow";
import { DateSeparator } from "./DateSeparator";
import { MessageComposer } from "./MessageComposer";
import { UserAvatar } from "./UserAvatar";
import { isSameDay, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ConversationPanelProps {
  conversationId: string | undefined;
  /** Refetch inbox thread list (e.g. after send — sidebar previews update for sender). */
  onInboxInvalidate?: () => void;
}

export function ConversationPanel({ conversationId, onInboxInvalidate }: ConversationPanelProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from as string | undefined;
  const { messages, details, loading, notFound, fetchError, sending, sendMessage, refetch } =
    useConversation(conversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [listingAddress, setListingAddress] = useState<string | null>(null);
  const { lastSeenAt, isOnline } = useAgentLastSeen(details?.otherUserId);

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

  if (!conversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <MessageSquare className="w-12 h-12 text-zinc-200 mb-4" />
        <h3 className="text-lg font-semibold text-zinc-900 mb-1">
          Select a conversation
        </h3>
        <p className="text-sm text-zinc-400">
          Choose a conversation from the left to keep chatting
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-6 w-40" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 mt-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
        ))}
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <p className="text-zinc-500 mb-3">Conversation not found</p>
        <button
          onClick={() => navigate(from ?? "/agent-dashboard")}
          className="text-sm text-primary hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-zinc-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-zinc-900 truncate">
              {details?.otherUserName ?? "Conversation"}
            </h2>
            <button
              onClick={() => navigate(from ?? "/agent-dashboard")}
              className="p-2 -mr-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400 hover:text-zinc-600"
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-10">
          <p className="text-sm text-zinc-600 mb-3 max-w-md">{fetchError}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-sm font-medium text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const threadElements: React.ReactNode[] = [];
  let lastDate: Date | null = null;
  let lastSenderId: string | null = null;

  messages.forEach((msg, idx) => {
    const msgDate = new Date(msg.createdAt);

    if (!lastDate || !isSameDay(lastDate, msgDate)) {
      threadElements.push(<DateSeparator key={`date-${idx}`} date={msgDate} />);
      lastSenderId = null;
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
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar
              name={details?.otherUserName ?? ""}
              headshotUrl={details?.otherUserHeadshotUrl ?? null}
              size="lg"
              userId={details?.otherUserId}
              isOnline={isOnline}
            />
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-zinc-900 tracking-[-0.01em] truncate">
                {details?.otherUserName}
              </h2>
              {contextLabel && (
                <span className="text-[12px] text-zinc-400 truncate block">
                  {contextLabel}
                </span>
              )}
              {details?.otherUserId && (
                <span className="flex items-center gap-1.5 mt-0.5">
                  {isOnline ? (
                    <>
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="text-[11px] text-emerald-600 font-medium">Online</span>
                    </>
                  ) : lastSeenAt ? (
                    <span className="text-[11px] text-zinc-400">
                      Active {formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true })}
                    </span>
                  ) : null}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate(from ?? "/agent-dashboard")}
            className="p-2 -mr-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400 hover:text-zinc-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-6 py-5 bg-zinc-50">
        {messages.length === 0 ? (
          <div className="text-center text-zinc-400 py-12 text-sm">
            No messages yet. Send the first message when you are ready.
          </div>
        ) : (
          threadElements
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <MessageComposer
        onSend={async (body) => {
          const ok = await sendMessage(body);
          if (ok) onInboxInvalidate?.();
          return ok;
        }}
        sending={sending}
      />
    </div>
  );
}

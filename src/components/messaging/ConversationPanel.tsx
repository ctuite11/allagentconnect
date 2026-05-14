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

interface ConversationPanelProps {
  conversationId: string | undefined;
  /** Refetch inbox thread list (e.g. after send — sidebar previews update for sender). */
  onInboxInvalidate?: () => void;
  /**
   * When set (e.g. embedded listing thread), header close calls this instead of navigating away.
   */
  onCloseRequest?: () => void;
  /**
   * Primary header line — e.g. full listing address for a listing-scoped thread.
   * When set, the listing “About:” subtitle is omitted to avoid duplication.
   */
  threadTitle?: string | null;
}

export function ConversationPanel({
  conversationId,
  onInboxInvalidate,
  onCloseRequest,
  threadTitle,
}: ConversationPanelProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from as string | undefined;
  const { messages, details, loading, notFound, fetchError, sending, sendMessage, refetch } =
    useConversation(conversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [listingAddress, setListingAddress] = useState<string | null>(null);
  const { lastSeenAt, isOnline } = useAgentLastSeen(details?.otherUserId);

  const handleHeaderClose = () => {
    if (onCloseRequest) {
      onCloseRequest();
      return;
    }
    navigate(from ?? "/agent-dashboard");
  };

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
    if (messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!conversationId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-10 text-center md:py-14">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <MessageSquare className="h-7 w-7 text-zinc-300" strokeWidth={1.5} />
        </div>
        <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900">Select a conversation</h3>
        <p className="mt-2 max-w-[280px] text-[13px] leading-snug text-zinc-500">
          Pick a thread from your inbox to read and reply — or start a new chat.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-white">
        <div className="shrink-0 border-b border-neutral-200/90 px-4 py-3">
          <div className="flex w-full items-center gap-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full bg-zinc-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-[min(240px,60%)] rounded-md bg-zinc-100" />
              <Skeleton className="h-3 w-[min(160px,45%)] rounded-md bg-zinc-100/90" />
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 pb-4 pt-3">
          <div className="mx-auto w-full max-w-[520px] space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="mx-auto h-3 w-24 rounded-full bg-zinc-100 sm:mx-0" />
                <div className={`flex ${i % 2 ? "justify-end" : "justify-start"}`}>
                  <Skeleton
                    className={`rounded-2xl bg-zinc-100 ${i % 2 ? "h-14 w-[72%]" : "ml-[46px] h-14 w-[78%]"}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="shrink-0 border-t border-neutral-200/90 px-3 py-3">
          <Skeleton className="h-11 w-full rounded-xl bg-zinc-100" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-10 text-center">
        <p className="mb-4 text-[13px] font-medium text-zinc-700">Conversation not found</p>
        <button
          type="button"
          onClick={handleHeaderClose}
          className="text-[13px] font-medium text-[#0E56F5] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
        >
          Go back
        </button>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-white">
        <div className="shrink-0 border-b border-neutral-200/90 px-4 py-3">
          <div className="flex w-full items-center justify-between gap-3">
            <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-zinc-900">
              {details?.otherUserName ?? "Conversation"}
            </h2>
            <button
              type="button"
              onClick={handleHeaderClose}
              className="shrink-0 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-10 text-center">
          <p className="mb-4 max-w-md text-[13px] leading-snug text-zinc-600">{fetchError}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-[13px] font-semibold text-[#0E56F5] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
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

  const contextLabel =
    details?.listingId && !threadTitle?.trim() ? listingAddress || "Listing conversation" : null;

  const hasMessages = messages.length > 0;

  const composer = (
    <MessageComposer
      edge={hasMessages ? "bottom" : "top"}
      onSend={async (body) => {
        const ok = await sendMessage(body);
        if (ok) onInboxInvalidate?.();
        return ok;
      }}
      sending={sending}
    />
  );

  return (
    <div className="flex min-h-0 h-full w-full flex-1 flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-neutral-200/90 px-4 py-3">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <UserAvatar
              name={details?.otherUserName ?? ""}
              headshotUrl={details?.otherUserHeadshotUrl ?? null}
              size="lg"
              userId={details?.otherUserId}
              isOnline={isOnline}
            />
            <div className="min-w-0">
              {threadTitle?.trim() ? (
                <>
                  <h2 className="truncate text-[15px] font-semibold tracking-tight text-zinc-900">{threadTitle.trim()}</h2>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 gap-y-1">
                    <span className="truncate text-[12px] leading-snug text-zinc-500">
                      Discussion with {details?.otherUserName}
                    </span>
                    {details ? (
                      <span className="inline-flex shrink-0 items-center rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 shadow-none">
                        {details.otherUserIsAgent ? "AAC agent" : "Client"}
                      </span>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex min-w-0 flex-wrap items-center gap-2 gap-y-1">
                    <h2 className="truncate text-[15px] font-semibold tracking-tight text-zinc-900">
                      {details?.otherUserName}
                    </h2>
                    {details ? (
                      <span className="inline-flex shrink-0 items-center rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 shadow-none">
                        {details.otherUserIsAgent ? "AAC agent" : "Client"}
                      </span>
                    ) : null}
                  </div>
                  {contextLabel ? (
                    <span className="mt-1 block truncate text-[12px] leading-snug text-zinc-500">{contextLabel}</span>
                  ) : null}
                </>
              )}
              {details?.otherUserId && (
                <span className="mt-1 flex items-center gap-1.5">
                  {isOnline ? (
                    <>
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#22C55E]" />
                      <span className="text-[11px] font-medium text-[#15803d]">Online</span>
                    </>
                  ) : lastSeenAt ? (
                    <span className="text-[11px] text-zinc-500">
                      Active {formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true })}
                    </span>
                  ) : null}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleHeaderClose}
            className="-mr-1 shrink-0 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {hasMessages ? (
        <>
          {/* Thread — scroll; composer stays pinned to bottom */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-4 pb-3 pt-2">
            <div className="mx-auto w-full max-w-[520px]">
              {threadElements}
              <div ref={messagesEndRef} />
            </div>
          </div>
          {composer}
        </>
      ) : (
        <>
          {/* Empty thread: composer directly under header so input is visible without scrolling */}
          {composer}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-4 pb-3">
            <div className="mx-auto flex min-h-full w-full max-w-[520px] flex-col">
              <div className="flex flex-1 flex-col items-center justify-center px-2 py-6 sm:py-8">
                <div className="w-full rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-8 text-center sm:py-10">
                  <p className="text-[13px] font-medium text-zinc-700">No messages yet</p>
                  <p className="mt-2 text-[12px] leading-snug text-zinc-500">
                    Type above to start — first messages set the tone for this thread.
                  </p>
                </div>
              </div>
              <div ref={messagesEndRef} className="h-0 shrink-0" aria-hidden />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

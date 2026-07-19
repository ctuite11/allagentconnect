import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X, MessageSquare, ArrowLeft } from "lucide-react";
import { useConversation, type HotSheetCommentPreviewSync } from "@/hooks/useConversation";
import { useAgentLastSeen } from "@/hooks/useAgentLastSeen";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageRow } from "./MessageRow";
import { DateSeparator } from "./DateSeparator";
import { MessageComposer } from "./MessageComposer";
import { UserAvatar } from "./UserAvatar";
import { isSameDay, formatDistanceToNow } from "date-fns";
import { cn, formatListingConversationTitle } from "@/lib/utils";
import { showMessageSentToast } from "@/lib/messageSentFeedback";
import AgentIntelDrawer from "@/components/agent-search/AgentIntelDrawer";
import { resolveAgentProfileByUserId } from "@/lib/resolveAgentProfileForViewer";

interface ConversationPanelProps {
  conversationId: string | undefined;
  /** Refetch inbox thread list (e.g. after send — sidebar previews update for sender). */
  onInboxInvalidate?: () => void;
  /**
   * When set (e.g. embedded listing thread), header close calls this instead of navigating away.
   */
  onCloseRequest?: () => void;
  /**
   * Mobile-only "← All messages" affordance. On small viewports the inbox
   * column is hidden while a thread is open, so this is the way back.
   */
  onBackToInbox?: () => void;
  /**
   * Primary header line — e.g. full listing address for a listing-scoped thread.
   * When set, the listing “About:” subtitle is omitted to avoid duplication.
   */
  threadTitle?: string | null;
  /** Sheet/drawer embed: panel fills parent height with pinned composer. */
  layoutVariant?: "default" | "embedded";
  /** Optional hot-sheet card preview sync (suppresses duplicate hot-sheet emails). */
  hotSheetPreviewSync?: HotSheetCommentPreviewSync | null;
}

export function ConversationPanel({
  conversationId,
  onInboxInvalidate,
  onCloseRequest,
  onBackToInbox,
  threadTitle,
  layoutVariant = "default",
  hotSheetPreviewSync,
}: ConversationPanelProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from as string | undefined;
  const { messages, details, loading, notFound, fetchError, sending, sendMessage, refetch } =
    useConversation(conversationId, { hotSheetPreviewSync });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [listingAddress, setListingAddress] = useState<string | null>(null);
  const { lastSeenAt, isOnline } = useAgentLastSeen(details?.otherUserId);

  // Single AgentIntelDrawer owned by the panel — one instance for the header
  // and every incoming message row. See MessageRow.onViewAgent wiring below.
  const [agentDrawer, setAgentDrawer] = useState<{ open: boolean; agent: any | null }>(
    { open: false, agent: null },
  );
  const openAgentProfile = async (userId: string | null | undefined) => {
    const row = await resolveAgentProfileByUserId(userId);
    if (!row) return; // Not an agent / no profile row → do nothing.
    setAgentDrawer({ open: true, agent: row });
  };
  const otherUserIsAgent = Boolean(details?.otherUserIsAgent);

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
      .select("address, city, state, zip_code, unit_number, condo_details")
      .eq("id", details.listingId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setListingAddress(formatListingConversationTitle(data));
        } else {
          setListingAddress("Listing conversation");
        }
      });
  }, [details?.listingId]);

  useEffect(() => {
    if (messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Thread may have been unarchived on load — refresh inbox lists (e.g. left sidebar).
  useEffect(() => {
    if (!conversationId || loading || notFound || fetchError) return;
    onInboxInvalidate?.();
  }, [conversationId, loading, notFound, fetchError, onInboxInvalidate]);

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
    const senderIsBuyer = !msg.isOwn && !otherUserIsAgent;
    const senderIsAgent = !msg.isOwn && otherUserIsAgent;

    threadElements.push(
      <MessageRow
        key={msg.id}
        message={{
          ...msg,
          senderIsBuyer,
        }}
        showHeader={showHeader}
        onViewAgent={senderIsAgent ? () => openAgentProfile(msg.senderId) : undefined}
      />
    );

    lastDate = msgDate;
    lastSenderId = msg.senderId;
  });

  const contextLabel =
    details?.listingId && !threadTitle?.trim() ? listingAddress || "Listing conversation" : null;

  const isEmbedded = layoutVariant === "embedded";
  const isEmptyThread = messages.length === 0;
  const listingThreadHeader = isEmbedded && Boolean(threadTitle?.trim());
  const contactSubtitle = details?.otherUserName
    ? details.otherUserIsAgent
      ? `Your agent • ${details.otherUserName}`
      : details.otherUserName
    : null;

  const composer = (
    <MessageComposer
      onSend={async (body) => {
        const ok = await sendMessage(body);
        if (ok) {
          onInboxInvalidate?.();
          showMessageSentToast();
        }
        return ok;
      }}
      sending={sending}
      footerClassName={cn(
        isEmbedded && "pb-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]",
        isEmbedded && isEmptyThread && "pt-1.5",
        isEmbedded && !isEmptyThread && "pt-2",
      )}
    />
  );

  const rootClass = isEmbedded
    ? "flex h-full min-h-0 w-full flex-col overflow-hidden"
    : "flex h-full min-h-0 w-full max-h-full flex-1 flex-col overflow-hidden";

  const rolePill =
    details && !listingThreadHeader ? (
      <span className="inline-flex shrink-0 items-center rounded border border-neutral-200/60 bg-white px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {details.otherUserIsAgent ? "AAC agent" : "Client"}
      </span>
    ) : null;

  const presenceDot =
    details?.otherUserId && isOnline ? (
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#22C55E]"
        title="Online"
        aria-label="Online"
      />
    ) : null;

  return (
    <div className={rootClass}>
      {/* Mobile-only escape hatch back to the inbox list (list column is hidden
          below md while a thread is open). Desktop layout is untouched. */}
      {onBackToInbox ? (
        <div className="shrink-0 border-b border-neutral-100 md:hidden">
          <button
            type="button"
            onClick={onBackToInbox}
            className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-[13px] font-medium text-[#0E56F5] transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            All messages
          </button>
        </div>
      ) : null}
      {/* Header */}
      <div
        className={cn(
          "shrink-0 border-b border-neutral-200/90",
          listingThreadHeader ? "px-3.5 py-2" : "px-4 py-2.5",
        )}
      >
        <div className="flex w-full items-center justify-between gap-3">
          <div className={cn("flex min-w-0 flex-1 items-center", listingThreadHeader ? "gap-2" : "gap-2.5")}>
            {otherUserIsAgent && details?.otherUserId ? (
              <button
                type="button"
                onClick={() => openAgentProfile(details.otherUserId)}
                aria-label={`View ${details?.otherUserName ?? "agent"}'s agent profile`}
                className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40 focus-visible:ring-offset-1"
              >
                <UserAvatar
                  name={details?.otherUserName ?? ""}
                  headshotUrl={details?.otherUserHeadshotUrl ?? null}
                  size={listingThreadHeader ? "md" : "lg"}
                  showPresence={false}
                  isBuyer={false}
                />
              </button>
            ) : (
              <UserAvatar
                name={details?.otherUserName ?? ""}
                headshotUrl={details?.otherUserHeadshotUrl ?? null}
                size={listingThreadHeader ? "md" : "lg"}
                showPresence={false}
                isBuyer={!(details?.otherUserIsAgent ?? false)}
              />
            )}
            <div className="min-w-0">
              {listingThreadHeader ? (
                <>
                  <h2 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-zinc-900">
                    {threadTitle!.trim()}
                  </h2>
                  {contactSubtitle ? (
                    <div className="mt-px flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-[12px] leading-snug text-zinc-500">{contactSubtitle}</span>
                      {presenceDot}
                    </div>
                  ) : null}
                </>
              ) : threadTitle?.trim() ? (
                <>
                  <h2 className="truncate text-[15px] font-semibold tracking-tight text-zinc-900">{threadTitle.trim()}</h2>
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="truncate text-[12px] leading-snug text-zinc-500">
                      Discussion with{" "}
                      {otherUserIsAgent && details?.otherUserId ? (
                        <button
                          type="button"
                          onClick={() => openAgentProfile(details.otherUserId)}
                          className="font-medium text-[#0E56F5] hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40"
                        >
                          {details?.otherUserName}
                        </button>
                      ) : (
                        details?.otherUserName
                      )}
                    </span>
                    {presenceDot}
                    {rolePill}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    {otherUserIsAgent && details?.otherUserId ? (
                      <button
                        type="button"
                        onClick={() => openAgentProfile(details.otherUserId)}
                        className="truncate rounded text-left text-[15px] font-semibold tracking-tight text-zinc-900 hover:text-[#0E56F5] hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40 focus-visible:ring-offset-1"
                      >
                        {details?.otherUserName}
                      </button>
                    ) : (
                      <h2 className="truncate text-[15px] font-semibold tracking-tight text-zinc-900">
                        {details?.otherUserName}
                      </h2>
                    )}
                    {presenceDot}
                    {rolePill}
                  </div>
                  {contextLabel ? (
                    <span className="mt-0.5 block truncate text-[12px] leading-snug text-zinc-500">{contextLabel}</span>
                  ) : null}
                  {!isOnline && lastSeenAt ? (
                    <span className="mt-0.5 block text-[11px] text-zinc-500">
                      Active {formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true })}
                    </span>
                  ) : null}
                </>
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

      <div
        className={cn(
          "overscroll-contain bg-white",
          listingThreadHeader ? "px-3.5" : "px-4",
          isEmptyThread
            ? cn("shrink-0", listingThreadHeader ? "pb-0 pt-1" : "pb-3 pt-2")
            : cn("min-h-0 flex-1 overflow-y-auto", listingThreadHeader ? "pb-2 pt-1.5" : "pb-3 pt-2"),
        )}
      >
        <div className="mx-auto w-full max-w-[520px]">
          {isEmptyThread ? (
            <div
              className={cn(
                "flex flex-col items-center px-2",
                listingThreadHeader
                  ? "justify-start pb-0 pt-1.5"
                  : isEmbedded
                    ? "justify-start pb-1 pt-3"
                    : "justify-center py-4 sm:py-12",
              )}
            >
              <div
                className={cn(
                  "w-full rounded-xl border border-dashed border-neutral-200 bg-white px-4 text-center",
                  listingThreadHeader ? "py-2.5" : isEmbedded ? "py-3" : "py-5 sm:py-10",
                )}
              >
                <p className="text-[13px] font-medium text-zinc-700">No messages yet</p>
                {!isEmbedded ? (
                  <p className="mt-2 text-[12px] leading-snug text-zinc-500">
                    Send a message below to start this thread.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            threadElements
          )}
          <div ref={messagesEndRef} className="h-0 shrink-0" aria-hidden />
        </div>
      </div>
      {isEmbedded ? <div className="shrink-0">{composer}</div> : composer}
      <AgentIntelDrawer
        agent={agentDrawer.agent}
        open={agentDrawer.open}
        onOpenChange={(open) => setAgentDrawer((prev) => ({ ...prev, open }))}
      />
    </div>
  );
}

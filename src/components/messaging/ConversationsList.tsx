import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { SquarePen, Search } from "lucide-react";
import type { ConversationThread } from "@/hooks/useConversationThreads";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "./UserAvatar";
import { buyerMessagingThreadRow } from "@/lib/buyerUi";
import { cn } from "@/lib/utils";

interface ConversationsListProps {
  threads: ConversationThread[];
  threadsLoading: boolean;
  selectedId: string | undefined;
  inboxFetchError?: string | null;
  onRetryInbox?: () => void;
  onNewMessage?: () => void;
  showNewMessageButton?: boolean;
  routeBase?: string;
  heading?: string;
  searchPlaceholder?: string;
  emptyStateLabel?: string;
}

export function ConversationsList({
  threads,
  threadsLoading: loading,
  inboxFetchError,
  onRetryInbox,
  selectedId,
  onNewMessage,
  showNewMessageButton = true,
  routeBase = "/messages",
  heading = "Recent chats",
  searchPlaceholder = "Search name, message, or address",
  emptyStateLabel = "No conversations yet",
}: ConversationsListProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [addressCache, setAddressCache] = useState<Record<string, string>>({});

  useEffect(() => {
    if (loading || threads.length === 0) return;

    const listingIds = threads
      .map((t) => t.listingId)
      .filter((id): id is string => !!id && !addressCache[id]);

    const uniqueIds = [...new Set(listingIds)];
    if (uniqueIds.length === 0) return;

    supabase
      .from("listings")
      .select("id, address, city, state")
      .in("id", uniqueIds)
      .then(({ data }) => {
        if (!data) return;
        const entries: Record<string, string> = {};
        data.forEach((l) => {
          entries[l.id] = [l.address, l.city, l.state].filter(Boolean).join(", ");
        });
        setAddressCache((prev) => ({ ...prev, ...entries }));
      });
  }, [threads, loading]);

  const totalUnread = threads.filter((t) => t.isUnread).length;

  const filtered = threads.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.otherUserName.toLowerCase().includes(q) ||
      (t.lastMessagePreview ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-neutral-100 p-4 pb-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-[15px] font-semibold tracking-tight text-zinc-900">{heading}</h2>
            {totalUnread > 0 && (
              <span
                className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#16A34A] px-1.5 text-[10px] font-bold leading-none text-white shadow-none"
                aria-label={`${totalUnread} unread threads`}
              >
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
          {showNewMessageButton && onNewMessage && (
            <button
              type="button"
              onClick={onNewMessage}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-zinc-700 shadow-none transition-colors hover:border-neutral-300 hover:bg-zinc-50/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
              title="New chat"
            >
              <SquarePen className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              <span className="hidden sm:inline">New</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-[13px] text-zinc-900 shadow-none placeholder:text-zinc-400 transition-colors focus:border-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
          />
        </div>
      </div>

      {/* Thread list */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {loading ? (
          <div className="space-y-2 px-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-white px-3 py-3 shadow-sm"
              >
                <Skeleton className="h-10 w-10 shrink-0 rounded-full bg-zinc-100" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-[min(140px,50%)] rounded-md bg-zinc-100" />
                  <Skeleton className="h-3 w-[min(200px,75%)] rounded-md bg-zinc-100/90" />
                </div>
              </div>
            ))}
          </div>
        ) : inboxFetchError ? (
          <div className="space-y-3 p-8 text-center">
            <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-zinc-600">{inboxFetchError}</p>
            {onRetryInbox ? (
              <button
                type="button"
                onClick={() => onRetryInbox()}
                className="text-[13px] font-semibold text-[#0E56F5] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-10 text-center">
            <p className="text-[13px] font-medium text-zinc-700">{search ? "No matching threads" : emptyStateLabel}</p>
            {search ? (
              <p className="mt-1 text-[12px] text-zinc-500">Try a different name or keyword.</p>
            ) : (
              <p className="mt-1 text-[12px] text-zinc-500">Start a new chat from the button above.</p>
            )}
          </div>
        ) : (
          filtered.map((thread) => {
            const isSelected = thread.id === selectedId;
            const listingLine =
              thread.listingId && addressCache[thread.listingId]
                ? addressCache[thread.listingId]
                : null;
            const contextLabel = thread.listingId
              ? listingLine
                ? `Listing · ${listingLine}`
                : "Listing conversation"
              : thread.buyerNeedId
                ? "Client need thread"
                : null;
            return (
              <div
                key={thread.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  navigate(`${routeBase}/${thread.id}`, {
                    state: { from: routeBase, fromLabel: "Back to Messages" },
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    navigate(`${routeBase}/${thread.id}`, {
                      state: { from: routeBase, fromLabel: "Back to Messages" },
                    });
                }}
                className={cn(
                  "outline-none mb-1.5 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ease-out last:mb-0",
                  "focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                  isSelected
                    ? "border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-neutral-200/80"
                    : buyerMessagingThreadRow
                )}
              >
                <UserAvatar
                  name={thread.otherUserName}
                  headshotUrl={thread.otherUserHeadshotUrl}
                  size="lg"
                  showPresence={false}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-px">
                    <span
                      className={cn(
                        "text-[13px] truncate",
                        thread.isUnread
                          ? "font-bold text-zinc-900"
                          : "font-medium text-zinc-800"
                      )}
                    >
                      {thread.otherUserName}
                    </span>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {thread.unreadCount > 0 && (
                        <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#16A34A] px-2 py-0.5 text-[10px] font-bold leading-none text-white shadow-none">
                          {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
                        </span>
                      )}
                      <span className="text-[11px] tabular-nums text-zinc-400">
                        {formatDistanceToNow(new Date(thread.lastMessageAt), {
                          addSuffix: false,
                        })}
                      </span>
                    </div>
                  </div>
                  {thread.lastMessagePreview && (
                    <p
                      className={cn(
                        "truncate text-[12px] leading-snug",
                        thread.isUnread ? "text-zinc-600" : "text-zinc-400"
                      )}
                    >
                      {thread.lastMessageSenderId === thread.otherUserId
                        ? thread.lastMessagePreview
                        : `You: ${thread.lastMessagePreview}`}
                    </p>
                  )}
                  {contextLabel ? (
                    <p className="mt-1 truncate text-[11px] leading-snug text-zinc-400" title={contextLabel}>
                      {contextLabel}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

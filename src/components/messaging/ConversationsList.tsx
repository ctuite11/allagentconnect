import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { SquarePen, Search } from "lucide-react";
import type { ConversationThread } from "@/hooks/useConversationThreads";
import { useAgentPresenceBatch } from "@/hooks/useAgentLastSeen";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "./UserAvatar";
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

  const otherUserIds = useMemo(
    () => threads.map((t) => t.otherUserId).filter(Boolean),
    [threads]
  );
  const presenceMap = useAgentPresenceBatch(otherUserIds);

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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 pb-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-zinc-900 tracking-[-0.01em]">
              {heading}
            </h2>
            {totalUnread > 0 && (
              <span className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold leading-none">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
          {showNewMessageButton && onNewMessage && (
            <button
              type="button"
              onClick={onNewMessage}
              className="flex items-center gap-1.5 text-primary hover:text-primary/80 hover:bg-zinc-100 rounded-lg transition-colors px-2 py-1.5 text-[13px] font-semibold"
              title="New chat"
            >
              <SquarePen className="w-4 h-4" />
              <span>New Chat</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 rounded-full bg-zinc-100 border-0 pl-9 pr-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
          />
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-3.5 w-24 mb-2" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
            ))}
          </div>
        ) : inboxFetchError ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-[13px] text-zinc-600 whitespace-pre-wrap break-words">{inboxFetchError}</p>
            {onRetryInbox ? (
              <button
                type="button"
                onClick={() => onRetryInbox()}
                className="text-[13px] font-semibold text-primary hover:underline"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[13px] text-zinc-400">
              {search ? "No matching messages" : emptyStateLabel}
            </p>
          </div>
        ) : (
          filtered.map((thread) => {
            const isSelected = thread.id === selectedId;
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
                  "flex items-center gap-3 px-3 py-3 cursor-pointer transition-all",
                  isSelected
                    ? "bg-zinc-100 border-l-4 border-l-primary"
                    : "border-l-4 border-l-transparent hover:bg-zinc-100"
                )}
              >
                <UserAvatar
                  name={thread.otherUserName}
                  headshotUrl={thread.otherUserHeadshotUrl}
                  size="lg"
                  isOnline={presenceMap.get(thread.otherUserId)?.isOnline}
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
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {thread.unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-2 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-bold leading-none">
                          {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
                        </span>
                      )}
                      <span className="text-[11px] text-zinc-400 tabular-nums">
                        {formatDistanceToNow(new Date(thread.lastMessageAt), {
                          addSuffix: false,
                        })}
                      </span>
                    </div>
                  </div>
                  {thread.lastMessagePreview && (
                    <p
                      className={cn(
                        "text-[12px] truncate leading-snug",
                        thread.isUnread ? "text-zinc-600" : "text-zinc-400"
                      )}
                    >
                      {thread.lastMessageSenderId === thread.otherUserId
                        ? thread.lastMessagePreview
                        : `You: ${thread.lastMessagePreview}`}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

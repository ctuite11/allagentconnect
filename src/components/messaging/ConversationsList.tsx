import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { SquarePen } from "lucide-react";
import { useConversationThreads } from "@/hooks/useConversationThreads";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "./UserAvatar";
import { cn } from "@/lib/utils";

interface ConversationsListProps {
  selectedId: string | undefined;
  onNewMessage: () => void;
}

export function ConversationsList({ selectedId, onNewMessage }: ConversationsListProps) {
  const navigate = useNavigate();
  const { threads, loading } = useConversationThreads();
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-zinc-900 tracking-[-0.01em]">
              Recent chats
            </h2>
            {totalUnread > 0 && (
              <span className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold leading-none">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
          <button
            onClick={onNewMessage}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
            title="New message"
          >
            <SquarePen className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, message etc."
          className="w-full h-9 rounded-lg bg-zinc-100/80 border-0 px-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
        />
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                <Skeleton className="w-9 h-9 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-3.5 w-24 mb-2" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[13px] text-zinc-400">
              {search ? "No matching conversations" : "No conversations yet"}
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
                  navigate(`/messages/${thread.id}`, {
                    state: { from: "/messages", fromLabel: "Back to Messages" },
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    navigate(`/messages/${thread.id}`, {
                      state: { from: "/messages", fromLabel: "Back to Messages" },
                    });
                }}
                className={cn(
                  "flex items-center gap-3 px-5 py-3 cursor-pointer transition-all",
                  isSelected
                    ? "bg-zinc-50 border-l-2 border-l-primary"
                    : "border-l-2 border-l-transparent hover:bg-zinc-50/60"
                )}
              >
                <UserAvatar
                  name={thread.otherUserName}
                  headshotUrl={thread.otherUserHeadshotUrl}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-px">
                    <div className="flex items-center gap-1.5 min-w-0">
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
                      {thread.unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center h-[16px] min-w-[16px] px-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold leading-none flex-shrink-0">
                          {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-400 flex-shrink-0 tabular-nums">
                      {formatDistanceToNow(new Date(thread.lastMessageAt), {
                        addSuffix: false,
                      })}
                    </span>
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

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { User, Search, Building2, Plus } from "lucide-react";
import { useConversationThreads } from "@/hooks/useConversationThreads";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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

  // Hydrate listing addresses
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

  const unreadCount = threads.filter((t) => t.isUnread).length;

  const filtered = threads.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.otherUserName.toLowerCase().includes(q) ||
      (t.lastMessagePreview ?? "").toLowerCase().includes(q)
    );
  });

  const getContext = (thread: { listingId: string | null }) => {
    if (!thread.listingId) return "General";
    return addressCache[thread.listingId] || "Listing conversation";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Conversations</h2>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-emerald-500/10 text-emerald-700 text-xs font-medium">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          <Button
            onClick={onNewMessage}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients, agents, messages"
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-zinc-100 border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
          />
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-28 mb-2" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {search ? "No matching conversations" : "No conversations yet"}
            </p>
          </div>
        ) : (
          filtered.map((thread) => (
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
                "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-zinc-100",
                "hover:bg-zinc-50",
                thread.id === selectedId && "bg-zinc-50 border-l-2 border-l-primary"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span
                    className={cn(
                      "text-sm truncate text-foreground",
                      thread.isUnread ? "font-semibold" : "font-medium"
                    )}
                  >
                    {thread.otherUserName}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatDistanceToNow(new Date(thread.lastMessageAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  {thread.listingId && (
                    <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-xs text-muted-foreground truncate">
                    {getContext(thread)}
                  </span>
                </div>
                {thread.lastMessagePreview && (
                  <p
                    className={cn(
                      "text-sm truncate",
                      thread.isUnread ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {thread.lastMessageSenderId === thread.otherUserId
                      ? thread.lastMessagePreview
                      : `You: ${thread.lastMessagePreview}`}
                  </p>
                )}
              </div>
              {thread.isUnread && (
                <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-2" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, ArrowLeft, User, Plus, Building2 } from "lucide-react";
import { useConversationThreads } from "@/hooks/useConversationThreads";
import { PageShell } from "@/components/layout/PageShell";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { NewConversationDialog } from "@/components/NewConversationDialog";
import { Seo } from "@/components/Seo";

const panelCardClass =
  "bg-white rounded-2xl border border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

const threadRowCardClass = `${panelCardClass} cursor-pointer transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-neutral-300 hover:shadow-md`;

export default function Messages() {
  const navigate = useNavigate();
  const { threads, loading } = useConversationThreads();
  const [newMessageOpen, setNewMessageOpen] = useState(false);

  // Cache listing addresses: { [listingId]: addressString }
  const [addressCache, setAddressCache] = useState<Record<string, string>>({});

  // Hydrate listing addresses for threads that have listing_id
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
        const newEntries: Record<string, string> = {};
        data.forEach((l) => {
          newEntries[l.id] = [l.address, l.city, l.state].filter(Boolean).join(", ");
        });
        setAddressCache((prev) => ({ ...prev, ...newEntries }));
      });
  }, [threads, loading]);

  /** Fire-and-forget prefetch to warm Supabase cache */
  const prefetch = (threadId: string) => {
    supabase
      .from("conversations")
      .select("id, agent_a_id, agent_b_id, listing_id")
      .eq("id", threadId)
      .maybeSingle()
      .then(() => {});
  };

  const getThreadContext = (thread: { listingId: string | null }) => {
    if (!thread.listingId) return "General";
    return addressCache[thread.listingId] || "Listing conversation";
  };

  return (
    <PageShell>
      <Seo title="Messaging" />
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/agent-dashboard")}
              className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-600" />
            </button>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-emerald-600" />
              <h1 className="text-2xl font-semibold text-zinc-900">Messages</h1>
            </div>
          </div>
          <Button
            onClick={() => setNewMessageOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Chat
          </Button>
        </div>

        {loading ? (
          <AacMonogramLoader variant="section" className="min-h-[240px]" message="Loading messages..." />
        ) : threads.length === 0 ? (
          <div className={cn(panelCardClass, "p-8 text-center")}>
            <MessageSquare className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-700 mb-2">No messages yet</h3>
            <p className="text-zinc-500 text-sm mb-4">
              Your messages will appear here.
            </p>
            <Button
              onClick={() => setNewMessageOpen(true)}
              variant="outline"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Start a Conversation
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {threads.map((thread) => (
              <div
                key={thread.id}
                className={cn(
                  threadRowCardClass,
                  "p-4",
                  thread.isUnread && "border-l-4 border-l-emerald-500"
                )}
                onClick={() => navigate(`/messages/${thread.id}`, { state: { from: "/messages", fromLabel: "Back to Messages" } })}
                onMouseEnter={() => prefetch(thread.id)}
                onFocus={() => prefetch(thread.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate(`/messages/${thread.id}`);
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span
                        className={cn(
                          "font-medium text-zinc-900 truncate",
                          thread.isUnread && "font-bold"
                        )}
                      >
                        {thread.otherUserName}
                      </span>
                      <span className="text-xs text-zinc-400 flex-shrink-0">
                        {formatDistanceToNow(new Date(thread.lastMessageAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    {/* Thread context: listing address or General */}
                    <div className="flex items-center gap-1.5 mb-1">
                      {thread.listingId ? (
                        <Building2 className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                      ) : null}
                      <span className="text-xs text-zinc-400 truncate">
                        {getThreadContext(thread)}
                      </span>
                    </div>
                    {thread.lastMessagePreview && (
                      <p
                        className={cn(
                          "text-sm text-zinc-500 truncate",
                          thread.isUnread && "text-zinc-700"
                        )}
                      >
                        {thread.lastMessageSenderId === thread.otherUserId
                          ? thread.lastMessagePreview
                          : `You: ${thread.lastMessagePreview}`}
                      </p>
                    )}
                  </div>
                  {thread.isUnread && (
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0 mt-2" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewConversationDialog
        open={newMessageOpen}
        onOpenChange={setNewMessageOpen}
      />
    </PageShell>
  );
}

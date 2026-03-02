import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, ArrowLeft, User } from "lucide-react";
import { useConversationThreads } from "@/hooks/useConversationThreads";
import { PageShell } from "@/components/layout/PageShell";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const cardClass =
  "bg-white rounded-2xl border border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

export default function Messages() {
  const navigate = useNavigate();
  const { threads, loading } = useConversationThreads();

  /** Fire-and-forget prefetch to warm Supabase cache */
  const prefetch = (threadId: string) => {
    supabase
      .from("conversations")
      .select("id, agent_a_id, agent_b_id, listing_id")
      .eq("id", threadId)
      .maybeSingle()
      .then(() => {});
  };

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </button>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-semibold text-zinc-900">Messages</h1>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn(cardClass, "p-4")}>
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className={cn(cardClass, "p-8 text-center")}>
            <MessageSquare className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-700 mb-2">No messages yet</h3>
            <p className="text-zinc-500 text-sm">
              Your messages will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {threads.map((thread) => (
              <div
                key={thread.id}
                className={cn(
                  cardClass,
                  "cursor-pointer hover:bg-zinc-50 transition-colors p-4",
                  thread.isUnread && "border-l-4 border-l-emerald-500"
                )}
                onClick={() => navigate(`/messages/${thread.id}`)}
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
                    <div className="flex items-center justify-between gap-2 mb-1">
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
    </PageShell>
  );
}

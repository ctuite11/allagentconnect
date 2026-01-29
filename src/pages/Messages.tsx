import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, ArrowLeft, User } from "lucide-react";
import { useConversationThreads } from "@/hooks/useConversationThreads";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function Messages() {
  const navigate = useNavigate();
  const { threads, loading } = useConversationThreads();

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-semibold text-slate-900">Messages</h1>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : threads.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">No messages yet</h3>
              <p className="text-slate-500 text-sm">
                Start a conversation by visiting an agent's profile and clicking "Chat"
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {threads.map((thread) => (
              <Card
                key={thread.id}
                className={cn(
                  "cursor-pointer hover:bg-slate-50 transition-colors",
                  thread.isUnread && "border-l-4 border-l-emerald-500"
                )}
                onClick={() => navigate(`/messages/${thread.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={cn(
                            "font-medium text-slate-900 truncate",
                            thread.isUnread && "font-bold"
                          )}
                        >
                          {thread.otherUserName}
                        </span>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {formatDistanceToNow(new Date(thread.lastMessageAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      {thread.lastMessagePreview && (
                        <p
                          className={cn(
                            "text-sm text-slate-500 truncate",
                            thread.isUnread && "text-slate-700"
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}

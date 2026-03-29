import { useNavigate } from "react-router-dom";
import { MessageSquare, ChevronRight } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";
import { formatDistanceToNow } from "date-fns";

function getInitials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface CommunicationsPanelProps {
  conversations: SuccessHubSummary["conversations"];
}

export function CommunicationsPanel({ conversations }: CommunicationsPanelProps) {
  const navigate = useNavigate();

  const topConversations = conversations.slice(0, 3);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground">Recent Messages</h3>
        <button
          onClick={() => navigate("/client-needs")}
          className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          Open Inbox <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {topConversations.map((conv, i) => (
          <button
            key={conv.conversation_id}
            onClick={() => navigate("/client-needs")}
            className={`w-full text-left px-5 py-4 hover:bg-muted/50 transition-colors flex items-start gap-3 ${
              i < topConversations.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <Avatar className="h-8 w-8 shrink-0 mt-0.5">
              {conv.other_headshot_url && (
                <AvatarImage src={conv.other_headshot_url} alt={conv.other_name ?? ""} />
              )}
              <AvatarFallback className="bg-emerald-500 text-white text-xs font-medium">
                {getInitials(conv.other_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {conv.other_name ?? "Conversation"}
                </p>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {conv.last_message_preview ?? "No messages yet"}
              </p>
            </div>
          </button>
        ))}

        {topConversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No conversations yet.</p>
          </div>
        )}
      </div>
    </section>
  );
}

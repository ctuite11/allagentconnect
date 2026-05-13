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
          type="button"
          onClick={() => navigate("/communications")}
          className="text-sm font-medium text-[#0E56F5] hover:underline inline-flex items-center gap-1"
        >
          Communication Center <ChevronRight className="h-4 w-4 shrink-0" />
        </button>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-2 space-y-1.5 overflow-hidden">
        {topConversations.map((conv) => (
          <button
            key={conv.conversation_id}
            type="button"
            onClick={() => navigate(`/agent/messages/${conv.conversation_id}`)}
            className="w-full text-left px-4 py-3 rounded-xl flex items-start gap-3 bg-white border border-transparent transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-neutral-300 hover:shadow-md"
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

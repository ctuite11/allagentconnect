import { useNavigate } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";
import { formatDistanceToNow } from "date-fns";

interface CommunicationsPanelProps {
  conversations: SuccessHubSummary["conversations"];
}

export function CommunicationsPanel({ conversations }: CommunicationsPanelProps) {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
        <h3 className="text-base font-semibold text-foreground">Communications</h3>
        <button
          onClick={() => navigate("/communications")}
          className="text-sm font-medium text-primary hover:underline"
        >
          Open Communication Center →
        </button>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {conversations.map((conv) => (
          <button
            key={conv.conversation_id}
            onClick={() => navigate("/communications")}
            className="w-full text-left px-5 py-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                  conv.is_unread ? "bg-primary" : "bg-transparent"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {conv.last_message_preview?.slice(0, 40) ?? "New conversation"}
                  </p>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {conv.last_message_preview ?? "No messages yet"}
                </p>
              </div>
            </div>
          </button>
        ))}

        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No conversations yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

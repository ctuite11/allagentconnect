import { useNavigate } from "react-router-dom";
import { ChevronRight, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

interface DashboardCommunicationsProps {
  conversations: SuccessHubSummary["conversations"];
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function DashboardCommunications({ conversations }: DashboardCommunicationsProps) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground">Communications</h3>
        <button
          onClick={() => navigate("/client-needs")}
          className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-0.5"
        >
          Open Comm Center <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <Card className="border border-border bg-card">
        <CardContent className="p-0 divide-y divide-border/60">
          {conversations.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No messages yet.
            </div>
          ) : (
            conversations.slice(0, 5).map((c) => (
              <div
                key={c.conversation_id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/messages/${c.conversation_id}`, { state: { from: "/agent-dashboard", fromLabel: "Back to Dashboard" } })}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  {c.other_headshot_url && (
                    <AvatarImage src={c.other_headshot_url} alt={c.other_name ?? ""} />
                  )}
                  <AvatarFallback className="bg-emerald-500 text-white text-xs font-medium">
                    {getInitials(c.other_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {c.other_name ?? "Agent"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.last_message_preview ?? "No messages yet"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.is_unread && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">
                      New
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {relativeTime(c.last_message_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

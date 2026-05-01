import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-[15px] font-semibold text-neutral-900">Communications</h3>
        <button
          type="button"
          onClick={() => navigate("/client-needs")}
          className="inline-flex items-center gap-0.5 text-sm font-medium text-[#0E56F5] hover:underline"
        >
          Open Comm Center <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="overflow-hidden rounded-xl md:rounded-2xl">
        {conversations.length === 0 ? (
          <div className="py-10 text-center text-sm text-neutral-500">No messages yet.</div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {conversations.slice(0, 5).map((c) => (
              <li
                key={c.conversation_id}
                className="flex cursor-pointer items-center gap-3 bg-white px-4 py-3.5 transition-colors hover:bg-neutral-50/50"
                onClick={() =>
                  navigate(`/messages/${c.conversation_id}`, {
                    state: { from: "/agent-dashboard", fromLabel: "Back to Dashboard" },
                  })
                }
              >
                <Avatar className="h-8 w-8 shrink-0">
                  {c.other_headshot_url && (
                    <AvatarImage src={c.other_headshot_url} alt={c.other_name ?? ""} />
                  )}
                  <AvatarFallback className="bg-[#50C878] text-xs font-medium text-white">
                    {getInitials(c.other_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">{c.other_name ?? "Agent"}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {c.last_message_preview ?? "No messages yet"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c.is_unread && (
                    <Badge className="border-0 bg-[#50C878] px-1.5 py-0 text-[10px] font-medium text-white hover:bg-[#45b56a]">
                      New
                    </Badge>
                  )}
                  <span className="whitespace-nowrap text-[11px] text-neutral-500">
                    {relativeTime(c.last_message_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

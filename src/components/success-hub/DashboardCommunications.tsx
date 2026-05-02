import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

interface DashboardCommunicationsProps {
  conversations: SuccessHubSummary["conversations"];
  /** Denser list for Success Hub 2-col layout */
  compact?: boolean;
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

export function DashboardCommunications({ conversations, compact }: DashboardCommunicationsProps) {
  const navigate = useNavigate();
  const cap = compact ? 4 : 5;
  const rows = conversations.slice(0, cap);

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-neutral-900">Communications</h3>
          {compact ? (
            <p className="mt-0.5 text-[13px] leading-snug text-neutral-500">Recent message threads.</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={() => navigate("/messages")}
            className="text-sm font-medium text-[#0E56F5] hover:underline"
          >
            Inbox
          </button>
          <button
            type="button"
            onClick={() => navigate("/client-needs")}
            className="inline-flex items-center gap-0.5 text-sm font-medium text-[#0E56F5] hover:underline"
          >
            Comm Center <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className={`overflow-hidden rounded-xl md:rounded-2xl ${compact ? "max-h-72 overflow-y-auto" : ""}`}>
        {conversations.length === 0 ? (
          <div className={`text-center text-sm text-neutral-500 ${compact ? "py-6" : "py-10"}`}>
            No messages yet.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {rows.map((c) => (
              <li
                key={c.conversation_id}
                className={`flex cursor-pointer items-center gap-2.5 bg-white transition-colors hover:bg-neutral-50/50 md:gap-3 ${compact ? "px-3 py-2.5" : "px-4 py-3.5"}`}
                onClick={() =>
                  navigate(`/messages/${c.conversation_id}`, {
                    state: { from: "/agent-dashboard", fromLabel: "Back to Dashboard" },
                  })
                }
              >
                <Avatar className={`shrink-0 ${compact ? "h-7 w-7" : "h-8 w-8"}`}>
                  {c.other_headshot_url && (
                    <AvatarImage src={c.other_headshot_url} alt={c.other_name ?? ""} />
                  )}
                  <AvatarFallback className="bg-[#50C878] text-[10px] font-medium text-white md:text-xs">
                    {getInitials(c.other_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-medium text-neutral-900 ${compact ? "text-xs" : "text-sm"}`}>
                    {c.other_name ?? "Agent"}
                  </p>
                  <p className={`line-clamp-1 text-neutral-500 ${compact ? "text-[11px]" : "text-xs"}`}>
                    {c.last_message_preview ?? "No messages yet"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {c.is_unread && (
                    <Badge className="border-0 bg-[#50C878] px-1 py-0 text-[9px] font-medium text-white hover:bg-[#45b56a] md:text-[10px]">
                      New
                    </Badge>
                  )}
                  <span className="whitespace-nowrap text-[10px] text-neutral-400 md:text-[11px]">
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

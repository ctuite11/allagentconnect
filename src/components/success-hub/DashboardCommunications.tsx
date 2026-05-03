import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

interface DashboardCommunicationsProps {
  conversations: SuccessHubSummary["conversations"];
  compact?: boolean;
  inboxPreview?: boolean;
}

const INBOX_SLICE = 6;

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function snippetFromPreview(preview: string | null | undefined) {
  const t = preview?.trim();
  if (t) return t;
  return "";
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

export function DashboardCommunications({ conversations, compact, inboxPreview }: DashboardCommunicationsProps) {
  const navigate = useNavigate();
  const limit = inboxPreview ? INBOX_SLICE : 5;
  const rows = conversations.slice(0, limit);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-snug text-neutral-900">Messages</h3>
          {(compact || inboxPreview) && (
            <p className="mt-0.5 text-xs leading-snug text-neutral-500">Recent message threads.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate("/messages")}
          className="shrink-0 text-sm font-medium text-[#0E56F5] hover:underline"
        >
          View all →
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-100 bg-white">
        {conversations.length === 0 ? (
          <div className={`text-center text-sm text-neutral-500 ${compact || inboxPreview ? "py-4" : "py-8"}`}>
            No messages yet.
          </div>
        ) : inboxPreview ? (
          <ul className="max-h-[420px] divide-y divide-zinc-100 overflow-y-auto overscroll-contain">
            {rows.map((c) => {
              const snippet = snippetFromPreview(c.last_message_preview);
              const truncated =
                snippet.length > 140 ? `${snippet.slice(0, 137).trimEnd()}…` : snippet;
              return (
                <li
                  key={c.conversation_id}
                  className="flex cursor-pointer gap-2.5 bg-white px-3 py-2 transition-colors hover:bg-zinc-50/80"
                  onClick={() =>
                    navigate(`/messages/${c.conversation_id}`, {
                      state: { from: "/agent-dashboard", fromLabel: "Back to Dashboard" },
                    })
                  }
                >
                  <Avatar className="mt-0.5 h-7 w-7 shrink-0">
                    {c.other_headshot_url && (
                      <AvatarImage src={c.other_headshot_url} alt={c.other_name ?? ""} />
                    )}
                    <AvatarFallback className="bg-[#50C878] text-[10px] font-medium text-white">
                      {getInitials(c.other_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-neutral-900">{c.other_name ?? "Agent"}</p>
                      <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-neutral-400">
                        {relativeTime(c.last_message_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-start justify-between gap-2">
                      <p
                        className={`line-clamp-2 min-w-0 flex-1 text-left text-[11px] leading-snug ${
                          truncated ? "text-neutral-600" : "italic text-neutral-400"
                        }`}
                        title={snippet || undefined}
                      >
                        {truncated || "No preview yet."}
                      </p>
                      {c.is_unread ? (
                        <Badge className="shrink-0 border-0 bg-[#50C878] px-1.5 py-0 text-[10px] font-semibold text-white hover:bg-[#45b56a]">
                          New
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {rows.map((c) => (
              <li
                key={c.conversation_id}
                className={`flex cursor-pointer items-center gap-2.5 bg-white transition-colors hover:bg-neutral-50/50 md:gap-3 ${compact ? "px-3 py-2" : "px-4 py-3"}`}
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
                  <p
                    className={`line-clamp-2 text-neutral-600 ${compact ? "text-[11px]" : "text-xs"}`}
                    title={c.last_message_preview?.trim() || undefined}
                  >
                    {snippetFromPreview(c.last_message_preview) || "No preview yet."}
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

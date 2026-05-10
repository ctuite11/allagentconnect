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
          className="shrink-0 rounded-sm text-sm font-medium text-neutral-700 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2"
        >
          View all →
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        {conversations.length === 0 ? (
          <div
            className={`rounded-lg border border-dashed border-neutral-200 px-4 text-center text-sm text-neutral-500 ${compact || inboxPreview ? "py-6" : "py-10"}`}
          >
            No messages yet. Threads appear here when you start a conversation.
          </div>
        ) : inboxPreview ? (
          <ul className="max-h-[420px] space-y-1 overflow-y-auto overscroll-contain px-2 py-2">
            {rows.map((c) => {
              const snippet = snippetFromPreview(c.last_message_preview);
              const truncated =
                snippet.length > 140 ? `${snippet.slice(0, 137).trimEnd()}…` : snippet;
              return (
                <li
                  key={c.conversation_id}
                  className="flex cursor-pointer gap-2.5 rounded-lg border border-transparent bg-white px-3 py-2 transition-colors duration-150 hover:border-neutral-200 hover:bg-neutral-50/90"
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
                    <AvatarFallback className="bg-neutral-200 text-[10px] font-medium text-neutral-700">
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
                        <Badge
                          variant="outline"
                          className="shrink-0 border-neutral-200 bg-neutral-100 px-1.5 py-0 text-[10px] font-semibold text-neutral-800"
                        >
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
          <ul className="space-y-1 px-2 py-2">
            {rows.map((c) => (
              <li
                key={c.conversation_id}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent bg-white transition-colors duration-150 hover:border-neutral-200 hover:bg-neutral-50/90 md:gap-3 ${compact ? "px-3 py-2" : "px-4 py-3"}`}
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
                  <AvatarFallback className="bg-neutral-200 text-[10px] font-medium text-neutral-700 md:text-xs">
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
                    <Badge
                      variant="outline"
                      className="border-neutral-200 bg-neutral-100 px-1 py-0 text-[9px] font-semibold text-neutral-800 md:text-[10px]"
                    >
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

import { cn } from "@/lib/utils";
import { UserAvatar } from "./UserAvatar";

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface MessageRowProps {
  message: {
    id: string;
    senderId: string;
    senderName: string;
    senderHeadshotUrl?: string | null;
    body: string;
    createdAt: string;
    isOwn: boolean;
    senderIsBuyer?: boolean;
  };
  showHeader: boolean;
  /**
   * When provided (sender is a confirmed agent, not the viewer), the sender's
   * avatar + name become a single clickable target that opens the shared
   * AgentIntelDrawer owned by ConversationPanel.
   */
  onViewAgent?: () => void;
}

export function MessageRow({ message, showHeader, onViewAgent }: MessageRowProps) {
  const time = formatMessageTime(message.createdAt);
  const displayName = message.isOwn ? "Me" : message.senderName;
  const clickable = !message.isOwn && Boolean(onViewAgent);

  return (
    <div className={cn(
      "flex",
      message.isOwn ? "justify-end" : "justify-start",
      showHeader ? "mt-3 first:mt-0" : "mt-0.5"
    )}>
      <div className={cn("max-w-[70%]", message.isOwn ? "items-end" : "items-start")}>
        {/* Header: avatar + name + time (incoming only) */}
        {showHeader && !message.isOwn && (
          <div className="mb-1 flex items-center gap-2">
            {clickable ? (
              <button
                type="button"
                onClick={onViewAgent}
                aria-label={`View ${displayName}'s agent profile`}
                className="group flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40 focus-visible:ring-offset-1"
              >
                <UserAvatar
                  name={displayName}
                  headshotUrl={message.senderHeadshotUrl ?? null}
                  size="lg"
                  showPresence={false}
                  isBuyer={!!message.senderIsBuyer}
                />
                <span className="text-[13px] font-semibold text-zinc-900 group-hover:text-[#0E56F5] group-hover:underline underline-offset-4">
                  {displayName}
                </span>
              </button>
            ) : (
              <>
                <UserAvatar
                  name={displayName}
                  headshotUrl={message.senderHeadshotUrl ?? null}
                  size="lg"
                  showPresence={false}
                  isBuyer={!!message.senderIsBuyer}
                />
                <span className="text-[13px] font-semibold text-zinc-900">
                  {displayName}
                </span>
              </>
            )}
            <span className="text-[11px] text-zinc-400 tabular-nums">{time}</span>
          </div>
        )}

        {/* Timestamp for own messages */}
        {showHeader && message.isOwn && (
          <div className="mb-1 flex items-center justify-end gap-2">
            <span className="text-[11px] tabular-nums text-zinc-400">{time}</span>
            <span className="text-[13px] font-medium text-zinc-500">
              {displayName}
            </span>
          </div>
        )}

        {/* Bubble — sent: AAC blue; inbound: white + hairline border */}
        <div
          className={cn(
          "w-full rounded-2xl px-3.5 py-2 whitespace-pre-wrap break-words text-[14px] leading-[1.65] shadow-none",
          message.isOwn ? "bg-[#0E56F5] text-white" : "border border-neutral-200 bg-white text-zinc-800",
          !message.isOwn && showHeader && "ml-[46px]",
          !message.isOwn && !showHeader && "ml-[46px]"
        )}>
          {message.body}
        </div>
      </div>
    </div>
  );
}

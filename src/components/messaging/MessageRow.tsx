import { cn } from "@/lib/utils";
import { UserAvatar } from "./UserAvatar";
import { MessageAttachments } from "./MessageAttachments";
import type { MessageAttachment } from "@/lib/messageAttachments";

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
    attachments?: MessageAttachment[];
  };
  showHeader: boolean;
}

export function MessageRow({ message, showHeader }: MessageRowProps) {
  const time = formatMessageTime(message.createdAt);
  const displayName = message.isOwn ? "Me" : message.senderName;
  const attachments = message.attachments ?? [];
  const hasBody = message.body.trim().length > 0;

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

        {attachments.length > 0 && (
          <div className={cn("mb-1 w-full", !message.isOwn && "ml-[46px]")}>
            <MessageAttachments attachments={attachments} isOwn={message.isOwn} />
          </div>
        )}

        {/* Bubble — sent: AAC blue; inbound: white + hairline border */}
        {hasBody && (
        <div
          className={cn(
          "w-full rounded-2xl px-3.5 py-2 whitespace-pre-wrap break-words text-[14px] leading-[1.65] shadow-none",
          message.isOwn ? "bg-[#0E56F5] text-white" : "border border-neutral-200 bg-white text-zinc-800",
          !message.isOwn && showHeader && "ml-[46px]",
          !message.isOwn && !showHeader && "ml-[46px]"
        )}>
          {message.body}
        </div>
        )}
      </div>
    </div>
  );
}

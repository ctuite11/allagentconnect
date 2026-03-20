import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./UserAvatar";

interface MessageRowProps {
  message: {
    id: string;
    senderId: string;
    senderName: string;
    senderHeadshotUrl?: string | null;
    body: string;
    createdAt: string;
    isOwn: boolean;
  };
  showHeader: boolean;
}

export function MessageRow({ message, showHeader }: MessageRowProps) {
  const time = format(new Date(message.createdAt), "HH:mm");
  const displayName = message.isOwn ? "Me" : message.senderName;

  return (
    <div className={cn(
      "flex",
      message.isOwn ? "justify-end" : "justify-start",
      showHeader ? "mt-6 first:mt-0" : "mt-1.5"
    )}>
      <div className={cn("max-w-[60%]", message.isOwn ? "items-end" : "items-start")}>
        {/* Header: avatar + name + time (incoming only) */}
        {showHeader && !message.isOwn && (
          <div className="flex items-center gap-2.5 mb-1.5">
            <UserAvatar
              name={displayName}
              headshotUrl={message.senderHeadshotUrl ?? null}
              size="lg"
            />
            <span className="text-[13px] font-medium text-zinc-900">
              {displayName}
            </span>
            <span className="text-[11px] text-zinc-400 tabular-nums">{time}</span>
          </div>
        )}

        {/* Timestamp for own messages */}
        {showHeader && message.isOwn && (
          <div className="flex items-center justify-end gap-2 mb-1.5">
            <span className="text-[11px] text-zinc-400 tabular-nums">{time}</span>
            <span className="text-[13px] font-medium text-primary">
              {displayName}
            </span>
          </div>
        )}

        {/* Bubble */}
        <div className={cn(
          "rounded-2xl px-4 py-3 whitespace-pre-wrap break-words text-[14px] leading-[1.65]",
          message.isOwn
            ? "bg-primary text-white"
            : "bg-white border border-zinc-200 text-zinc-800",
          !message.isOwn && showHeader && "ml-[46px]",
          !message.isOwn && !showHeader && "ml-[46px]"
        )}>
          {message.body}
        </div>
      </div>
    </div>
  );
}

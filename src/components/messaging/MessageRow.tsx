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
    <div className={cn(showHeader ? "mt-7 first:mt-0" : "mt-1.5")}>
      {showHeader && (
        <div className="flex items-center gap-2.5 mb-1">
          <UserAvatar
            name={displayName}
            headshotUrl={message.senderHeadshotUrl ?? null}
            size="sm"
          />
          <span className={cn(
            "text-[13px] font-semibold tracking-[-0.01em]",
            message.isOwn ? "text-primary" : "text-zinc-900"
          )}>
            {displayName}
          </span>
          <span className="text-[11px] text-zinc-400 tabular-nums">{time}</span>
        </div>
      )}
      <p className={cn(
        "text-[14px] leading-[1.65] text-zinc-600 whitespace-pre-wrap break-words",
        showHeader && "ml-[42px]"
      )}>
        {message.body}
      </p>
    </div>
  );
}

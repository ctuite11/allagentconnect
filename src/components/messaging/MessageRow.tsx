import { formatDistanceToNow, format } from "date-fns";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageRowProps {
  message: {
    id: string;
    senderId: string;
    senderName: string;
    body: string;
    createdAt: string;
    isOwn: boolean;
  };
  showHeader: boolean;
}

export function MessageRow({ message, showHeader }: MessageRowProps) {
  const time = format(new Date(message.createdAt), "h:mm a");

  return (
    <div className={cn("flex gap-3", showHeader ? "mt-5" : "mt-2 pl-[44px]")}>
      {showHeader && (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 max-w-[70%]">
        {showHeader && (
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-foreground">{message.senderName}</span>
            <span className="text-sm text-muted-foreground">{time}</span>
          </div>
        )}
        <p className="text-[15px] leading-7 text-zinc-700 whitespace-pre-wrap break-words">
          {message.body}
        </p>
      </div>
    </div>
  );
}

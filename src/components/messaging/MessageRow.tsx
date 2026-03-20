import { format } from "date-fns";
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
  const time = format(new Date(message.createdAt), "HH:mm");

  return (
    <div className={cn("flex gap-3", showHeader ? "mt-6" : "mt-1 pl-[48px]")}>
      {showHeader && (
        <div className="w-9 h-9 rounded-full bg-zinc-200 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="w-4 h-4 text-zinc-500" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        {showHeader && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-sm font-semibold text-zinc-900">{message.senderName}</span>
            <span className="text-xs text-zinc-400">{time}</span>
          </div>
        )}
        <p className="text-[15px] leading-relaxed text-zinc-700 whitespace-pre-wrap break-words">
          {message.body}
        </p>
      </div>
    </div>
  );
}

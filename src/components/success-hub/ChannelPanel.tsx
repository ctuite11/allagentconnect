import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, Bell, Send } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChannelPanelProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  isReceiving: boolean;
  onToggleReceive: () => void;
  onSend: () => void;
}

export const ChannelPanel = ({
  icon,
  title,
  subtitle,
  isReceiving,
  onToggleReceive,
  onSend,
}: ChannelPanelProps) => {
  return (
    <div
      className={cn(
        "relative bg-white rounded-2xl border border-neutral-200 p-5",
        "aac-card",
        "transition-all duration-200"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          "bg-muted border border-border"
        )}>
          <div className="text-primary">{icon}</div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-semibold text-foreground mb-0.5">{title}</h4>
          <p className="text-xs text-muted-foreground line-clamp-2">{subtitle}</p>
        </div>
      </div>

      {/* Toggle Buttons */}
      <div className="flex items-center gap-3 mt-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onSend}
              className={cn(
                "flex-1 h-9 text-xs font-medium border-2",
                "border-border text-foreground",
                "hover:border-border hover:bg-muted",
                "transition-all duration-200"
              )}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Send
            </Button>
          </TooltipTrigger>
          <TooltipContent>Send a message to this channel</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleReceive}
              className={cn(
                "flex-1 h-9 text-xs font-medium border-2 transition-all duration-200",
                isReceiving
                  ? "bg-primary border-primary text-primary-foreground hover:bg-primary/90 hover:border-primary"
                  : "border-muted text-muted-foreground hover:border-primary hover:text-foreground"
              )}
            >
              {isReceiving ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Receiving
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5 mr-1.5" />
                  Enable
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isReceiving ? "✓ Receiving Notifications" : "Click to enable receiving"}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

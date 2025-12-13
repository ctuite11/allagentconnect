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
  accentColor?: string;
}

export const ChannelPanel = ({
  icon,
  title,
  subtitle,
  isReceiving,
  onToggleReceive,
  onSend,
  accentColor = "primary",
}: ChannelPanelProps) => {
  const colorClasses: Record<string, { border: string; bg: string }> = {
    primary: { border: "border-l-primary", bg: "bg-primary" },
    accent: { border: "border-l-accent", bg: "bg-accent" },
    purple: { border: "border-l-purple-500", bg: "bg-purple-500" },
    red: { border: "border-l-red-500", bg: "bg-red-500" },
  };

  const colors = colorClasses[accentColor] || colorClasses.primary;

  return (
    <div
      className={cn(
        "relative bg-card rounded-[10px] border-l-4 border border-border p-5",
        "shadow-custom-sm hover:shadow-custom-md",
        "transition-all duration-200",
        colors.border
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

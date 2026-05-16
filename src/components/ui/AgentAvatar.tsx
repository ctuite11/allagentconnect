import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAgentLastSeen } from "@/hooks/useAgentLastSeen";
import { cn } from "@/lib/utils";
import AACMonogram from "@/components/ui/AACMonogram";

interface AgentAvatarProps {
  name: string;
  headshotUrl: string | null;
  userId?: string;
  isOnline?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showPresence?: boolean;
  /** Extra classes for the Avatar primitive itself */
  avatarClassName?: string;
  /** Extra classes for the AvatarFallback */
  fallbackClassName?: string;
  /**
   * When provided, the fallback renders these initials in a neutral bubble
   * instead of the default AAC monogram. Used for buyer avatars in messaging.
   */
  initialsFallback?: { initials: string; className?: string };
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
  xl: "h-16 w-16",
};

const logoSizeClasses = {
  sm: "w-4 h-4",
  md: "w-4 h-4",
  lg: "w-5 h-5",
  xl: "w-8 h-8",
};

const dotSizeClasses = {
  sm: "h-2 w-2 ring-[1.5px]",
  md: "h-2.5 w-2.5 ring-2",
  lg: "h-2.5 w-2.5 ring-2",
  xl: "h-3 w-3 ring-2",
};

export function AgentAvatar({
  name,
  headshotUrl,
  userId,
  isOnline: isOnlineProp,
  size = "md",
  className,
  showPresence = true,
  avatarClassName,
  fallbackClassName,
  initialsFallback,
}: AgentAvatarProps) {
  // Determine online status
  const shouldLookup = showPresence && isOnlineProp === undefined && !!userId;
  const { isOnline: lookedUpOnline } = useAgentLastSeen(shouldLookup ? userId : undefined);

  const online = isOnlineProp !== undefined ? isOnlineProp : lookedUpOnline;
  const showDot = showPresence && online;

  return (
    <div className={cn("relative inline-flex flex-shrink-0", className)}>
      <Avatar className={cn(sizeClasses[size], "flex-shrink-0", avatarClassName)}>
        {headshotUrl && (
          <AvatarImage src={headshotUrl} alt={name} className="object-cover" />
        )}
        {initialsFallback ? (
          <AvatarFallback
            className={cn(
              "text-[11px] font-semibold",
              initialsFallback.className ?? "bg-neutral-200 text-neutral-800",
              fallbackClassName,
            )}
          >
            {initialsFallback.initials}
          </AvatarFallback>
        ) : (
          <AvatarFallback className={cn("bg-primary", fallbackClassName)}>
            <AACMonogram className={cn(logoSizeClasses[size], "text-white")} />
          </AvatarFallback>
        )}
      </Avatar>
      {showDot && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full bg-emerald-500 ring-white",
            dotSizeClasses[size]
          )}
        />
      )}
    </div>
  );
}

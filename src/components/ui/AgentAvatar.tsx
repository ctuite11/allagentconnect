import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAgentLastSeen } from "@/hooks/useAgentLastSeen";
import { cn } from "@/lib/utils";

interface AgentAvatarProps {
  name: string;
  headshotUrl: string | null;
  userId?: string;
  isOnline?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showPresence?: boolean;
  /** Optional custom fallback content (e.g. icon) instead of initials */
  fallbackContent?: React.ReactNode;
  /** Extra classes for the Avatar primitive itself */
  avatarClassName?: string;
  /** Extra classes for the AvatarFallback */
  fallbackClassName?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const sizeClasses = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-9 w-9 text-[12px]",
  lg: "h-10 w-10 text-[13px]",
  xl: "h-16 w-16 text-lg",
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
  fallbackContent,
  avatarClassName,
  fallbackClassName,
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
        <AvatarFallback className={cn("bg-primary text-white font-semibold", fallbackClassName)}>
          {fallbackContent ?? getInitials(name)}
        </AvatarFallback>
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

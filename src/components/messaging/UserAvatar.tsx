import { AgentAvatar } from "@/components/ui/AgentAvatar";
import { cn } from "@/lib/utils";
import { initialsFromDisplayName } from "@/lib/initials";

interface UserAvatarProps {
  name: string;
  headshotUrl: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  userId?: string;
  isOnline?: boolean;
  showPresence?: boolean;
  /** Render neutral initials bubble (BuyerCard style) instead of AAC monogram fallback. */
  isBuyer?: boolean;
}

export function UserAvatar({ name, headshotUrl, size = "md", className, userId, isOnline, showPresence, isBuyer }: UserAvatarProps) {
  return (
    <AgentAvatar
      name={name}
      headshotUrl={headshotUrl}
      size={size}
      className={cn(className)}
      userId={userId}
      isOnline={isOnline}
      showPresence={showPresence}
      initialsFallback={
        isBuyer
          ? { initials: initialsFromDisplayName(name), className: "bg-neutral-200 text-neutral-800" }
          : undefined
      }
    />
  );
}

import { AgentAvatar } from "@/components/ui/AgentAvatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  headshotUrl: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  userId?: string;
  isOnline?: boolean;
  showPresence?: boolean;
}

export function UserAvatar({ name, headshotUrl, size = "md", className, userId, isOnline, showPresence }: UserAvatarProps) {
  return (
    <AgentAvatar
      name={name}
      headshotUrl={headshotUrl}
      size={size}
      className={cn(className)}
      userId={userId}
      isOnline={isOnline}
      showPresence={showPresence}
    />
  );
}

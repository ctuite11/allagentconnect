import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  headshotUrl: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
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
};

export function UserAvatar({ name, headshotUrl, size = "md", className }: UserAvatarProps) {
  return (
    <Avatar className={cn(sizeClasses[size], "flex-shrink-0", className)}>
      {headshotUrl && (
        <AvatarImage src={headshotUrl} alt={name} className="object-cover" />
      )}
      <AvatarFallback className="bg-primary text-white font-semibold">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

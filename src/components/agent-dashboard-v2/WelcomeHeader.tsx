import { AgentAvatar } from "@/components/ui/AgentAvatar";

interface WelcomeHeaderProps {
  firstName: string;
  lastName: string;
  headshotUrl: string | null;
  aacId?: string;
}

export function WelcomeHeader({ firstName, lastName, headshotUrl, aacId }: WelcomeHeaderProps) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "AG";

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-14 w-14 border-2 border-border">
        <AvatarImage src={headshotUrl ?? undefined} alt={`${firstName} ${lastName}`} />
        <AvatarFallback className="bg-muted text-muted-foreground text-lg font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Welcome back, <span className="text-primary">{firstName}</span>.
        </h2>
        {aacId && (
          <p className="text-sm text-muted-foreground">AAC Agent Id: {aacId}</p>
        )}
      </div>
    </div>
  );
}

import { AgentAvatar } from "@/components/ui/AgentAvatar";

interface WelcomeHeaderProps {
  firstName: string;
  lastName: string;
  headshotUrl: string | null;
  aacId?: string;
  userId?: string;
}

export function WelcomeHeader({ firstName, lastName, headshotUrl, aacId, userId }: WelcomeHeaderProps) {
  const fullName = `${firstName} ${lastName}`.trim();

  return (
    <div className="flex items-center gap-4">
      <AgentAvatar
        name={fullName}
        headshotUrl={headshotUrl}
        userId={userId}
        size="xl"
        avatarClassName="h-14 w-14 border-2 border-border"
        fallbackClassName="bg-muted text-muted-foreground"
      />
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

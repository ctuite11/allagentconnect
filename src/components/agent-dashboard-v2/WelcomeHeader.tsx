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
        avatarClassName="h-14 w-14 border-2 border-zinc-100"
        fallbackClassName="border border-zinc-100 bg-white text-zinc-500"
      />
      <div className="min-w-0 space-y-1">
        <p className="text-2xl font-semibold tracking-tight text-neutral-900">
          Welcome back, <span className="text-[#0E56F5]">{firstName}</span>.
        </p>
        {aacId && (
          <p className="text-sm leading-snug text-neutral-500">AAC Agent Id: {aacId}</p>
        )}
      </div>
    </div>
  );
}

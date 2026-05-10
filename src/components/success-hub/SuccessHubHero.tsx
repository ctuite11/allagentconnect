import { AgentAvatar } from "@/components/ui/AgentAvatar";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

type SuccessHubHeroProps = {
  summary: SuccessHubSummary;
};

export function SuccessHubHero({ summary }: SuccessHubHeroProps) {
  const rawFirst = summary.profile?.first_name?.trim();
  const displayFirst = rawFirst || "there";
  const last = summary.profile?.last_name?.trim() ?? "";
  const fullName =
    [rawFirst || "Agent", last].filter(Boolean).join(" ").trim() || "Agent";
  const aacShort = summary.agentId ? summary.agentId.slice(0, 8) : "";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-5 py-3.5 shadow-sm transition-[box-shadow,border-color] duration-150 hover:border-neutral-300 hover:shadow-md">
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start lg:justify-between lg:gap-5">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-950">
            Hi, {displayFirst}
          </h1>
          <p className="max-w-xl text-xs leading-snug text-neutral-500">
            Manage your buyers, listings, hot sheets, and messages.
          </p>
        </div>

        <div className="flex w-full min-w-0 shrink-0 flex-col gap-2.5 border-t border-zinc-100 pt-3.5 sm:flex-row sm:items-center lg:w-[min(100%,22rem)] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <AgentAvatar
            name={fullName}
            headshotUrl={summary.profile?.headshot_url ?? null}
            userId={summary.agentId}
            size="xl"
            avatarClassName="h-16 w-16 border-2 border-zinc-100"
            fallbackClassName="border border-zinc-100 bg-white text-neutral-500"
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-semibold text-neutral-900">{fullName}</p>
            {summary.profile?.company ? (
              <p className="text-xs text-neutral-500">{summary.profile.company}</p>
            ) : null}
            {summary.profile?.title ? (
              <p className="text-xs text-neutral-500">{summary.profile.title}</p>
            ) : null}
            {aacShort ? (
              <p className="pt-1 font-mono text-[11px] text-neutral-400">AAC-{aacShort}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

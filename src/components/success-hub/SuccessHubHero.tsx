import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/ui/AgentAvatar";
import { Home, MessageSquare, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

type SuccessHubHeroProps = {
  summary: SuccessHubSummary;
};

export function SuccessHubHero({ summary }: SuccessHubHeroProps) {
  const navigate = useNavigate();
  const rawFirst = summary.profile?.first_name?.trim();
  const displayFirst = rawFirst || "there";
  const last = summary.profile?.last_name?.trim() ?? "";
  const fullName =
    [rawFirst || "Agent", last].filter(Boolean).join(" ").trim() || "Agent";
  const aacShort = summary.agentId ? summary.agentId.slice(0, 8) : "";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-5 py-3.5 shadow-sm transition-[box-shadow,border-color] duration-150 hover:border-neutral-300 hover:shadow-md">
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start lg:justify-between lg:gap-5">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-950">
              Hi, {displayFirst}
            </h1>
            <p className="max-w-xl text-sm leading-snug text-neutral-500">
              Manage your buyers, listings, hot sheets, and messages.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="h-9 gap-1.5 rounded-full bg-[#0E56F5] px-4 text-white shadow-sm hover:bg-[#0B46CC]"
              onClick={() => {
                window.location.href = "/agent/listings/new";
              }}
            >
              <Home className="h-4 w-4 shrink-0 text-white" aria-hidden />
              Add listing
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-full border-neutral-200 bg-white px-4 text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50"
              onClick={() => navigate("/success-hub/buyers")}
            >
              <UserPlus className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              Add buyer
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-full border-neutral-200 bg-white px-4 text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50"
              onClick={() => navigate("/messages")}
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-[#0E56F5]" aria-hidden />
              Messages
            </Button>
          </div>
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

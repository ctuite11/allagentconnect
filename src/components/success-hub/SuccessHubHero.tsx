import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/ui/AgentAvatar";
import { AacTitleAccent } from "@/components/layout/AacTitleAccent";
import { Home, MessageSquare, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
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
    <div className="rounded-xl border border-neutral-200 bg-white px-6 py-5 shadow-sm transition-[box-shadow,border-color] duration-150 hover:border-neutral-300 hover:shadow-md sm:py-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl">
              Success Hub
            </h1>
            <AacTitleAccent />
            <p className="mt-2 text-[13px] font-medium text-neutral-600">
              Hi, {displayFirst}
            </p>
            <p className="mt-1.5 max-w-xl text-xs leading-snug text-neutral-500">
              Manage your buyers, listings, hot sheets, and messages.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1 rounded-lg bg-[#0E56F5] px-3 text-[13px] font-medium text-white shadow-sm hover:bg-[#0B46CC]"
              onClick={() =>
                navigate(ROUTES.ADD_LISTING, { state: { from: ROUTES.SUCCESS_HUB_RETURN } })
              }
            >
              <Home className="h-3.5 w-3.5 shrink-0 text-white" aria-hidden />
              Add listing
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 rounded-lg border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50"
              onClick={() => navigate("/agent/buyers")}
            >
              <UserPlus className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              Add buyer
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 rounded-lg border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50"
              onClick={() => navigate("/messages")}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[#0E56F5]" aria-hidden />
              Messages
            </Button>
          </div>
        </div>

        <div className="flex w-full min-w-0 shrink-0 flex-row items-center gap-4 lg:w-[min(100%,22rem)]">
          <AgentAvatar
            name={fullName}
            headshotUrl={summary.profile?.headshot_url ?? null}
            userId={summary.agentId}
            size="xl"
            avatarClassName="h-14 w-14 border-2 border-zinc-100"
            fallbackClassName="border border-zinc-100 bg-white text-neutral-500"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold text-neutral-900">{fullName}</p>
            {summary.profile?.company ? (
              <p className="text-xs text-neutral-500">{summary.profile.company}</p>
            ) : null}
            {summary.profile?.title ? (
              <p className="text-xs text-neutral-500">{summary.profile.title}</p>
            ) : null}
            {aacShort ? (
              <p className="font-mono text-[11px] text-neutral-400">AAC-{aacShort}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

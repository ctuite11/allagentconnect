import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/ui/AgentAvatar";
import { Home, MessageSquare, UserPlus } from "lucide-react";
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
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-none">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Hi, {displayFirst}
            </h1>
            <p className="max-w-xl text-xs leading-snug text-neutral-500">
              Manage your buyers, listings, hot sheets, and messages.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="h-9 rounded-full bg-[#0E56F5] px-4 text-white hover:bg-[#0B46CC]"
              onClick={() => {
                window.location.href = "/agent/listings/new";
              }}
            >
              <Home className="mr-2 h-4 w-4" />
              Add Listing
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-full border-zinc-200 bg-white px-4 text-neutral-800 hover:bg-neutral-50"
              onClick={() => navigate("/success-hub/buyers")}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Buyer
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-full border-zinc-200 bg-white px-4 text-neutral-800 hover:bg-neutral-50"
              onClick={() => navigate("/messages")}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Messages
            </Button>
          </div>
        </div>

        <div className="flex w-full min-w-0 shrink-0 flex-col gap-3 border-t border-zinc-100 pt-5 sm:flex-row sm:items-center lg:w-[min(100%,22rem)] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
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

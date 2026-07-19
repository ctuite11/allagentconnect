import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { NetworkActivityCard } from "./NetworkActivityCard";
import { ActivityAgentContact } from "./ActivityAgentContact";
import type { ChannelPreviewItem } from "./useChannelPreviews";

type ChannelPreviewCardProps = {
  title: string;
  description?: string;
  icon: ReactNode;
  viewAllTo: string;
  items: ChannelPreviewItem[];
  loading: boolean;
  emptyLabel?: string;
  onCreate?: () => void;
};

/**
 * Compact preview of a single Communications Center channel.
 * Renders at most 2 items + a "View all →" link to /communications filtered
 * to this channel. The content area keeps a consistent minimum height so all
 * four channel cards stay uniform regardless of how much activity they have.
 */
const MAX_PREVIEW_ITEMS = 2;

export function ChannelPreviewCard({
  title,
  description,
  icon,
  viewAllTo,
  items,
  loading,
  emptyLabel = "No recent activity",
  onCreate,
}: ChannelPreviewCardProps) {
  return (
    <NetworkActivityCard
      className="h-full"
      title={title}
      description={description}
      icon={icon}
      action={
        <div className="flex shrink-0 items-center gap-3">
          <Link
            to={viewAllTo}
            className="inline-flex items-center rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            View all
          </Link>
          {onCreate ? (
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center gap-1 rounded-sm text-[12px] font-medium text-neutral-700 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2"
            >
              <Plus className="h-3 w-3" />
              Create new
            </button>
          ) : null}
        </div>
      }
    >
      <div className="min-h-[176px]">
      {loading ? (
        <ul className="divide-y divide-neutral-100">
          {[0, 1].map((i) => (
            <li key={i} className="py-2.5 first:pt-0 last:pb-0">
              <div className="h-3 w-1/2 rounded bg-neutral-100" />
              <div className="mt-1.5 h-2.5 w-1/3 rounded bg-neutral-100" />
              <div className="mt-1.5 h-2.5 w-2/3 rounded bg-neutral-100" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="py-2 text-xs text-neutral-500">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.slice(0, MAX_PREVIEW_ITEMS).map((item) => (
            <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                {item.subtitle ? (
                  <p className="line-clamp-2 text-[13px] leading-snug text-neutral-800">
                    {item.subtitle}
                  </p>
                ) : item.title && item.title !== title ? (
                  <p className="line-clamp-1 text-[13px] font-semibold leading-snug text-neutral-900">
                    {item.title}
                  </p>
                ) : (
                  <span className="text-[13px] text-neutral-500">New message</span>
                )}
                <span className="shrink-0 text-[11px] font-medium text-neutral-400">
                  {item.timestamp}
                </span>
              </div>
              {item.agent ? (
                <ActivityAgentContact
                  agentId={item.agent.id}
                  agentName={item.agent.name}
                  agentEmail={item.agent.email}
                  agentPhone={item.agent.phone}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      </div>
    </NetworkActivityCard>
  );
}
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
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
};

/**
 * Compact preview of a single Communications Center channel.
 * Renders at most 3 items + a "View all →" link to /communications filtered to this channel.
 */
export function ChannelPreviewCard({
  title,
  description,
  icon,
  viewAllTo,
  items,
  loading,
  emptyLabel = "No recent activity",
}: ChannelPreviewCardProps) {
  return (
    <NetworkActivityCard
      title={title}
      description={description}
      icon={icon}
      action={
        <Link
          to={viewAllTo}
          className="shrink-0 rounded-sm text-[12px] font-medium text-neutral-700 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2"
        >
          View all →
        </Link>
      }
    >
      {loading ? (
        <ul className="divide-y divide-neutral-100">
          {[0, 1, 2].map((i) => (
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
          {items.slice(0, 3).map((item) => (
            <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-1 text-[13px] font-semibold leading-snug text-neutral-900">
                  {item.title}
                </p>
                <span className="shrink-0 text-[11px] font-medium text-neutral-400">
                  {item.timestamp}
                </span>
              </div>
              {item.subtitle ? (
                <p className="mt-0.5 line-clamp-1 text-xs text-neutral-600">{item.subtitle}</p>
              ) : null}
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
    </NetworkActivityCard>
  );
}
import { cn } from "@/lib/utils";

type AgentOnlinePresenceBadgeProps = {
  className?: string;
};

/**
 * AAC premium inline Online pill — typography row only (not on avatars/photos).
 * Matches Buyer Account / ClientDashboardView agent presence treatment.
 */
export function AgentOnlinePresenceBadge({ className }: AgentOnlinePresenceBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5",
        className,
      )}
      title="Online"
      aria-label="Online"
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100"
        aria-hidden
      />
      <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-700">Online</span>
    </span>
  );
}

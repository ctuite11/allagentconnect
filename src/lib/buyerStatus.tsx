import { cn } from "@/lib/utils";

export type BuyerStatus =
  | "active"
  | "invite_pending"
  | "inactive"
  | "closed"
  | "archived";

export interface BuyerStatusInput {
  /** Auth user id linked to the CRM client (set once invite is accepted). */
  agent_user_id?: string | null;
  /** Relationship row status: active, ended, invited, closed, archived, etc. */
  relationship_status?: string | null;
  /** Timestamp when the relationship ended (if any). */
  relationship_ended_at?: string | null;
}

/**
 * Single source of truth for buyer status across the app.
 * Used by My Buyers cards, Buyer detail header, filters, and counts.
 */
export function getBuyerStatus(input: BuyerStatusInput): BuyerStatus {
  const rel = (input.relationship_status ?? "").toLowerCase();

  if (rel === "archived") return "archived";
  if (rel === "closed") return "closed";

  // Invite accepted → buyer has a linked auth account
  if (input.agent_user_id) return "active";

  // Relationship exists but no auth account yet → awaiting acceptance
  if (rel === "active" || rel === "invited" || rel === "pending") {
    return "invite_pending";
  }

  if (input.relationship_ended_at || rel === "ended") return "inactive";

  // Default fallback
  return "invite_pending";
}

export const BUYER_STATUS_CONFIG: Record<
  BuyerStatus,
  { label: string; pillClass: string; dotClass: string }
> = {
  active: {
    label: "Active",
    pillClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  invite_pending: {
    label: "Invite Pending",
    pillClass: "bg-amber-50 text-amber-700 border-amber-200",
    dotClass: "bg-amber-500",
  },
  inactive: {
    label: "Inactive",
    pillClass: "bg-zinc-100 text-zinc-600 border-zinc-200",
    dotClass: "bg-zinc-400",
  },
  closed: {
    label: "Closed",
    pillClass: "bg-blue-50 text-blue-700 border-blue-200",
    dotClass: "bg-blue-500",
  },
  archived: {
    label: "Archived",
    pillClass: "bg-zinc-100 text-zinc-500 border-zinc-200",
    dotClass: "bg-zinc-400",
  },
};

export const BUYER_STATUS_ORDER: BuyerStatus[] = [
  "active",
  "invite_pending",
  "inactive",
  "closed",
  "archived",
];

interface BuyerStatusBadgeProps {
  status: BuyerStatus;
  className?: string;
}

export function BuyerStatusBadge({ status, className }: BuyerStatusBadgeProps) {
  const cfg = BUYER_STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap",
        cfg.pillClass,
        className,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dotClass)} />
      {cfg.label}
    </span>
  );
}

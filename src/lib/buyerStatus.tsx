import { cn } from "@/lib/utils";

export type BuyerStatus = "active" | "pending_invite";

export interface BuyerStatusInput {
  /** Auth user id linked to the CRM client (set once invite is accepted). */
  agent_user_id?: string | null;
  /** @deprecated kept for call-site compatibility — no longer drives derivation. */
  relationship_status?: string | null;
  /** @deprecated kept for call-site compatibility — no longer drives derivation. */
  relationship_ended_at?: string | null;
}

/**
 * Buyer-client state is system-derived only.
 *  - `active`         → buyer has accepted the invite (auth account linked)
 *  - `pending_invite` → invite sent but not yet accepted
 *
 * There are no manual lifecycle statuses. Removing a buyer client is a
 * separate destructive action that ends the relationship row; removed
 * buyers are excluded from My Buyers entirely (they don't show a status).
 */
export function getBuyerStatus(input: BuyerStatusInput): BuyerStatus {
  return input.agent_user_id ? "active" : "pending_invite";
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
  pending_invite: {
    label: "Pending Invite",
    pillClass: "bg-amber-50 text-amber-700 border-amber-200",
    dotClass: "bg-amber-500",
  },
};

export const BUYER_STATUS_ORDER: BuyerStatus[] = ["active", "pending_invite"];

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

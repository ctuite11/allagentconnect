import { cn } from "@/lib/utils";

export type BuyerStatus = "active" | "pending_invite";

export interface BuyerStatusInput {
  /**
   * Authoritative: the auth.users.id stored on client_agent_relationships.client_id.
   * Populated only after the buyer accepts the invite and an auth account is linked.
   */
  relationship_client_id?: string | null;
  /** Relationship lifecycle status (active / pending / ended / etc.). */
  relationship_status?: string | null;
  /** Set when the relationship has been terminated. */
  relationship_ended_at?: string | null;

  /**
   * @deprecated Legacy CRM-side flag — kept ONLY so older call sites compile.
   * Do not rely on this for new code. Real status is driven by relationship_client_id.
   */
  agent_user_id?: string | null;
}

/**
 * Buyer-client state is system-derived only.
 *
 *  - `active`         → relationship row has a real auth user bound
 *                       (relationship_client_id IS NOT NULL),
 *                       status is live ("active"), and not ended.
 *  - `pending_invite` → no auth account linked yet, regardless of whether
 *                       an invite email has been sent.
 *
 * NOTE: `clients.agent_user_id` (the CRM-side flag) is NOT authoritative and
 * must not be used to mark a buyer Active. A buyer is Active only when the
 * relationship row carries a real auth user id.
 */
export function getBuyerStatus(input: BuyerStatusInput): BuyerStatus {
  const hasAuthUser = !!input.relationship_client_id;
  const status = (input.relationship_status ?? "").toLowerCase();
  const ended = !!input.relationship_ended_at;

  if (hasAuthUser && !ended && (status === "" || status === "active")) {
    return "active";
  }

  // Legacy fallback: some older call sites still pass only agent_user_id.
  // Treat presence of agent_user_id WITHOUT relationship context as pending —
  // the CRM flag alone is no longer sufficient to mark Active.
  return "pending_invite";
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

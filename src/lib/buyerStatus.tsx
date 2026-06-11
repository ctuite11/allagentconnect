import { cn } from "@/lib/utils";

export type BuyerStatus = "active" | "pending_invite";

export interface BuyerStatusInput {
  /**
   * Auth `users.id` on `client_agent_relationships.client_id` — set after invite acceptance.
   */
  relationship_client_id?: string | null;
  /** Relationship lifecycle (`active` / `pending` / etc.). */
  relationship_status?: string | null;
  /** Set when the relationship has been terminated. */
  relationship_ended_at?: string | null;
  /**
   * CRM `clients.id` has at least one accepted `share_tokens` row
   * (`accepted_at` populated) for this buyer.
   */
  invite_accepted_for_client?: boolean;

  /**
   * @deprecated Legacy CRM-side flag — kept ONLY so older call sites compile.
   */
  agent_user_id?: string | null;
}

/**
 * Precedence (highest wins):
 * 1. Active relationship (`status = active`, not ended)
 * 2. Auth user linked on relationship (`client_id` populated)
 * 3. Accepted invite for CRM client (`share_tokens.accepted_at`)
 * 4. Otherwise → pending invite
 *
 * Stale unaccepted invite tokens must never override 1–3.
 */
export function isActiveBuyerRelationship(input: BuyerStatusInput): boolean {
  if (input.relationship_ended_at) return false;

  const status = (input.relationship_status ?? "").toLowerCase();
  if (status === "active") return true;
  if (input.relationship_client_id) return true;
  if (input.invite_accepted_for_client) return true;

  return false;
}

/** AAC buyer workspace linked — auth account bound on the relationship row. */
export function isBuyerWorkspaceLinked(input: BuyerStatusInput): boolean {
  if (input.relationship_ended_at) return false;
  return !!input.relationship_client_id;
}

export function getBuyerStatus(input: BuyerStatusInput): BuyerStatus {
  if (isActiveBuyerRelationship(input)) return "active";
  return "pending_invite";
}

/** `BuyersList` / Success Hub row status. */
export function getBuyerListStatus(input: BuyerStatusInput): "active" | "pending" {
  return getBuyerStatus(input) === "active" ? "active" : "pending";
}

export function buildBuyerStatusInput(
  relationship: {
    client_id?: string | null;
    status?: string | null;
    ended_at?: string | null;
  },
  opts?: { inviteAcceptedForClient?: boolean },
): BuyerStatusInput {
  return {
    relationship_client_id: relationship.client_id,
    relationship_status: relationship.status,
    relationship_ended_at: relationship.ended_at,
    invite_accepted_for_client: opts?.inviteAcceptedForClient ?? false,
  };
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

import { CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type BuyerRowStatusInput = {
  status: string;
  /** AAC buyer account linked (shared workspace / “in search”). */
  buyerWorkspaceLinked: boolean;
};

export function BuyerRowStatusPill({ buyer }: { buyer: BuyerRowStatusInput }) {
  const shell =
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium";
  if (buyer.status === "pending") {
    return (
      <span className={cn(shell, "border-neutral-200 bg-neutral-50 text-neutral-800")}>
        <Clock className="h-3 w-3 shrink-0 text-neutral-500" strokeWidth={2} aria-hidden />
        Pending Invite
      </span>
    );
  }
  if (buyer.buyerWorkspaceLinked) {
    return (
      <span className={cn(shell, "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#15803D]")}>
        <CheckCircle2 className="h-3 w-3 shrink-0 text-[#22C55E]" strokeWidth={2} aria-hidden />
        Searching
      </span>
    );
  }
  return (
    <span className={cn(shell, "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#15803D]")}>
      <CheckCircle2 className="h-3 w-3 shrink-0 text-[#22C55E]" strokeWidth={2} aria-hidden />
      Searching
    </span>
  );
}

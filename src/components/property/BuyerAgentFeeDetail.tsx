import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DollarSign, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ListingCommissionFields = {
  commission_rate?: number | null;
  commission_type?: string | null;
  commission_notes?: string | null;
};

export function formatBuyerAgentFeeDisplay(
  listing: ListingCommissionFields,
): string | null {
  if (!listing?.commission_rate) return null;
  if (listing.commission_type === "percentage") {
    return `${listing.commission_rate}%`;
  }
  return `$${listing.commission_rate.toLocaleString()}`;
}

interface BuyerAgentFeeDetailProps {
  feeDisplay: string;
  commissionNotes?: string | null;
  className?: string;
}

/**
 * Right-rail buyer agent fee block — premium, scannable layout for listing detail pages.
 */
export function BuyerAgentFeeDetail({
  feeDisplay,
  commissionNotes,
  className,
}: BuyerAgentFeeDetailProps) {
  return (
    <Card className={cn("rounded-2xl border border-neutral-200 bg-white shadow-sm", className)}>
      <CardContent className="px-3.5 py-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-neon-green">Buyer Agent Fee</p>
            <p className="mt-1 text-lg font-semibold leading-tight tracking-tight text-neutral-900">
              {feeDisplay}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">Paid by Seller</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="About buyer agent fee"
                className="shrink-0 rounded-md p-0.5 text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300/50"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md border-neutral-200 bg-white">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-neutral-900">
                  <DollarSign className="h-5 w-5 text-neutral-600" />
                  Buyer Agent Fee
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-4 text-sm text-neutral-600">
                <p>
                  This compensation is{" "}
                  <strong className="text-neutral-900">paid by the seller</strong> and offered to
                  buyer agents who bring qualified buyers.
                </p>
                <p>
                  <strong className="text-neutral-900">Is this negotiable?</strong>
                  <br />
                  Yes, compensation terms may be negotiable. Discuss with the listing agent for
                  details.
                </p>
                <p>
                  <strong className="text-neutral-900">Note:</strong> Actual compensation may vary
                  based on your buyer representation agreement. Ask your agent about their fee
                  structure.
                </p>
                {commissionNotes && (
                  <p className="rounded-md border border-neutral-200 bg-neutral-50 p-2 text-neutral-800">
                    <strong className="text-neutral-900">Notes:</strong> {commissionNotes}
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

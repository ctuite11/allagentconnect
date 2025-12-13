import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, DollarSign, Users, FileText, CheckCircle } from "lucide-react";

interface BuyerCompensationInfoModalProps {
  compensationDisplay: string;
}

export const BuyerCompensationInfoModal = ({ compensationDisplay }: BuyerCompensationInfoModalProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground">
          <HelpCircle className="w-3.5 h-3.5" />
          Learn more
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Understanding Buyer Agent Compensation
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-5 py-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">What is a Buyer's Agent?</h4>
              <p className="text-sm text-muted-foreground mt-1">
                A buyer's agent is a licensed real estate professional who represents your interests
                when purchasing a property. They help you find homes, negotiate offers, and guide you
                through the closing process.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">This Listing Offers: {compensationDisplay}</h4>
              <p className="text-sm text-muted-foreground mt-1">
                The listing brokerage is offering this compensation to buyer's agents who bring a
                successful buyer. This amount is typically paid at closing from the transaction proceeds.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
              <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">Your Agreement Matters</h4>
              <p className="text-sm text-muted-foreground mt-1">
                You may have a separate agreement with your buyer's agent that outlines their
                compensation. The amount offered by this listing may differ from your agreement.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">Transparency is Key</h4>
              <p className="text-sm text-muted-foreground mt-1">
                We believe in full transparency. Always discuss compensation with your agent
                before making an offer to understand how they will be paid.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

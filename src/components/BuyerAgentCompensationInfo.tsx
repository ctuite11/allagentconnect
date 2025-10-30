import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

const BuyerAgentCompensationInfo = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Info className="h-4 w-4" />
          What is this?
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Buyer Agent Compensation</DialogTitle>
          <DialogDescription className="pt-4 space-y-4 text-left">
            <p className="text-base">
              <strong>Buyer Agent Compensation</strong> is the amount or percentage that the listing agent offers to cooperating buyer agents who bring qualified buyers to the property.
            </p>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">How it works:</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>The seller typically pays both the listing agent's commission and the buyer agent's compensation</li>
                <li>This compensation is negotiable and varies by property and market</li>
                <li>It can be structured as a percentage of the sale price or a flat fee</li>
                <li>Buyer agents represent the interests of the buyer in the transaction</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Types of compensation:</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>Percentage:</strong> A percentage of the final sale price (e.g., 2.5%)</li>
                <li><strong>Flat Fee:</strong> A fixed dollar amount regardless of sale price</li>
                <li><strong>Variable:</strong> May vary based on specific terms or conditions</li>
              </ul>
            </div>

            <p className="text-sm text-muted-foreground italic">
              Note: Buyer agent compensation is offered by the seller/listing agent and is typically paid at closing from the sale proceeds.
            </p>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};

export default BuyerAgentCompensationInfo;

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Clock, Zap, Lock } from "lucide-react";
import { toast } from "sonner";
import type { OffMarketListing } from "@/pages/OffMarketDashboard";

interface ChangeStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: OffMarketListing;
  onStatusChanged: () => void;
}

type NewStatus = "coming_soon" | "new";

export function ChangeStatusDialog({
  open,
  onOpenChange,
  listing,
  onStatusChanged,
}: ChangeStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<NewStatus>("coming_soon");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      const { error } = await supabase
        .from("listings")
        .update({
          status: selectedStatus,
          listing_type: "for_sale", // Change from private to for_sale
        })
        .eq("id", listing.id);

      if (error) throw error;

      onStatusChanged();
    } catch (error) {
      console.error("Error updating listing status:", error);
      toast.error("Failed to update listing status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            Change Listing Status
          </DialogTitle>
          <DialogDescription>
            Transition this off-market listing to a public status.
          </DialogDescription>
        </DialogHeader>

        {/* Listing Summary */}
        <div className="p-3 bg-muted rounded-lg">
          <p className="font-medium text-sm">{listing.address}</p>
          <p className="text-xs text-muted-foreground">
            {listing.city}, {listing.state} • {formatPrice(listing.price)}
          </p>
        </div>

        {/* Status Options */}
        <RadioGroup
          value={selectedStatus}
          onValueChange={(v) => setSelectedStatus(v as NewStatus)}
          className="space-y-3"
        >
          <div className="flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="coming_soon" id="coming_soon" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="coming_soon" className="flex items-center gap-2 cursor-pointer">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Coming Soon</span>
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Visible to agents but not yet active on market. Good for building buzz.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="new" id="new" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="new" className="flex items-center gap-2 cursor-pointer">
                <Zap className="h-4 w-4 text-green-500" />
                <span className="font-medium">New (Active)</span>
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Immediately active and visible to all users. Ready to receive offers.
              </p>
            </div>
          </div>
        </RadioGroup>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600"
          >
            {isSubmitting ? "Updating..." : "Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

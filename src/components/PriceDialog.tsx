import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AgentListing } from "@/pages/AgentListingsPage";

interface ListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: AgentListing | null;
  onSaved?: () => void;
}

/**
 * Simple dialog to change list price on a listing.
 * Supabase update should be wired in by the dev where indicated.
 */
export function PriceDialog({
  open,
  onOpenChange,
  listing,
  onSaved,
}: ListingDialogProps) {
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (listing) {
      setPrice(listing.listPrice.toString());
    }
  }, [listing]);

  const handleSave = async () => {
    if (!listing) return;
    const nextPrice = Number(price.replace(/,/g, ""));
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) return;

    try {
      setSaving(true);

      // TODO: Supabase update for list_price goes here.
      // Example (pseudo):
      //
      // const supabase = createClient();
      // await supabase
      //   .from("listings")
      //   .update({ list_price: nextPrice })
      //   .eq("id", listing.id);
      //
      // Then revalidate or refetch the listings.

      if (onSaved) onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const formattedAddress = listing
    ? `${listing.addressLine1}, ${listing.city}, ${listing.state} ${listing.zip}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change List Price</DialogTitle>
          {listing && (
            <DialogDescription>
              {formattedAddress}
              {listing.mlsNumber && (
                <>
                  <br />
                  MLS #: {listing.mlsNumber}
                </>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium">New List Price ($)</label>
          <Input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !price}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AgentListing } from "@/pages/AgentListingsPage";

interface ListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: AgentListing | null;
  onSaved?: () => void;
}

/**
 * Dialog to add a simple open house for a listing.
 * Stores date, start time, end time, type, and comments.
 */
export function OpenHouseDialog({
  open,
  onOpenChange,
  listing,
  onSaved,
}: ListingDialogProps) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [eventType, setEventType] = useState<"in_person" | "virtual">(
    "in_person",
  );
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // reset when opened
      setDate("");
      setStartTime("");
      setEndTime("");
      setEventType("in_person");
      setComments("");
    }
  }, [open]);

  const canSave = !!date && !!startTime && !!endTime && !!listing;

  const handleSave = async () => {
    if (!canSave || !listing) return;

    try {
      setSaving(true);

      // TODO: Supabase insert goes here.
      // Example (pseudo):
      //
      // const supabase = createClient();
      // await supabase.from("open_houses").insert({
      //   listing_id: listing.id,
      //   date,
      //   start_time: startTime,
      //   end_time: endTime,
      //   event_type: eventType,
      //   comments,
      // });
      //
      // Then refetch open houses if needed.

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Open House</DialogTitle>
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

        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Event Type</label>
            <Select
              value={eventType}
              onValueChange={(val) =>
                setEventType(val as "in_person" | "virtual")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">In-Person</SelectItem>
                <SelectItem value="virtual">Virtual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Start Time</label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">End Time</label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">
            Comments <span className="text-xs text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="e.g. Masks required, park on side street, offer deadline details…"
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
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

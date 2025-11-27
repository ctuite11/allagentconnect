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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    zip: string;
    mlsNumber?: string;
  } | null;
  onSaved?: () => void;
  eventTypePreset?: "in_person" | "virtual" | "broker_tour";
}

/**
 * Dialog to add a simple open house or broker tour for a listing.
 * Stores date, start time, end time, type, and comments.
 */
export function OpenHouseDialog({
  open,
  onOpenChange,
  listing,
  onSaved,
  eventTypePreset,
}: ListingDialogProps) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [eventType, setEventType] = useState<"in_person" | "virtual" | "broker_tour">(
    eventTypePreset || "in_person",
  );
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // reset when opened
      setDate("");
      setStartTime("");
      setEndTime("");
      setEventType(eventTypePreset || "in_person");
      setComments("");
    }
  }, [open, eventTypePreset]);

  const canSave = !!date && !!startTime && !!endTime && !!listing;

  const handleSave = async () => {
    if (!canSave || !listing) return;

    try {
      setSaving(true);

      // Fetch current open_houses array
      const { data: currentListing } = await supabase
        .from("listings")
        .select("open_houses")
        .eq("id", listing.id)
        .single();

      const existingOpenHouses = (currentListing?.open_houses as any[]) || [];
      const newOpenHouse = { 
        date, 
        start_time: startTime, 
        end_time: endTime, 
        event_type: eventType, 
        comments 
      };

      // Append new open house to array
      const { error } = await supabase
        .from("listings")
        .update({ open_houses: [...existingOpenHouses, newOpenHouse] })
        .eq("id", listing.id);

      if (error) throw error;

      toast.success(eventType === "broker_tour" ? "Broker tour scheduled!" : "Open house scheduled!");
      if (onSaved) onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving open house:", error);
      toast.error("Failed to schedule");
    } finally {
      setSaving(false);
    }
  };

  const formattedAddress = listing
    ? `${listing.addressLine1}, ${listing.city}, ${listing.state} ${listing.zip}`
    : "";

  const dialogTitle = eventType === "broker_tour" ? "Schedule Broker Tour" : "Add Open House";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
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
                setEventType(val as "in_person" | "virtual" | "broker_tour")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">In-Person</SelectItem>
                <SelectItem value="virtual">Virtual</SelectItem>
                <SelectItem value="broker_tour">Broker Tour</SelectItem>
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

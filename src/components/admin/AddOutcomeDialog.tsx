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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const OUTCOMES = [
  { value: "pending", label: "Pending" },
  { value: "no_response", label: "No Response" },
  { value: "not_a_fit", label: "Not a Fit" },
  { value: "connected", label: "Connected" },
  { value: "showing_scheduled", label: "Showing Scheduled" },
  { value: "offer_submitted", label: "Offer Submitted" },
  { value: "offer_accepted", label: "Offer Accepted" },
  { value: "closed_won", label: "Closed (Won)" },
  { value: "closed_lost", label: "Closed (Lost)" },
  { value: "duplicate", label: "Duplicate" },
  { value: "invalid", label: "Invalid" },
];

interface AddOutcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: {
    id: string;
    latest_outcome: string;
    submission?: {
      address: string;
    };
  } | null;
  onSuccess: () => void;
}

export function AddOutcomeDialog({
  open,
  onOpenChange,
  match,
  onSuccess,
}: AddOutcomeDialogProps) {
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!match || !outcome) return;

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    // Cast outcome to the expected type
    const outcomeValue = outcome as "pending" | "no_response" | "not_a_fit" | "connected" | "showing_scheduled" | "offer_submitted" | "offer_accepted" | "closed_won" | "closed_lost" | "duplicate" | "invalid";

    const { error } = await supabase
      .from("seller_match_outcomes")
      .insert({
        match_id: match.id,
        outcome: outcomeValue,
        notes: notes.trim() || null,
        recorded_by: user?.id || null,
      });

    setSaving(false);

    if (error) {
      console.error("Error adding outcome:", error);
      toast.error("Failed to add outcome");
      return;
    }

    toast.success(`Outcome updated to "${OUTCOMES.find(o => o.value === outcome)?.label}"`);
    setOutcome("");
    setNotes("");
    onOpenChange(false);
    onSuccess();
  }

  // Reset form when dialog opens
  function handleOpenChange(open: boolean) {
    if (open && match) {
      setOutcome(match.latest_outcome);
      setNotes("");
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Outcome</DialogTitle>
          <DialogDescription>
            {match?.submission?.address || "Update the match outcome status"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="outcome">Outcome</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger>
                <SelectValue placeholder="Select outcome" />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any relevant notes..."
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {notes.length}/500
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!outcome || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Outcome
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

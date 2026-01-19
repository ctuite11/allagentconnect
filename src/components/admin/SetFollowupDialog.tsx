import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Loader2, CalendarIcon, X } from "lucide-react";
import { format, set } from "date-fns";
import { cn } from "@/lib/utils";

interface SetFollowupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: {
    id: string;
    next_followup_at: string | null;
    followup_reason: string | null;
    submission?: {
      address: string;
    };
  } | null;
  onSuccess: () => void;
}

export function SetFollowupDialog({
  open,
  onOpenChange,
  match,
  onSuccess,
}: SetFollowupDialogProps) {
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("09:00");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Initialize form when dialog opens
  useEffect(() => {
    if (open && match) {
      if (match.next_followup_at) {
        const d = new Date(match.next_followup_at);
        setDate(d);
        setTime(format(d, "HH:mm"));
      } else {
        setDate(undefined);
        setTime("09:00");
      }
      setReason(match.followup_reason || "");
    }
  }, [open, match]);

  async function handleSubmit() {
    if (!match || !date) return;

    const [hours, minutes] = time.split(":").map(Number);
    const followupAt = set(date, { hours, minutes, seconds: 0 });

    setSaving(true);

    const { error } = await supabase
      .from("seller_matches")
      .update({
        next_followup_at: followupAt.toISOString(),
        followup_reason: reason.trim() || null,
      })
      .eq("id", match.id);

    setSaving(false);

    if (error) {
      console.error("Error setting follow-up:", error);
      toast.error("Failed to set follow-up");
      return;
    }

    toast.success(`Follow-up set for ${format(followupAt, "MMM d 'at' h:mm a")}`);
    onOpenChange(false);
    onSuccess();
  }

  async function handleClear() {
    if (!match) return;

    setSaving(true);

    const { error } = await supabase
      .from("seller_matches")
      .update({
        next_followup_at: null,
        followup_reason: null,
      })
      .eq("id", match.id);

    setSaving(false);

    if (error) {
      console.error("Error clearing follow-up:", error);
      toast.error("Failed to clear follow-up");
      return;
    }

    toast.success("Follow-up cleared");
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Follow-up</DialogTitle>
          <DialogDescription>
            {match?.submission?.address || "Schedule a follow-up for this match"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Check in after showing"
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          {match?.next_followup_at && (
            <Button
              variant="ghost"
              onClick={handleClear}
              disabled={saving}
              className="text-destructive hover:text-destructive"
            >
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!date || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set Follow-up
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { toast } from "sonner";
import { ArrowRight, UserPlus } from "lucide-react";

const emailSchema = z.string().email();

interface AddFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddFriendDialog = ({ open, onOpenChange }: AddFriendDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleClose = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setEmailError(null);
    onOpenChange(false);
  };

  const onSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    setEmailError(null);

    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Please enter a first and last name");
      return;
    }

    if (!emailSchema.safeParse(trimmedEmail).success) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    try {
      await invokeEdgeFunction("send-buyer-workspace-invite", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: trimmedEmail,
      });

      toast.success("Invite sent!");
      handleClose();
    } catch (err: any) {
      console.error("Invite send error:", err);
      toast.error(err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Add a friend
          </DialogTitle>
          <DialogDescription>
            Invite someone to share your home search — they'll see the same favorites, hot sheets, and saved searches.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="friend_first_name">First name</Label>
              <Input
                id="friend_first_name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="friend_last_name">Last name</Label>
              <Input
                id="friend_last_name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="friend_email">Email</Label>
            <Input
              id="friend_email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              placeholder="jane@example.com"
              className="h-11"
            />
            {emailError && (
              <p className="text-xs text-destructive">{emailError}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <button
              onClick={onSubmit}
              disabled={isSubmitting || !firstName.trim() || !lastName.trim() || !email.trim()}
              className="inline-flex items-center justify-center gap-3 h-11 px-6 rounded-xl bg-zinc-900 text-white font-semibold text-[15px] hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Sending..." : "Send Invite"}
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <ArrowRight className="w-4 h-4 text-white" />
              </span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

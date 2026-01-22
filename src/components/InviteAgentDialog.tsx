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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";

const emailSchema = z.string().email();

interface InviteAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InviteAgentDialog = ({ open, onOpenChange }: InviteAgentDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const addEmail = () => {
    const trimmed = currentEmail.toLowerCase().trim();
    setEmailError(null);

    if (!trimmed) return;

    if (!emailSchema.safeParse(trimmed).success) {
      setEmailError("Please enter a valid email address");
      return;
    }

    if (emails.includes(trimmed)) {
      setEmailError("This email is already added");
      return;
    }

    if (emails.length >= 10) {
      setEmailError("Maximum 10 invites at a time");
      return;
    }

    setEmails([...emails, trimmed]);
    setCurrentEmail("");
  };

  const removeEmail = (emailToRemove: string) => {
    setEmails(emails.filter(e => e !== emailToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addEmail();
    }
  };

  const handleClose = () => {
    setEmails([]);
    setCurrentEmail("");
    setEmailError(null);
    onOpenChange(false);
  };

  const onSubmit = async () => {
    if (emails.length === 0) {
      toast.error("Please add at least one email address");
      return;
    }

    setIsSubmitting(true);
    try {
      // Get current session
      const { data: session } = await supabase.auth.getSession();
      
      if (!session?.session?.user?.id) {
        toast.error("You must be signed in to send invites.");
        return;
      }

      const userId = session.session.user.id;

      // Get inviter's profile info
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", userId)
        .single();

      const inviterName = profile?.first_name && profile?.last_name 
        ? `${profile.first_name} ${profile.last_name}`
        : profile?.email || "An agent";
      const inviterEmail = profile?.email || session.session.user.email || "";

      // Insert all invites into the database
      const inviteRecords = emails.map(email => ({
        inviter_user_id: userId,
        invitee_email: email,
      }));

      const { error: insertError } = await supabase
        .from("agent_invites")
        .insert(inviteRecords);

      if (insertError) {
        console.error("Insert error:", insertError);
        toast.error("Failed to record invites. Please try again.");
        return;
      }

      // Send emails via edge function
      const { data, error: functionError } = await supabase.functions.invoke("send-agent-invite", {
        body: {
          inviteeEmails: emails,
          inviterName,
          inviterEmail,
        },
      });

      if (functionError) {
        console.error("Function error:", functionError);
        toast.error("Failed to send invite emails. Please try again.");
        return;
      }

      const successCount = data?.successCount || 0;
      
      if (successCount === emails.length) {
        toast.success(`${successCount} invite${successCount > 1 ? "s" : ""} sent`);
      } else if (successCount > 0) {
        toast.success(`${successCount} of ${emails.length} invites sent`);
      } else {
        toast.error("Failed to send invites. Please try again.");
        return;
      }

      handleClose();
    } catch (err) {
      console.error("Unexpected error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Invite agents</DialogTitle>
          <DialogDescription>
            Enter emails to invite colleagues to All Agent Connect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="invitee_email">Email address</Label>
            <div className="flex gap-2">
              <Input
                id="invitee_email"
                type="email"
                value={currentEmail}
                onChange={(e) => {
                  setCurrentEmail(e.target.value);
                  setEmailError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="agent@brokerage.com"
                className="h-11 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={addEmail}
                disabled={!currentEmail.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {emailError && (
              <p className="text-xs text-red-500">{emailError}</p>
            )}
          </div>

          {emails.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {emails.map((email) => (
                <Badge 
                  key={email} 
                  variant="secondary"
                  className="pl-3 pr-1.5 py-1.5 text-sm flex items-center gap-1.5"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    className="hover:bg-muted rounded p-0.5 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={onSubmit} 
              disabled={isSubmitting || emails.length === 0}
            >
              {isSubmitting 
                ? "Sending..." 
                : `Send ${emails.length > 0 ? emails.length : ""} Invite${emails.length !== 1 ? "s" : ""}`
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

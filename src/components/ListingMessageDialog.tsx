import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, Loader2 } from "lucide-react";
import AACMonogram from "@/components/ui/AACMonogram";
import { sendListingConversationMessage } from "@/lib/sendListingConversationMessage";
import { showMessageSentToast } from "@/lib/messageSentFeedback";
import { messagesPathForRole, type MessageReturnState } from "@/lib/messageNavigation";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { initialsFromDisplayName } from "@/lib/initials";

export type ListingMessageRecipient = {
  id: string;
  name: string;
  headshotUrl?: string | null;
};

interface ListingMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  variant: "agent" | "buyer";
  recipient: ListingMessageRecipient | null;
  role?: string | null;
  returnState?: MessageReturnState;
  /** Shown when buyer has no linked agent. */
  missingRecipientMessage?: string;
}

const ROLE_LABEL: Record<ListingMessageDialogProps["variant"], string> = {
  agent: "Listing Agent",
  buyer: "My Agent",
};

export function ListingMessageDialog({
  open,
  onOpenChange,
  listingId,
  variant,
  recipient,
  role,
  returnState,
  missingRecipientMessage = "Your agent is not linked yet. Finish setup with your agent to send messages.",
}: ListingMessageDialogProps) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);

  const roleLabel = ROLE_LABEL[variant];

  const resetForm = useCallback(() => {
    setMessage("");
    setSending(false);
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const resizeMessageArea = useCallback(() => {
    const el = messageRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, []);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => resizeMessageArea());
  }, [open, resizeMessageArea]);

  const canSend = Boolean(recipient) && message.trim().length > 0 && !sending;

  const handleSend = async () => {
    if (!recipient) {
      toast.error(missingRecipientMessage);
      return;
    }
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setSending(true);
    try {
      const result = await sendListingConversationMessage({
        listingId,
        body: message.trim(),
        recipientUserId: recipient.id,
      });

      if (!result.ok) {
        toast.error(result.message || "Failed to send message");
        return;
      }

      showMessageSentToast();
      handleOpenChange(false);

      const path = messagesPathForRole(result.conversationId, role);
      navigate(path, returnState ? { state: returnState } : undefined);
    } catch (err) {
      console.error("ListingMessageDialog send failed:", err);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) void handleSend();
    }
  };

  const monogramColor = variant === "buyer" ? "text-[#22C55E]" : "text-[#50C878]";
  const description =
    variant === "buyer"
      ? "Send a message to your agent about this listing."
      : "Send a message to the listing agent about this property.";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden bg-white p-0">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-xl font-semibold text-zinc-900">
              <AACMonogram className={`h-8 w-8 shrink-0 ${monogramColor}`} size={32} />
              <span>Message</span>
            </DialogTitle>
            <DialogDescription className="pl-[42px] text-sm text-zinc-500">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 p-6 pt-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-zinc-700">To</Label>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
              {recipient ? (
                <div className="flex items-center gap-3">
                  {recipient.headshotUrl ? (
                    <img
                      src={recipient.headshotUrl}
                      alt={recipient.name}
                      className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-zinc-200"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-zinc-200">
                      <span className="text-sm font-semibold text-zinc-500">
                        {initialsFromDisplayName(recipient.name)}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-zinc-900">{recipient.name}</p>
                    <p className="text-sm text-zinc-500">{roleLabel}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">{missingRecipientMessage}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-zinc-700">Message</Label>
            <Textarea
              ref={messageRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                requestAnimationFrame(() => resizeMessageArea());
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={6}
              autoFocus
              disabled={!recipient}
              className="min-h-[8.75rem] max-h-[15rem] w-full resize-none overflow-y-auto"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend}
              className="bg-[#0E56F5] text-white hover:bg-[#0C4ED1] disabled:pointer-events-auto disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500 disabled:opacity-100 disabled:hover:bg-neutral-200"
            >
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send Message
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Build recipient props from an agent_profiles row. */
export function listingMessageRecipientFromProfile(profile: {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  headshot_url?: string | null;
}): ListingMessageRecipient {
  const name = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  return {
    id: profile.id,
    name: name || "Agent",
    headshotUrl: profile.headshot_url ?? null,
  };
}

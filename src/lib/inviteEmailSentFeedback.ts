import { toast } from "sonner";

export const INVITE_EMAIL_SENT_TITLE = "Success!";
export const INVITE_EMAIL_SENT_DESCRIPTION = "Email sent.";

const INVITE_EMAIL_SENT_TOAST_DURATION_MS = 3500;

/** Standard success toast after a hot sheet buyer invite email is handed off for delivery. */
export function showInviteEmailSentToast(): void {
  toast.success(INVITE_EMAIL_SENT_TITLE, {
    description: INVITE_EMAIL_SENT_DESCRIPTION,
    duration: INVITE_EMAIL_SENT_TOAST_DURATION_MS,
    position: "top-right",
  });
}

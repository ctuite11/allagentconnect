import { toast } from "sonner";

export const MESSAGE_SENT_TITLE = "Message sent";
export const MESSAGE_SENT_DESCRIPTION = "Your message has been delivered successfully.";

const MESSAGE_SENT_TOAST_DURATION_MS = 3500;

/** Standard success toast after an AAC conversation message is persisted. */
export function showMessageSentToast(): void {
  toast.success(MESSAGE_SENT_TITLE, {
    description: MESSAGE_SENT_DESCRIPTION,
    duration: MESSAGE_SENT_TOAST_DURATION_MS,
    position: "top-right",
  });
}

import { sendListingConversationMessage } from "@/lib/sendListingConversationMessage";

/**
 * @deprecated Prefer `sendListingConversationMessage` directly (conversation-first).
 * Kept for callers that still reference the mirror helper by name.
 */
export async function mirrorListingChatToConversation(opts: {
  listingId: string;
  body: string;
  recipientUserId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await sendListingConversationMessage({
    listingId: opts.listingId,
    body: opts.body,
    recipientUserId: opts.recipientUserId,
  });
  if (!result.ok) return result;
  return { ok: true };
}

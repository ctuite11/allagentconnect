import { supabase } from "@/integrations/supabase/client";
import { findOrCreateConversation } from "@/lib/startConversation";

/**
 * After a `hot_sheet_comments` row is saved, mirror the text into `conversation_messages`
 * so it appears on /messages and triggers the standard new-message email job.
 */
export async function mirrorListingChatToConversation(opts: {
  listingId: string;
  body: string;
  /** Auth user id of the DM counterparty (not the signed-in sender). */
  recipientUserId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const recipientUserId = opts.recipientUserId?.trim();
  if (!recipientUserId || recipientUserId === user.id) {
    return { ok: false, message: "No valid message recipient." };
  }

  const conversationId = await findOrCreateConversation(user.id, recipientUserId, {
    listingId: opts.listingId,
  });

  if (!conversationId) {
    return { ok: false, message: "Could not create or load the conversation thread." };
  }

  const { error } = await supabase.from("conversation_messages").insert({
    conversation_id: conversationId,
    sender_agent_id: user.id,
    recipient_agent_id: recipientUserId,
    body: opts.body,
  });

  if (error) {
    return { ok: false, message: error.message ?? "Could not sync to Messages." };
  }

  supabase.functions.invoke("kick-email-queue").catch(() => {});
  return { ok: true };
}

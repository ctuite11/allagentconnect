import { supabase } from "@/integrations/supabase/client";
import { unarchiveConversationForUser } from "@/lib/archiveConversationsForUser";
import { findOrCreateConversation } from "@/lib/startConversation";

export type SendListingConversationMessageInput = {
  listingId: string;
  body: string;
  recipientUserId: string;
  /** Existing thread id when already resolved (e.g. open ConversationPanel). */
  conversationId?: string | null;
};

/**
 * Canonical send for listing-scoped threads — inserts `conversation_messages` only.
 * DB trigger `enqueue_message_email` enqueues a single notification.
 */
export async function sendListingConversationMessage(
  input: SendListingConversationMessageInput,
): Promise<{ ok: true; conversationId: string } | { ok: false; message: string }> {
  const body = input.body.trim();
  if (!body) return { ok: false, message: "Message is empty." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const recipientUserId = input.recipientUserId.trim();
  if (!recipientUserId || recipientUserId === user.id) {
    return { ok: false, message: "No valid message recipient." };
  }

  let conversationId = input.conversationId?.trim() || null;
  if (!conversationId) {
    conversationId = await findOrCreateConversation(user.id, recipientUserId, {
      listingId: input.listingId,
    });
  }

  if (!conversationId) {
    return { ok: false, message: "Could not create or load the conversation thread." };
  }

  await unarchiveConversationForUser(supabase, conversationId);

  const { error } = await supabase.from("conversation_messages").insert({
    conversation_id: conversationId,
    sender_agent_id: user.id,
    recipient_agent_id: recipientUserId,
    body,
  });

  if (error) {
    return { ok: false, message: error.message ?? "Could not send message." };
  }

  supabase.functions.invoke("kick-email-queue").catch(() => {});
  return { ok: true, conversationId };
}

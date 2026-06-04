import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Hide conversations from the caller's inbox (soft delete).
 * Sets `conversation_participants.is_archived` for the current user only.
 */
export async function archiveConversationsForUser(
  supabase: SupabaseClient,
  conversationIds: string[],
): Promise<{ error: string | null }> {
  const uniqueIds = [...new Set(conversationIds.filter(Boolean))];
  if (uniqueIds.length === 0) return { error: null };

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: authError?.message ?? "Not signed in" };
  }

  const { error } = await supabase
    .from("conversation_participants")
    .update({ is_archived: true })
    .eq("user_id", user.id)
    .in("conversation_id", uniqueIds);

  return { error: error?.message ?? null };
}

/** Restore one participant row (inbox visibility) for a conversation. */
export async function unarchiveConversationParticipant(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
): Promise<void> {
  if (!conversationId || !userId) return;

  await supabase
    .from("conversation_participants")
    .update({ is_archived: false })
    .eq("user_id", userId)
    .eq("conversation_id", conversationId);
}

/** Restore a thread in the caller's inbox when they open, resume, or send into it. */
export async function unarchiveConversationForUser(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !conversationId) return;

  await unarchiveConversationParticipant(supabase, conversationId, user.id);
}

import { supabase } from "@/integrations/supabase/client";

/**
 * Find or create a 1:1 conversation between two agents.
 * Returns the conversation ID.
 */
export async function findOrCreateConversation(
  currentUserId: string,
  otherUserId: string
): Promise<string | null> {
  // Check for existing conversation (either direction)
  const { data: existing, error: searchError } = await supabase
    .from("conversations")
    .select("id")
    .or(
      `and(agent_a_id.eq.${currentUserId},agent_b_id.eq.${otherUserId}),and(agent_a_id.eq.${otherUserId},agent_b_id.eq.${currentUserId})`
    )
    .maybeSingle();

  if (searchError) {
    console.error("Error searching for conversation:", searchError);
    return null;
  }

  if (existing) {
    // Ensure participant rows exist
    await ensureParticipants(existing.id, currentUserId, otherUserId);
    return existing.id;
  }

  // Create new conversation
  const { data: newConvo, error: createError } = await supabase
    .from("conversations")
    .insert({
      agent_a_id: currentUserId,
      agent_b_id: otherUserId,
    })
    .select("id")
    .single();

  if (createError || !newConvo) {
    console.error("Error creating conversation:", createError);
    return null;
  }

  // Create participant rows for both users
  await ensureParticipants(newConvo.id, currentUserId, otherUserId);

  return newConvo.id;
}

async function ensureParticipants(
  conversationId: string,
  userA: string,
  userB: string
): Promise<void> {
  // Upsert both participants - rely on onConflict without ignoreDuplicates
  // Note: RLS requires user_id = auth.uid(), so we insert for the current user only here
  // The other participant row should be inserted by that user when they access the thread
  // OR we can insert both since the policy checks happen per-row
  const { error } = await supabase.from("conversation_participants").upsert(
    [
      { conversation_id: conversationId, user_id: userA },
      { conversation_id: conversationId, user_id: userB },
    ],
    { onConflict: "conversation_id,user_id" }
  );
  
  if (error) {
    console.error("Error ensuring participants:", error);
  }
}

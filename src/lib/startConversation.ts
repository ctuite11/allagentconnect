import { supabase } from "@/integrations/supabase/client";

interface ConversationOptions {
  listingId?: string | null;
}

/**
 * Find or create a 1:1 conversation between two agents.
 * Optionally scoped to a specific listing.
 * Returns the conversation ID.
 */
export async function findOrCreateConversation(
  currentUserId: string,
  otherUserId: string,
  opts?: ConversationOptions
): Promise<string | null> {
  const listingId = opts?.listingId ?? null;

  // Build query for existing conversation between the two users
  let query = supabase
    .from("conversations")
    .select("id")
    .or(
      `and(agent_a_id.eq.${currentUserId},agent_b_id.eq.${otherUserId}),and(agent_a_id.eq.${otherUserId},agent_b_id.eq.${currentUserId})`
    );

  // Scope to listing if provided, otherwise find generic conversation
  if (listingId) {
    query = query.eq("listing_id", listingId);
  } else {
    query = query.is("listing_id", null);
  }

  const { data: existing, error: searchError } = await query.maybeSingle();

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
      listing_id: listingId,
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
  // Upsert both participants
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

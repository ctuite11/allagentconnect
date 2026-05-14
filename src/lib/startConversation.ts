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
    console.error("[findOrCreateConversation] search failed", {
      message: searchError.message,
      code: searchError.code,
      details: searchError,
    });
    return null;
  }

  if (existing) {
    await ensureParticipants(existing.id);
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
    console.error("[findOrCreateConversation] insert failed", {
      message: createError?.message,
      code: createError?.code,
      details: createError,
      listingId,
      currentUserId,
      otherUserId,
    });
    return null;
  }

  await ensureParticipants(newConvo.id);

  return newConvo.id;
}

async function ensureParticipants(conversationId: string): Promise<void> {
  // Avoid client `upsert` default ON CONFLICT DO UPDATE: `cp_update_own` only allows updating your own row,
  // so updating the counterparty's participant row fails RLS. Server RPC uses INSERT ... DO NOTHING only.
  const { error } = await supabase.rpc("ensure_conversation_participants_for_caller", {
    p_conversation_id: conversationId,
  });

  if (error) {
    console.error("[ensureParticipants] ensure_conversation_participants_for_caller failed:", error);
  }
}

import { supabase } from "@/integrations/supabase/client";

interface ConversationOptions {
  listingId?: string | null;
}

/** True when both users archived the thread (e.g. after agent removed buyer). */
async function isConversationArchivedForBothUsers(
  conversationId: string,
  userA: string,
  userB: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("user_id, is_archived")
    .eq("conversation_id", conversationId)
    .in("user_id", [userA, userB]);

  if (error || !data?.length) return false;

  const byUser = new Map(data.map((row) => [row.user_id, row.is_archived === true]));
  return byUser.get(userA) === true && byUser.get(userB) === true;
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
    // If both participants archived this thread (e.g. after a removed
    // relationship), do NOT auto-unarchive. Force a fresh conversation row
    // so the new relationship starts with an empty inbox thread.
    const bothArchived = await isConversationArchivedForBothUsers(
      existing.id,
      currentUserId,
      otherUserId,
    );

    if (!bothArchived) {
      await ensureParticipants(existing.id);
      return existing.id;
    }
    // fall through and try to insert a new row
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
    // Unique-constraint conflict (listing-scoped 1:1 already exists, both
    // archived). Fall back to the existing row and ensure the caller's
    // participant row is unarchived so they can see their new message.
    if (createError?.code === "23505" && existing) {
      await ensureParticipants(existing.id);
      await supabase
        .from("conversation_participants")
        .update({ is_archived: false })
        .eq("conversation_id", existing.id)
        .eq("user_id", currentUserId);
      return existing.id;
    }
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
    throw new Error(error.message || "Could not prepare this conversation.");
  }
}

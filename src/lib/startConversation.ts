import { supabase } from "@/integrations/supabase/client";
import { unarchiveConversationForUser } from "@/lib/archiveConversationsForUser";

interface ConversationOptions {
  listingId?: string | null;
}

/** True when the given user's participant row is archived for this conversation. */
async function isConversationArchivedForUser(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("is_archived")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return false;
  return data.is_archived === true;
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

  // Build query for existing conversation between the two users.
  // For generic (no listing) we may have multiple historical rows (some
  // archived by the current user). Order by most recent so we evaluate the
  // newest first.
  let query = supabase
    .from("conversations")
    .select("id, last_message_at")
    .or(
      `and(agent_a_id.eq.${currentUserId},agent_b_id.eq.${otherUserId}),and(agent_a_id.eq.${otherUserId},agent_b_id.eq.${currentUserId})`
    )
    .order("last_message_at", { ascending: false });

  // Scope to listing if provided, otherwise find generic conversation
  if (listingId) {
    query = query.eq("listing_id", listingId).limit(1);
  } else {
    query = query.is("listing_id", null).limit(1);
  }

  const { data: existingRows, error: searchError } = await query;
  const existing = existingRows?.[0] ?? null;

  if (searchError) {
    console.error("[findOrCreateConversation] search failed", {
      message: searchError.message,
      code: searchError.code,
      details: searchError,
    });
    return null;
  }

  if (existing) {
    if (listingId) {
      // Listing-scoped: keep reusing the listing thread (unique by listing).
      await ensureParticipants(existing.id);
      await unarchiveConversationForUser(supabase, existing.id);
      return existing.id;
    }

    // Generic conversation: if the current user archived/deleted this thread
    // from their inbox, do NOT reuse or unarchive it. Start a fresh row so
    // their new message lands in a clean thread. The other participant's
    // visibility is unchanged (still archived/visible per their own row).
    const archivedForCaller = await isConversationArchivedForUser(
      existing.id,
      currentUserId,
    );

    if (!archivedForCaller) {
      await ensureParticipants(existing.id);
      return existing.id;
    }
    // fall through and create a new generic conversation
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
    // Unique-constraint conflict (listing-scoped 1:1 already exists).
    // Generic rows allow NULL duplicates so this branch is listing-only.
    if (createError?.code === "23505" && existing && listingId) {
      await ensureParticipants(existing.id);
      await unarchiveConversationForUser(supabase, existing.id);
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

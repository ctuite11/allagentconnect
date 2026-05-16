import { supabase } from "@/integrations/supabase/client";

/** Compact listing-card thread row (legacy `hot_sheet_id` field unused for inbox threads). */
export type ListingCardThreadMessage = {
  id: string;
  hot_sheet_id: string;
  listing_id: string;
  comment: string;
  sender_role: string;
  sender_id: string | null;
  created_at: string;
};

function partiesMatch(
  row: { agent_a_id: string; agent_b_id: string },
  userA: string,
  userB: string,
): boolean {
  return (
    (row.agent_a_id === userA && row.agent_b_id === userB) ||
    (row.agent_a_id === userB && row.agent_b_id === userA)
  );
}

export function conversationMessageToCardRow(
  row: {
    id: string;
    conversation_id: string;
    sender_agent_id: string;
    body: string;
    created_at: string;
  },
  listingId: string,
  agentUserId: string,
): ListingCardThreadMessage {
  return {
    id: row.id,
    hot_sheet_id: "",
    listing_id: listingId,
    comment: row.body,
    sender_role: row.sender_agent_id === agentUserId ? "agent" : "client",
    sender_id: row.sender_agent_id,
    created_at: row.created_at,
  };
}

async function findListingConversations(
  listingIds: string[],
  partyA: string,
  partyB: string,
): Promise<Map<string, string>> {
  if (listingIds.length === 0) return new Map();

  const { data: convoRows, error } = await supabase
    .from("conversations")
    .select("id, listing_id, agent_a_id, agent_b_id")
    .in("listing_id", listingIds);

  if (error || !convoRows?.length) return new Map();

  const out = new Map<string, string>();
  for (const c of convoRows as {
    id: string;
    listing_id: string;
    agent_a_id: string;
    agent_b_id: string;
  }[]) {
    if (!c.listing_id || out.has(c.listing_id)) continue;
    if (partiesMatch(c, partyA, partyB)) out.set(c.listing_id, c.id);
  }
  return out;
}

/** Latest inbox message per listing (card preview). */
export async function fetchListingConversationPreviewMap(
  listingIds: string[],
  partyA: string,
  partyB: string,
  agentUserId: string,
): Promise<Record<string, ListingCardThreadMessage[]>> {
  const listingToConvo = await findListingConversations(listingIds, partyA, partyB);
  if (listingToConvo.size === 0) return {};

  const convoIds = [...listingToConvo.values()];
  const convoToListing = new Map([...listingToConvo.entries()].map(([lid, cid]) => [cid, lid]));

  const { data: msgRows, error: mErr } = await supabase
    .from("conversation_messages")
    .select("id, conversation_id, sender_agent_id, body, created_at")
    .in("conversation_id", convoIds)
    .order("created_at", { ascending: false });

  if (mErr || !msgRows?.length) return {};

  const latestByConvo = new Map<string, (typeof msgRows)[0]>();
  for (const m of msgRows) {
    const cid = m.conversation_id as string;
    if (!latestByConvo.has(cid)) latestByConvo.set(cid, m);
  }

  const out: Record<string, ListingCardThreadMessage[]> = {};
  for (const [convoId, msg] of latestByConvo) {
    const lid = convoToListing.get(convoId);
    if (!lid || out[lid]) continue;
    out[lid] = [conversationMessageToCardRow(msg as never, lid, agentUserId)];
  }
  return out;
}

/** Full message history per listing from listing-scoped inbox threads. */
export async function fetchListingConversationMessagesMap(
  listingIds: string[],
  partyA: string,
  partyB: string,
  agentUserId: string,
): Promise<Record<string, ListingCardThreadMessage[]>> {
  const listingToConvo = await findListingConversations(listingIds, partyA, partyB);
  if (listingToConvo.size === 0) return {};

  const convoIds = [...listingToConvo.values()];
  const convoToListing = new Map([...listingToConvo.entries()].map(([lid, cid]) => [cid, lid]));

  const { data: msgRows, error } = await supabase
    .from("conversation_messages")
    .select("id, conversation_id, sender_agent_id, body, created_at")
    .in("conversation_id", convoIds)
    .order("created_at", { ascending: true });

  if (error || !msgRows?.length) return {};

  const out: Record<string, ListingCardThreadMessage[]> = {};
  for (const m of msgRows) {
    const lid = convoToListing.get(m.conversation_id as string);
    if (!lid) continue;
    if (!out[lid]) out[lid] = [];
    out[lid].push(conversationMessageToCardRow(m as never, lid, agentUserId));
  }
  return out;
}

export function mergeListingThreadMessages(
  primary: Record<string, ListingCardThreadMessage[]>,
  secondary: Record<string, ListingCardThreadMessage[]>,
): Record<string, ListingCardThreadMessage[]> {
  const listingIds = new Set([...Object.keys(primary), ...Object.keys(secondary)]);
  const out: Record<string, ListingCardThreadMessage[]> = {};
  for (const lid of listingIds) {
    const byId = new Map<string, ListingCardThreadMessage>();
    for (const m of [...(secondary[lid] ?? []), ...(primary[lid] ?? [])]) {
      byId.set(m.id, m);
    }
    out[lid] = [...byId.values()].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }
  return out;
}

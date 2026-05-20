import { supabase } from "@/integrations/supabase/client";
import { resolveBuyerAuthUserId } from "@/lib/resolveBuyerAuthUserId";

export type HotSheetReviewRecipientInput = {
  /** CRM `clients.id` */
  clientId: string;
  email: string;
  buyerLinked: boolean;
  inviteAccepted: boolean;
};

export type HotSheetConversationBuyerDebug = {
  hotSheetId: string | null;
  hotSheetClientId: string | null;
  primaryCrmClientId: string | null;
  crmClientIds: string[];
  reviewRecipients: Array<{
    crmClientId: string;
    email: string;
    buyerLinked: boolean;
    inviteAccepted: boolean;
    authUserId?: string;
  }>;
  relationshipRows: Array<{
    crm_client_id: string | null;
    client_id: string | null;
    status: string;
  }>;
  profileLookupByEmail: Record<string, string | null>;
  conversationRecipientBuyerId: string | null;
  resolvedVia: string | null;
};

type RelationshipRow = {
  crm_client_id: string | null;
  client_id: string | null;
  status: string;
};

/** Same path as `AgentClientFavorites`: CRM row email → `profiles.id`. */
export async function resolveBuyerAuthFromCrmClientId(crmClientId: string): Promise<string | null> {
  const id = crmClientId.trim();
  if (!id) return null;
  const { data: clientRow } = await supabase
    .from("clients")
    .select("email")
    .eq("id", id)
    .maybeSingle();
  const email = typeof clientRow?.email === "string" ? clientRow.email.trim() : "";
  if (!email) return null;
  return resolveBuyerAuthUserId({ email });
}

async function profileIdExists(userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  return Boolean(data?.id);
}

function buildRelationshipOrFilter(crmClientIds: string[]): string {
  return crmClientIds
    .flatMap((crmId) => [`crm_client_id.eq.${crmId}`, `client_id.eq.${crmId}`])
    .join(",");
}

export async function fetchActiveRelationshipsForCrmClients(
  agentUserId: string,
  crmClientIds: string[],
): Promise<RelationshipRow[]> {
  if (crmClientIds.length === 0) return [];
  const orFilter = buildRelationshipOrFilter(crmClientIds);
  const { data, error } = await supabase
    .from("client_agent_relationships")
    .select("crm_client_id, client_id, status")
    .eq("agent_id", agentUserId)
    .eq("status", "active")
    .or(orFilter);
  if (error) {
    console.warn("[HotSheetReview] client_agent_relationships:", error.message);
    return [];
  }
  return (data ?? []) as RelationshipRow[];
}

/**
 * Resolve buyer auth user + per-recipient auth ids for Hot Sheet Review comments.
 * Mirrors agent buyer Favorites: CRM email → profile, then verified relationship `client_id`.
 */
export async function resolveHotSheetReviewConversationBuyer(opts: {
  agentUserId: string;
  hotSheetId: string;
  hotSheetCrmClientId: string | null;
  linkedCrmClientIds: string[];
  recipients: HotSheetReviewRecipientInput[];
}): Promise<{
  conversationBuyerUserId: string | null;
  authUserIdByCrmClientId: Map<string, string>;
  debug: HotSheetConversationBuyerDebug;
}> {
  const crmClientIds = [
    ...new Set(
      [
        opts.hotSheetCrmClientId,
        ...opts.linkedCrmClientIds,
        ...opts.recipients.map((r) => r.clientId),
      ]
        .filter(Boolean)
        .map(String),
    ),
  ];

  const primaryCrmClientId =
    (opts.hotSheetCrmClientId?.trim() || null) ??
    opts.recipients.find((r) => r.buyerLinked || r.inviteAccepted)?.clientId ??
    crmClientIds[0] ??
    null;

  const relationshipRows = await fetchActiveRelationshipsForCrmClients(opts.agentUserId, crmClientIds);

  const profileLookupByEmail: Record<string, string | null> = {};
  const authUserIdByCrmClientId = new Map<string, string>();

  const rememberEmailLookup = async (crmId: string, email: string) => {
    const key = email.trim().toLowerCase();
    if (!key) return null;
    if (!(key in profileLookupByEmail)) {
      profileLookupByEmail[key] = await resolveBuyerAuthUserId({ email });
    }
    const authId = profileLookupByEmail[key];
    if (authId) authUserIdByCrmClientId.set(crmId, authId);
    return authId;
  };

  for (const row of relationshipRows) {
    const crmId = row.crm_client_id ? String(row.crm_client_id) : "";
    const relAuthId = row.client_id ? String(row.client_id) : "";
    if (!crmId || !relAuthId) continue;
    if (await profileIdExists(relAuthId)) {
      authUserIdByCrmClientId.set(crmId, relAuthId);
    }
  }

  for (const recipient of opts.recipients) {
    if (!recipient.buyerLinked && !recipient.inviteAccepted) continue;
    if (authUserIdByCrmClientId.has(recipient.clientId)) continue;
    if (recipient.email.trim()) {
      await rememberEmailLookup(recipient.clientId, recipient.email);
    }
  }

  if (primaryCrmClientId && !authUserIdByCrmClientId.has(primaryCrmClientId)) {
    const fromCrm = await resolveBuyerAuthFromCrmClientId(primaryCrmClientId);
    if (fromCrm) authUserIdByCrmClientId.set(primaryCrmClientId, fromCrm);
  }

  let conversationBuyerUserId: string | null = null;
  let resolvedVia: string | null = null;

  if (primaryCrmClientId) {
    const fromPrimary = authUserIdByCrmClientId.get(primaryCrmClientId) ?? null;
    if (fromPrimary) {
      conversationBuyerUserId = fromPrimary;
      resolvedVia = "primary_crm";
    }
  }

  if (!conversationBuyerUserId) {
    const linkedRecipient = opts.recipients.find(
      (r) => (r.buyerLinked || r.inviteAccepted) && authUserIdByCrmClientId.has(r.clientId),
    );
    if (linkedRecipient) {
      conversationBuyerUserId = authUserIdByCrmClientId.get(linkedRecipient.clientId) ?? null;
      resolvedVia = "linked_recipient";
    }
  }

  if (!conversationBuyerUserId) {
    for (const [, authId] of authUserIdByCrmClientId) {
      conversationBuyerUserId = authId;
      resolvedVia = "relationship_or_email_map";
      break;
    }
  }

  const reviewRecipients = opts.recipients.map((r) => ({
    crmClientId: r.clientId,
    email: r.email,
    buyerLinked: r.buyerLinked,
    inviteAccepted: r.inviteAccepted,
    authUserId: authUserIdByCrmClientId.get(r.clientId),
  }));

  const debug: HotSheetConversationBuyerDebug = {
    hotSheetId: opts.hotSheetId,
    hotSheetClientId: opts.hotSheetCrmClientId,
    primaryCrmClientId,
    crmClientIds,
    reviewRecipients,
    relationshipRows,
    profileLookupByEmail,
    conversationRecipientBuyerId: conversationBuyerUserId,
    resolvedVia,
  };

  if (import.meta.env.DEV) {
    console.info("[HotSheetReview] conversation buyer resolution", debug);
  }

  return { conversationBuyerUserId, authUserIdByCrmClientId, debug };
}

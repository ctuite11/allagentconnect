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

/**
 * Same path as `AgentClientFavorites`: CRM row email → `profiles.id`.
 * NOTE: `profiles` RLS is owner-only, so this only resolves when the agent IS the buyer
 * (rare). Kept as a soft fallback for admin/service contexts.
 */
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

/**
 * Lookup `share_tokens.accepted_by_user_id` for any accepted, non-revoked invite
 * issued by this agent whose payload `client_id` is in the given CRM ids.
 * Returns the first matching auth user id (validated against `profiles`).
 */
export async function resolveBuyerAuthFromAcceptedShareTokens(
  agentUserId: string,
  crmClientIds: string[],
): Promise<string | null> {
  const ids = crmClientIds.map((c) => c?.trim()).filter(Boolean);
  if (!agentUserId || ids.length === 0) return null;
  const { data, error } = await supabase
    .from("share_tokens")
    .select("accepted_by_user_id, payload, accepted_at, revoked_at")
    .eq("agent_id", agentUserId)
    .not("accepted_by_user_id", "is", null)
    .not("accepted_at", "is", null)
    .is("revoked_at", null);
  if (error) {
    console.warn("[HotSheetReview] share_tokens lookup:", error.message);
    return null;
  }
  for (const row of data ?? []) {
    const payload = (row as { payload?: { client_id?: string } | null }).payload ?? null;
    const tokenClientId = typeof payload?.client_id === "string" ? payload.client_id : "";
    if (!tokenClientId || !ids.includes(tokenClientId)) continue;
    const authId = (row as { accepted_by_user_id?: string | null }).accepted_by_user_id;
    if (authId) {
      // Trust the FK to auth.users — don't gate on profiles RLS (owner-only).
      return String(authId);
    }
  }
  return null;
}

/**
 * Lookup `buyer_workspace_invites.(accepted_by_user_id|buyer_user_id)` for accepted invites
 * whose `buyer_email` matches any of the given CRM clients' emails.
 */
export async function resolveBuyerAuthFromAcceptedWorkspaceInvites(
  agentUserId: string,
  crmClientIds: string[],
): Promise<string | null> {
  const ids = crmClientIds.map((c) => c?.trim()).filter(Boolean);
  if (!agentUserId || ids.length === 0) return null;

  const { data: clientRows } = await supabase
    .from("clients")
    .select("id, email")
    .in("id", ids);
  const emails = (clientRows ?? [])
    .map((r: { email?: string | null }) => (typeof r.email === "string" ? r.email.trim().toLowerCase() : ""))
    .filter(Boolean);
  if (emails.length === 0) return null;

  const { data, error } = await supabase
    .from("buyer_workspace_invites")
    .select("accepted_by_user_id, buyer_user_id, buyer_email, accepted_at")
    .in("buyer_email", emails)
    .not("accepted_at", "is", null);
  if (error) {
    console.warn("[HotSheetReview] buyer_workspace_invites lookup:", error.message);
    return null;
  }
  for (const row of data ?? []) {
    const authId =
      (row as { accepted_by_user_id?: string | null }).accepted_by_user_id ??
      (row as { buyer_user_id?: string | null }).buyer_user_id ??
      null;
    if (authId) return String(authId);
  }
  return null;
}

/**
 * On-demand resolver for the comment click handler. Tries (in order):
 *  1. share_tokens.accepted_by_user_id for agent + CRM ids,
 *  2. CRM email → profiles fallback for each CRM id.
 * Also returns invite metadata so the UI can label Invite vs Resend.
 */
export async function resolveBuyerAuthForHotSheet(opts: {
  agentUserId: string;
  crmClientIds: Array<string | null | undefined>;
}): Promise<{
  authUserId: string | null;
  hasAnyInvite: boolean;
  hasPendingInvite: boolean;
}> {
  const crmIds = [
    ...new Set(opts.crmClientIds.filter((v): v is string => typeof v === "string" && v.trim().length > 0)),
  ];
  if (!opts.agentUserId || crmIds.length === 0) {
    return { authUserId: null, hasAnyInvite: false, hasPendingInvite: false };
  }

  const fromAccepted = await resolveBuyerAuthFromAcceptedShareTokens(opts.agentUserId, crmIds);
  if (fromAccepted) {
    return { authUserId: fromAccepted, hasAnyInvite: true, hasPendingInvite: false };
  }

  const fromWorkspaceInvite = await resolveBuyerAuthFromAcceptedWorkspaceInvites(opts.agentUserId, crmIds);
  if (fromWorkspaceInvite) {
    return { authUserId: fromWorkspaceInvite, hasAnyInvite: true, hasPendingInvite: false };
  }

  // client_agent_relationships (agent-owned) — client_id is the buyer auth uid.
  const rels = await fetchActiveRelationshipsForCrmClients(opts.agentUserId, crmIds);
  for (const rel of rels) {
    if (rel.client_id) return { authUserId: String(rel.client_id), hasAnyInvite: true, hasPendingInvite: false };
  }

  for (const crmId of crmIds) {
    const fromEmail = await resolveBuyerAuthFromCrmClientId(crmId);
    if (fromEmail) {
      return { authUserId: fromEmail, hasAnyInvite: true, hasPendingInvite: false };
    }
  }

  // No auth user. Check whether any invite exists (accepted or not) to decide Invite vs Resend.
  const { data: tokenRows } = await supabase
    .from("share_tokens")
    .select("accepted_at, revoked_at, payload")
    .eq("agent_id", opts.agentUserId)
    .is("revoked_at", null);
  let hasAnyInvite = false;
  let hasPendingInvite = false;
  for (const row of tokenRows ?? []) {
    const payload = (row as { payload?: { client_id?: string } | null }).payload ?? null;
    const tokenClientId = typeof payload?.client_id === "string" ? payload.client_id : "";
    if (!tokenClientId || !crmIds.includes(tokenClientId)) continue;
    hasAnyInvite = true;
    if (!(row as { accepted_at?: string | null }).accepted_at) hasPendingInvite = true;
  }
  return { authUserId: null, hasAnyInvite, hasPendingInvite };
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
    authUserIdByCrmClientId.set(crmId, relAuthId);
  }

  // NEW: accepted share_tokens path (catches buyers whose profile email
  // differs from the CRM email — relationship row may not yet be populated).
  const unresolvedCrmIds = crmClientIds.filter((c) => !authUserIdByCrmClientId.has(c));
  if (unresolvedCrmIds.length > 0) {
    const { data: tokenRows } = await supabase
      .from("share_tokens")
      .select("accepted_by_user_id, payload, accepted_at, revoked_at")
      .eq("agent_id", opts.agentUserId)
      .not("accepted_by_user_id", "is", null)
      .not("accepted_at", "is", null)
      .is("revoked_at", null);
    for (const row of tokenRows ?? []) {
      const payload = (row as { payload?: { client_id?: string } | null }).payload ?? null;
      const tokenClientId = typeof payload?.client_id === "string" ? payload.client_id : "";
      if (!tokenClientId || !unresolvedCrmIds.includes(tokenClientId)) continue;
      const authId = (row as { accepted_by_user_id?: string | null }).accepted_by_user_id;
      if (authId) {
        authUserIdByCrmClientId.set(tokenClientId, String(authId));
      }
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

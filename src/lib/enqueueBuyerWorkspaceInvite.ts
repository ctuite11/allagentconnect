import type { SupabaseClient } from "@supabase/supabase-js";

export type EnqueueBuyerWorkspaceInviteResult = {
  ok: boolean;
  /** Present when token insert or edge invoke fails */
  error: string | null;
};

/**
 * Workspace-only buyer invite (no hot sheet): creates `share_tokens` and invokes
 * `send-hot-sheet-invite` with `mode: "invite_only"` so a row is inserted into `email_jobs`.
 * Caller should invoke `kick-email-queue` after success so delivery runs promptly.
 */
export async function enqueueBuyerWorkspaceInvite({
  supabase,
  agentUserId,
  buyer,
  inviterDisplayName,
}: {
  supabase: SupabaseClient;
  agentUserId: string;
  buyer: { id: string; email: string; firstName: string; lastName: string };
  /** Optional override (e.g. from `profiles` in the review UI); otherwise uses `agent_profiles`. */
  inviterDisplayName?: string | null;
}): Promise<EnqueueBuyerWorkspaceInviteResult> {
  const normalizedEmail = buyer.email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, error: "Buyer email is required." };
  }

  let inviterName = (inviterDisplayName ?? "").trim();
  if (!inviterName) {
    const { data: ap } = await supabase
      .from("agent_profiles")
      .select("first_name, last_name")
      .eq("id", agentUserId)
      .maybeSingle();
    inviterName = `${ap?.first_name ?? ""} ${ap?.last_name ?? ""}`.trim() || "Your agent";
  }

  const token = crypto.randomUUID();
  const tokenPayload = {
    type: "client_hotsheet_invite" as const,
    client_id: buyer.id,
    client_email: normalizedEmail,
    suppress_initial_matches: true,
    invite_only: true,
  };

  const { data: tokenRow, error: tokenError } = await supabase
    .from("share_tokens")
    .insert({
      token,
      agent_id: agentUserId,
      payload: tokenPayload,
    })
    .select("id, token")
    .single();

  if (tokenError || !tokenRow) {
    return {
      ok: false,
      error: tokenError?.message ?? "Could not create invite token.",
    };
  }

  void supabase.from("invite_events").insert({
    token_id: tokenRow.id,
    hot_sheet_id: null,
    client_id: buyer.id,
    client_email: normalizedEmail,
    event_type: "token_created",
    actor_user_id: agentUserId,
  });

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://allagentconnect.com";

  const hotSheetLink =
    `${origin}/client-invite` +
    `?invitation_token=${encodeURIComponent(tokenRow.token)}` +
    `&email=${encodeURIComponent(normalizedEmail)}` +
    `&agent_id=${encodeURIComponent(agentUserId)}` +
    `&client_id=${encodeURIComponent(buyer.id)}` +
    (buyer.firstName ? `&first_name=${encodeURIComponent(buyer.firstName)}` : "") +
    (buyer.lastName ? `&last_name=${encodeURIComponent(buyer.lastName)}` : "");

  const { error: fnError } = await supabase.functions.invoke("send-hot-sheet-invite", {
    body: {
      invitedEmail: normalizedEmail,
      inviterName,
      hotSheetName: "Your private buyer workspace",
      hotSheetLink,
      tokenId: tokenRow.id,
      clientId: buyer.id,
      mode: "invite_only",
    },
  });

  if (fnError) {
    return { ok: false, error: fnError.message };
  }

  return { ok: true, error: null };
}

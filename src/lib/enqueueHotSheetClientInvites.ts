import type { SupabaseClient } from "@supabase/supabase-js";

export type EnqueueHotSheetInvitesResult = {
  /** True when no invoke/insert errors occurred. */
  ok: boolean;
  /** Jobs successfully handed to `send-hot-sheet-invite` (each inserts `email_jobs`). */
  enqueued: number;
  /** Clients skipped (no email, already accepted, or not eligible for dashboard invite). */
  skipped: number;
  errors: string[];
};

type SheetInviteToken = { id: string; token: string; accepted_at: string | null };

function pickTokenForInvite(rows: SheetInviteToken[]): SheetInviteToken | null {
  if (!rows?.length) return null;
  const pending = rows.find((r) => !r.accepted_at);
  return pending ?? rows[0] ?? null;
}

/**
 * Creates `share_tokens` (when needed) and invokes `send-hot-sheet-invite` for each eligible client.
 * Mirrors {@link HotSheetReview} “Send Invites” so programmatic flows (e.g. new buyer + hot sheet) enqueue
 * `email_jobs` the same way. Caller should invoke `kick-email-queue` after success so Resend runs promptly.
 */
export async function enqueueHotSheetClientInvites({
  supabase,
  hotSheetId,
  hotSheetName,
  agentUserId,
  clientIds,
}: {
  supabase: SupabaseClient;
  hotSheetId: string;
  hotSheetName: string;
  agentUserId: string;
  clientIds: string[];
}): Promise<EnqueueHotSheetInvitesResult> {
  const errors: string[] = [];
  let enqueued = 0;
  let skipped = 0;

  const uniqueIds = [...new Set(clientIds.map(String))].filter(Boolean);
  if (uniqueIds.length === 0) {
    return { ok: true, enqueued: 0, skipped: 0, errors: [] };
  }

  const [agentProfileRes, clientsRes, existingTokensRes, relationshipRes] = await Promise.all([
    supabase.from("agent_profiles").select("first_name, last_name").eq("id", agentUserId).maybeSingle(),
    supabase.from("clients").select("id, email, first_name, last_name, phone").in("id", uniqueIds),
    supabase.from("share_tokens").select("id, token, payload, accepted_at").eq("agent_id", agentUserId),
    supabase
      .from("client_agent_relationships")
      .select("crm_client_id, client_id, status")
      .eq("agent_id", agentUserId)
      .in("crm_client_id", uniqueIds),
  ]);

  const agentName = agentProfileRes.data
    ? `${agentProfileRes.data.first_name ?? ""} ${agentProfileRes.data.last_name ?? ""}`.trim()
    : "Your agent";

  const clientMap = new Map<
    string,
    { email: string; first_name: string | null; last_name: string | null; phone: string | null }
  >();
  for (const c of clientsRes.data ?? []) {
    if (c.email) {
      clientMap.set(String(c.id), {
        email: String(c.email),
        first_name: c.first_name ?? null,
        last_name: c.last_name ?? null,
        phone: c.phone ?? null,
      });
    }
  }

  const buyerLinkedCrmIds = new Set(
    (relationshipRes.data ?? [])
      .filter((r: { status?: string; client_id?: string | null }) => String(r.status) === "active" && r.client_id != null)
      .map((r: { crm_client_id?: string }) => String(r.crm_client_id)),
  );

  const hotSheetIdNorm = String(hotSheetId);
  const stRows = existingTokensRes.data ?? [];

  const allInviteForAgent = stRows.filter((t: { payload?: { type?: string } }) => t?.payload?.type === "client_hotsheet_invite");
  const globalInviteByClientId = new Map<string, unknown[]>();
  const globalInviteByEmail = new Map<string, unknown[]>();
  for (const t of allInviteForAgent) {
    const payload = (t as { payload?: { client_id?: string; client_email?: string } }).payload;
    const cid = payload?.client_id ?? null;
    const em = payload?.client_email ?? null;
    if (cid) {
      const k = String(cid);
      const arr = globalInviteByClientId.get(k) ?? [];
      arr.push(t);
      globalInviteByClientId.set(k, arr);
    }
    if (em) {
      const k = String(em).toLowerCase();
      const arr = globalInviteByEmail.get(k) ?? [];
      arr.push(t);
      globalInviteByEmail.set(k, arr);
    }
  }

  const mergeGlobalInviteTokens = (cid: string, emailKey: string | null) => {
    const uniq = new Map<string, unknown>();
    for (const t of globalInviteByClientId.get(cid) ?? []) uniq.set(String((t as { id: string }).id), t);
    if (emailKey) {
      for (const t of globalInviteByEmail.get(emailKey) ?? []) uniq.set(String((t as { id: string }).id), t);
    }
    return [...uniq.values()];
  };

  const tokensByClientId = new Map<string, SheetInviteToken[]>();
  for (const t of stRows) {
    const payload = t.payload as Record<string, unknown> | null;
    if (payload?.type !== "client_hotsheet_invite") continue;
    if (String(payload.hot_sheet_id ?? "") !== hotSheetIdNorm) continue;
    const cid = typeof payload.client_id === "string" ? payload.client_id : null;
    if (!cid) continue;
    const row: SheetInviteToken = {
      id: String(t.id),
      token: String((t as { token?: string }).token ?? ""),
      accepted_at: t.accepted_at != null ? String(t.accepted_at) : null,
    };
    const arr = tokensByClientId.get(cid) ?? [];
    arr.push(row);
    tokensByClientId.set(cid, arr);
  }

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://allagentconnect.com";

  for (const clientId of uniqueIds) {
    const clientData = clientMap.get(clientId);
    if (!clientData?.email) {
      skipped++;
      continue;
    }

    const emailKey = clientData.email.toLowerCase();
    const globalMerged = mergeGlobalInviteTokens(clientId, emailKey);
    const sendDashboardInvite = !buyerLinkedCrmIds.has(clientId) && globalMerged.length === 0;

    let tokenId: string;
    let finalToken: string;
    let mode: "initial" | "resend";

    const existing = pickTokenForInvite(tokensByClientId.get(clientId) ?? []);
    if (existing?.accepted_at) {
      skipped++;
      continue;
    }
    if (!sendDashboardInvite) {
      skipped++;
      continue;
    }
    if (existing && !existing.accepted_at) {
      tokenId = existing.id;
      finalToken = existing.token;
      mode = "resend";
    } else {
      const token = crypto.randomUUID();
      const { data: newTokenRow, error: tokenError } = await supabase
        .from("share_tokens")
        .insert({
          token,
          agent_id: agentUserId,
          payload: {
            type: "client_hotsheet_invite",
            client_id: clientId,
            client_email: clientData.email,
            client_first_name: clientData.first_name,
            client_last_name: clientData.last_name,
            client_phone: clientData.phone,
            hot_sheet_id: hotSheetId,
            suppress_initial_matches: true,
          },
        })
        .select("id, token")
        .single();

      if (tokenError || !newTokenRow) {
        errors.push(`${clientData.email}: ${tokenError?.message ?? "token insert failed"}`);
        skipped++;
        continue;
      }

      tokenId = String(newTokenRow.id);
      finalToken = String((newTokenRow as { token?: string }).token ?? token);
      mode = "initial";

      void supabase.from("invite_events").insert({
        token_id: tokenId,
        hot_sheet_id: hotSheetId,
        client_id: clientId,
        client_email: clientData.email,
        event_type: "token_created",
        actor_user_id: agentUserId,
      });
    }

    const hotSheetLink =
      `${origin}/client-invite` +
      `?invitation_token=${encodeURIComponent(finalToken)}` +
      `&email=${encodeURIComponent(clientData.email)}` +
      `&agent_id=${encodeURIComponent(agentUserId)}` +
      `&client_id=${encodeURIComponent(clientId)}` +
      (clientData.first_name ? `&first_name=${encodeURIComponent(clientData.first_name)}` : "") +
      (clientData.last_name ? `&last_name=${encodeURIComponent(clientData.last_name)}` : "");

    const { error: fnError } = await supabase.functions.invoke("send-hot-sheet-invite", {
      body: {
        invitedEmail: clientData.email,
        inviterName: agentName,
        hotSheetName,
        hotSheetLink,
        hotSheetId,
        tokenId,
        clientId,
        mode,
      },
    });

    if (fnError) {
      errors.push(`${clientData.email}: ${fnError.message}`);
      continue;
    }

    const appended = tokensByClientId.get(clientId) ?? [];
    appended.push({ id: tokenId, token: finalToken, accepted_at: null });
    tokensByClientId.set(clientId, appended);

    enqueued++;
  }

  return {
    ok: errors.length === 0,
    enqueued,
    skipped,
    errors,
  };
}

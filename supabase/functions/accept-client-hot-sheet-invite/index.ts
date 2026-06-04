/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

type Body = {
  token?: string;
  password?: string;
  first_name?: string | null;
  last_name?: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: "Server is not configured for invite acceptance." }, 500);
  }

  let input: Body;
  try {
    input = (await req.json()) as Body;
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const token = (input.token ?? "").trim();
  const password = (input.password ?? "").toString();
  const firstName = (input.first_name ?? "").toString().trim() || null;
  const lastName = (input.last_name ?? "").toString().trim() || null;

  if (!token) return json({ success: false, error: "Missing invitation token." }, 400);
  if (!password || password.length < 8) {
    return json({ success: false, error: "Password must be at least 8 characters." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Load share token
  const { data: tokenRow, error: tokenErr } = await admin
    .from("share_tokens")
    .select("id, token, agent_id, payload, accepted_at, accepted_by_user_id, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (tokenErr || !tokenRow) {
    return json({ success: false, error: "This invitation link is no longer available." }, 400);
  }
  if (tokenRow.revoked_at) {
    return json({ success: false, error: "This invitation has been revoked." }, 400);
  }

  const payload = (tokenRow.payload ?? {}) as Record<string, unknown>;
  if (payload?.type !== "client_hotsheet_invite") {
    return json({ success: false, error: "This link is not a valid buyer invitation." }, 400);
  }

  const agentId = String(tokenRow.agent_id ?? "").trim();
  if (!agentId) {
    return json({ success: false, error: "Invitation is missing agent information." }, 400);
  }

  const rawTokenEmail = typeof payload.client_email === "string" ? payload.client_email : "";
  const normalizedEmail = rawTokenEmail.trim().toLowerCase();
  if (!normalizedEmail) {
    return json({ success: false, error: "Invitation is missing the buyer email." }, 400);
  }

  let crmClientId: string | null = null;
  if (typeof payload.client_id === "string" && payload.client_id.trim().length > 0) {
    crmClientId = payload.client_id.trim();
  }

  const seedFirst =
    firstName ?? (typeof payload.client_first_name === "string" ? payload.client_first_name : null);
  const seedLast =
    lastName ?? (typeof payload.client_last_name === "string" ? payload.client_last_name : null);
  const seedPhone =
    typeof payload.client_phone === "string" && payload.client_phone.trim().length > 0
      ? payload.client_phone.trim()
      : null;

  // 2. Find or create the auth user for the invited email.
  let userId: string | null = null;
  let userExisted = false;

  // Look up by email via admin listUsers filter (page through if needed).
  // For most projects the buyer is either new or unique; one page is enough.
  try {
    let page = 1;
    const perPage = 200;
    // Cap at 10 pages = 2000 users to scan; in practice we find the match on page 1.
    while (page <= 10 && !userId) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage });
      if (listErr) {
        console.error("[accept-client-hot-sheet-invite] listUsers error", listErr);
        break;
      }
      const match = (list?.users ?? []).find(
        (u) => (u.email ?? "").toLowerCase() === normalizedEmail,
      );
      if (match) {
        userId = match.id;
        userExisted = true;
        break;
      }
      if (!list?.users || list.users.length < perPage) break;
      page += 1;
    }
  } catch (err) {
    console.error("[accept-client-hot-sheet-invite] listUsers threw", err);
  }

  if (!userId) {
    // Create the user with email auto-confirmed so they can sign in immediately.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: seedFirst ?? undefined,
        last_name: seedLast ?? undefined,
        invited_via: "client_hotsheet_invite",
      },
    });
    if (createErr || !created?.user?.id) {
      console.error("[accept-client-hot-sheet-invite] createUser error", createErr);
      return json(
        { success: false, error: "We could not create your account. Please try again." },
        500,
      );
    }
    userId = created.user.id;
  } else {
    // Existing account — set the password they just submitted (gated by token possession +
    // email match) and ensure the email is confirmed so they can sign in.
    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updateErr) {
      console.error("[accept-client-hot-sheet-invite] updateUserById error", updateErr);
      return json(
        { success: false, error: "We could not update your account password. Please try again." },
        500,
      );
    }
  }

  // 3. Token idempotency / cross-user safety.
  if (tokenRow.accepted_at && tokenRow.accepted_by_user_id && tokenRow.accepted_by_user_id !== userId) {
    return json(
      { success: false, error: "This invitation has already been accepted by another account." },
      409,
    );
  }

  // 4. Upsert buyer profile.
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: normalizedEmail,
        first_name: seedFirst,
        last_name: seedLast,
        phone: seedPhone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (profileErr) {
    console.error("[accept-client-hot-sheet-invite] profile upsert error", profileErr);
  }

  // 5. Assign buyer role idempotently.
  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "buyer" }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (roleErr) {
    console.error("[accept-client-hot-sheet-invite] role upsert error", roleErr);
  }

  // 6. Activate the client_agent_relationships row.
  //    Prefer matching by CRM bridge (agent_id + crm_client_id), then by (agent_id + client_id).
  let relationshipId: string | null = null;

  if (crmClientId) {
    const { data: byCrm } = await admin
      .from("client_agent_relationships")
      .select("id, status, created_at")
      .eq("agent_id", agentId)
      .eq("crm_client_id", crmClientId)
      .order("created_at", { ascending: false });
    if (byCrm && byCrm.length > 0) {
      // Prefer an active one; otherwise newest.
      const active = byCrm.find((r) => r.status === "active");
      relationshipId = (active ?? byCrm[0]).id;
    }
  }

  if (!relationshipId) {
    const { data: byClient } = await admin
      .from("client_agent_relationships")
      .select("id")
      .eq("agent_id", agentId)
      .eq("client_id", userId)
      .limit(1);
    if (byClient && byClient.length > 0) relationshipId = byClient[0].id;
  }

  // End OTHER active relationships for this buyer (one-active-agent rule).
  await admin
    .from("client_agent_relationships")
    .update({ status: "inactive", ended_at: new Date().toISOString() })
    .eq("client_id", userId)
    .is("ended_at", null)
    .eq("status", "active")
    .neq("id", relationshipId ?? "00000000-0000-0000-0000-000000000000");

  if (relationshipId) {
    // Collapse any duplicate (agent_id, client_id) row that is not the chosen one.
    const { data: dups } = await admin
      .from("client_agent_relationships")
      .select("id")
      .eq("agent_id", agentId)
      .eq("client_id", userId)
      .neq("id", relationshipId);
    if (dups && dups.length > 0) {
      await admin
        .from("client_agent_relationships")
        .delete()
        .in(
          "id",
          dups.map((d) => d.id),
        );
    }

    const { error: relUpdateErr } = await admin
      .from("client_agent_relationships")
      .update({
        status: "active",
        ended_at: null,
        client_id: userId,
        crm_client_id: crmClientId ?? undefined,
        invitation_token: token,
      })
      .eq("id", relationshipId);
    if (relUpdateErr) {
      console.error("[accept-client-hot-sheet-invite] relationship update error", relUpdateErr);
    }
  } else {
    const { data: inserted, error: relInsertErr } = await admin
      .from("client_agent_relationships")
      .insert({
        client_id: userId,
        agent_id: agentId,
        status: "active",
        crm_client_id: crmClientId,
        invitation_token: token,
      })
      .select("id")
      .maybeSingle();
    if (relInsertErr) {
      console.error("[accept-client-hot-sheet-invite] relationship insert error", relInsertErr);
    }
    relationshipId = inserted?.id ?? null;
  }

  // 7. Mark token accepted (idempotent — preserve original values if already set).
  if (!tokenRow.accepted_at || !tokenRow.accepted_by_user_id) {
    const { error: tokenUpdErr } = await admin
      .from("share_tokens")
      .update({
        accepted_at: tokenRow.accepted_at ?? new Date().toISOString(),
        accepted_by_user_id: tokenRow.accepted_by_user_id ?? userId,
      })
      .eq("id", tokenRow.id);
    if (tokenUpdErr) {
      console.error("[accept-client-hot-sheet-invite] token update error", tokenUpdErr);
    }
  }

  return json({
    success: true,
    user_id: userId,
    user_existed: userExisted,
    relationship_id: relationshipId,
    agent_id: agentId,
    crm_client_id: crmClientId,
    email: normalizedEmail,
  });
});
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// FK tables that block auth.users deletion — mirrors revoke-buyer-auth / delete-users.
const BLOCKER_CHECKS = [
  { table: "user_roles", column: "user_id" },
  { table: "favorites", column: "user_id" },
  { table: "buyer_qualifications", column: "user_id" },
  { table: "buyer_credentials", column: "user_id" },
  { table: "notification_preferences", column: "user_id" },
  { table: "client_agent_relationships", column: "client_id" },
  { table: "conversation_participants", column: "user_id" },
] as const;

const NULLABLE_FK_CHECKS = [
  { table: "share_tokens", column: "accepted_by_user_id" },
  { table: "listing_status_history", column: "changed_by" },
  { table: "hot_sheet_comments", column: "sender_id" },
] as const;

type Json = Record<string, unknown>;

function json(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function findAuthUserIdByEmail(
  admin: any,
  email: string,
): Promise<string | null> {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return null;
    for (const u of data.users) {
      if (u.email?.toLowerCase() === target) return u.id;
    }
    if (data.users.length < perPage) return null;
    page++;
    if (page > 50) return null; // hard cap
  }
}

async function clearBlockers(admin: any, userId: string) {
  for (const { table, column } of NULLABLE_FK_CHECKS) {
    await admin.from(table).update({ [column]: null }).eq(column, userId);
  }
  for (const { table, column } of BLOCKER_CHECKS) {
    await admin.from(table).delete().eq(column, userId);
  }
  await admin.from("profiles").delete().eq("id", userId);
}

/**
 * End every active/pending client_agent_relationships row that points at this
 * buyer (matched by auth client_id OR any crm_client_id for their email).
 * Used for buyer-self and admin removal paths. For agent-initiated removal we
 * delegate to the existing agent_end_client_relationship RPC (which only ends
 * the caller agent's row).
 */
async function endAllRelationships(
  admin: any,
  buyerAuthId: string | null,
  crmClientIds: string[],
) {
  const orFilters: string[] = [];
  if (buyerAuthId) orFilters.push(`client_id.eq.${buyerAuthId}`);
  for (const id of crmClientIds) orFilters.push(`crm_client_id.eq.${id}`);
  if (orFilters.length === 0) return;

  // 1. Mark relationships inactive
  await admin
    .from("client_agent_relationships")
    .update({ status: "inactive", ended_at: new Date().toISOString() })
    .is("ended_at", null)
    .in("status", ["active", "pending"])
    .or(orFilters.join(","));

  // 2. Revoke any outstanding hot-sheet invite share_tokens for these CRM ids
  if (crmClientIds.length > 0) {
    for (const crmId of crmClientIds) {
      await admin
        .from("share_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .is("revoked_at", null)
        .eq("payload->>type", "client_hotsheet_invite")
        .eq("payload->>client_id", crmId);
    }
  }

  // 3. Detach buyer from any hot sheets they were a member of
  if (crmClientIds.length > 0) {
    await admin
      .from("hot_sheet_clients")
      .delete()
      .in("client_id", crmClientIds);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // ---- AuthN ----
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      console.error("remove-buyer: missing bearer token");
      return json({ error: "Unauthorized", reason: "missing_token" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error("remove-buyer: getUser failed", {
        message: userErr?.message,
        status: (userErr as any)?.status,
      });
      return json(
        { error: "Unauthorized", reason: "getUser_failed", detail: userErr?.message ?? null },
        401,
      );
    }
    const callerId = userData.user.id;
    const callerEmail = userData.user.email?.toLowerCase() ?? null;

    // ---- Input ----
    const body = await req.json().catch(() => ({}));
    const buyerClientId: string | undefined =
      body?.buyer_client_id ?? body?.crm_client_id ?? body?.crmClientId;
    const buyerUserIdInput: string | undefined =
      body?.buyer_user_id ?? body?.user_id ?? body?.userId;

    if (!buyerClientId && !buyerUserIdInput) {
      return json({ error: "buyer_client_id or buyer_user_id required" }, 400);
    }

    // ---- Resolve buyer identity (email + auth id + every CRM client row) ----
    let buyerEmail: string | null = null;
    let buyerAuthId: string | null = buyerUserIdInput ?? null;

    if (buyerClientId) {
      const { data: clientRow } = await admin
        .from("clients")
        .select("id, email")
        .eq("id", buyerClientId)
        .maybeSingle();
      if (clientRow?.email) buyerEmail = clientRow.email.toLowerCase();
    }

    if (!buyerEmail && buyerAuthId) {
      const { data: au } = await admin.auth.admin.getUserById(buyerAuthId);
      buyerEmail = au?.user?.email?.toLowerCase() ?? null;
    }

    if (!buyerAuthId && buyerEmail) {
      buyerAuthId = await findAuthUserIdByEmail(admin, buyerEmail);
    }

    // Collect every CRM client row for this email (covers crm_client_id matches)
    const crmClientIdSet = new Set<string>();
    if (buyerClientId) crmClientIdSet.add(buyerClientId);
    if (buyerEmail) {
      const { data: crmRows } = await admin
        .from("clients")
        .select("id")
        .ilike("email", buyerEmail);
      for (const r of crmRows ?? []) if (r?.id) crmClientIdSet.add(String(r.id));
    }
    const crmClientIds = Array.from(crmClientIdSet);

    if (!buyerEmail && !buyerAuthId && crmClientIds.length === 0) {
      return json({
        success: true,
        status: "skipped",
        reason: "buyer_not_found",
        auth_deleted: false,
      });
    }

    // ---- AuthZ ----
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const callerRoleSet = new Set(
      (callerRoles ?? []).map((r: any) => String(r.role)),
    );
    const isAdmin = callerRoleSet.has("admin");
    const isBuyerSelf =
      (buyerAuthId && callerId === buyerAuthId) ||
      (!!callerEmail && !!buyerEmail && callerEmail === buyerEmail);

    // Is caller an agent currently linked to this buyer?
    let isOwningAgent = false;
    {
      const orFilters: string[] = [];
      if (buyerAuthId) orFilters.push(`client_id.eq.${buyerAuthId}`);
      for (const id of crmClientIds) orFilters.push(`crm_client_id.eq.${id}`);
      if (orFilters.length > 0) {
        const { data: rels } = await admin
          .from("client_agent_relationships")
          .select("id")
          .eq("agent_id", callerId)
          .is("ended_at", null)
          .in("status", ["active", "pending"])
          .or(orFilters.join(","));
        isOwningAgent = (rels?.length ?? 0) > 0;
      }
    }

    if (!isAdmin && !isBuyerSelf && !isOwningAgent) {
      return json({ error: "Forbidden" }, 403);
    }

    // ---- 1. End relationship(s) ----
    if (isOwningAgent && !isAdmin && !isBuyerSelf) {
      // Use existing canonical RPC so hot-sheet teardown + conversation
      // archival run exactly like today's agent-side removal.
      const idForRpc = buyerClientId ?? buyerAuthId;
      if (idForRpc) {
        const { error: rpcErr } = await userClient.rpc(
          "agent_end_client_relationship",
          { p_client_id: idForRpc },
        );
        if (rpcErr) {
          console.error("remove-buyer agent_end_client_relationship error:", rpcErr);
          // Non-fatal: relationship may already be ended. Continue to verify state.
        }
      }
    } else {
      // Buyer-self or admin: end ALL active relationships for this buyer.
      await endAllRelationships(admin, buyerAuthId, crmClientIds);
    }

    // ---- 2. Safety gate: agent/admin protection ----
    if (buyerAuthId) {
      const { data: buyerRoles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", buyerAuthId);
      const roleSet = new Set((buyerRoles ?? []).map((r: any) => String(r.role)));
      const isRealAdmin = roleSet.has("admin");
      const hasAgentRole = roleSet.has("agent");

      // Never auto-purge a true admin.
      if (isRealAdmin) {
        await admin.from("audit_logs").insert({
          action: "remove_buyer_skipped",
          target_user_id: buyerAuthId,
          actor_user_id: callerId,
          metadata: { reason: "user_is_admin" },
        }).then(() => null, () => null);
        return json({
          success: true,
          status: "relationship_ended_only",
          reason: "user_is_agent_or_admin",
          auth_deleted: false,
        });
      }

      if (hasAgentRole) {
        // Distinguish a *real* agent (has agent_settings / agent_profiles /
        // published listings) from a buyer with a stale `agent` role row.
        const [{ count: settingsCount }, { count: profilesCount }, { count: listingsCount }] = await Promise.all([
          admin.from("agent_settings").select("*", { count: "exact", head: true }).eq("user_id", buyerAuthId),
          admin.from("agent_profiles").select("*", { count: "exact", head: true }).eq("user_id", buyerAuthId),
          admin.from("listings").select("*", { count: "exact", head: true }).eq("agent_id", buyerAuthId),
        ]);
        const isRealAgent =
          (settingsCount ?? 0) > 0 ||
          (profilesCount ?? 0) > 0 ||
          (listingsCount ?? 0) > 0;

        // Agent-scope caller must never delete a real agent. For admin/self
        // scope we can self-heal a stale role.
        const isAgentScopeCaller = isOwningAgent && !isAdmin && !isBuyerSelf;
        if (isRealAgent || isAgentScopeCaller) {
          await admin.from("audit_logs").insert({
            action: "remove_buyer_skipped",
            target_user_id: buyerAuthId,
            actor_user_id: callerId,
            metadata: {
              reason: "user_is_agent_or_admin",
              is_real_agent: isRealAgent,
              scope: isAdmin ? "admin" : isBuyerSelf ? "self" : "agent",
            },
          }).then(() => null, () => null);
          return json({
            success: true,
            status: "relationship_ended_only",
            reason: "user_is_agent_or_admin",
            auth_deleted: false,
          });
        }

        // Stale agent role on a buyer — heal it and continue with purge.
        await admin.from("user_roles").delete().eq("user_id", buyerAuthId).eq("role", "agent");
        await admin.from("audit_logs").insert({
          action: "remove_buyer_healed_stale_role",
          target_user_id: buyerAuthId,
          actor_user_id: callerId,
          metadata: { removed_role: "agent" },
        }).then(() => null, () => null);
      }
    }

    // ---- 3. Safety gate: another agent still linked? ----
    {
      const orFilters: string[] = [];
      if (buyerAuthId) orFilters.push(`client_id.eq.${buyerAuthId}`);
      for (const id of crmClientIds) orFilters.push(`crm_client_id.eq.${id}`);
      if (orFilters.length > 0) {
        const { data: stillActive } = await admin
          .from("client_agent_relationships")
          .select("id, agent_id")
          .is("ended_at", null)
          .in("status", ["active", "pending"])
          .or(orFilters.join(","));
        if ((stillActive?.length ?? 0) > 0) {
          return json({
            success: true,
            status: "relationship_ended_only",
            reason: "linked_to_other_agent",
            auth_deleted: false,
          });
        }
      }
    }

    // ---- 4. No auth user → nothing more to do ----
    if (!buyerAuthId) {
      return json({
        success: true,
        status: "removed",
        reason: "no_auth_user",
        auth_deleted: false,
      });
    }

    // ---- 5. Clean FK blockers + delete auth user ----
    await clearBlockers(admin, buyerAuthId);
    const { error: delErr } = await admin.auth.admin.deleteUser(buyerAuthId);
    if (delErr) {
      console.error("remove-buyer deleteUser error:", delErr.message);
      return json(
        {
          status: "relationship_ended_only",
          reason: "auth_delete_failed",
          auth_deleted: false,
          error: delErr.message,
        },
        500,
      );
    }

    // ---- 6. Verify auth user is actually gone ----
    const { data: verifyById } = await admin.auth.admin.getUserById(buyerAuthId);
    let stillExists = !!verifyById?.user;
    if (!stillExists && buyerEmail) {
      const stillId = await findAuthUserIdByEmail(admin, buyerEmail);
      if (stillId) stillExists = true;
    }
    if (stillExists) {
      return json(
        {
          status: "relationship_ended_only",
          reason: "auth_delete_failed",
          auth_deleted: false,
        },
        500,
      );
    }

    console.log(
      `remove-buyer: removed auth user ${buyerAuthId} (${buyerEmail ?? "?"}) by caller ${callerId}`,
    );
    return json({
      success: true,
      status: "removed",
      auth_deleted: true,
      deleted_user_id: buyerAuthId,
    });
  } catch (err: any) {
    console.error("remove-buyer exception:", err);
    return json({ error: err?.message ?? String(err) }, 500);
  }
});
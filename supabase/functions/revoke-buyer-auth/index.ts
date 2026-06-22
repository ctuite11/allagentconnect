import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Mirror of delete-users blocker tables — order matters for FK cleanup.
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

async function clearBlockers(supabase: any, userId: string) {
  for (const { table, column } of NULLABLE_FK_CHECKS) {
    await supabase.from(table).update({ [column]: null }).eq(column, userId);
  }
  for (const { table, column } of BLOCKER_CHECKS) {
    await supabase.from(table).delete().eq(column, userId);
  }
  await supabase.from("profiles").delete().eq("id", userId);
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

    // Verify caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const buyerClientId: string | undefined = body?.buyer_client_id;
    if (!buyerClientId || typeof buyerClientId !== "string") {
      return new Response(
        JSON.stringify({ error: "buyer_client_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Lookup buyer email from clients
    const { data: clientRow, error: clientErr } = await admin
      .from("clients")
      .select("id, email")
      .eq("id", buyerClientId)
      .maybeSingle();

    if (clientErr || !clientRow?.email) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "client_not_found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const buyerEmail = clientRow.email.toLowerCase();

    // Find auth user by email (paginated)
    let buyerAuthId: string | null = null;
    let page = 1;
    const perPage = 200;
    while (!buyerAuthId) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (listErr) break;
      for (const u of list.users) {
        if (u.email?.toLowerCase() === buyerEmail) {
          buyerAuthId = u.id;
          break;
        }
      }
      if (list.users.length < perPage) break;
      page++;
    }

    if (!buyerAuthId) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_auth_user" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Safety gate 1: not an agent or admin
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", buyerAuthId);
    const protectedRole = (roles ?? []).some(
      (r: any) => r.role === "agent" || r.role === "admin",
    );
    if (protectedRole) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "user_is_agent_or_admin" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Safety gate 2: no other active/pending agent relationships.
    // (agent_end_client_relationship already ended this caller's row, so any
    // remaining active/pending row means another agent still owns this buyer.)
    // Match on auth client_id AND any CRM client row for this email (crm_client_id).
    const { data: crmClientsByEmail } = await admin
      .from("clients")
      .select("id")
      .ilike("email", buyerEmail);

    const crmClientIdSet = new Set<string>([buyerClientId]);
    for (const row of crmClientsByEmail ?? []) {
      if (row?.id) crmClientIdSet.add(String(row.id));
    }

    const orFilters: string[] = [`client_id.eq.${buyerAuthId}`];
    for (const crmId of crmClientIdSet) {
      orFilters.push(`crm_client_id.eq.${crmId}`);
    }

    const { data: activeRels } = await admin
      .from("client_agent_relationships")
      .select("id, agent_id, status, ended_at, client_id, crm_client_id")
      .is("ended_at", null)
      .in("status", ["active", "pending"])
      .or(orFilters.join(","));
    if ((activeRels?.length ?? 0) > 0) {
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: "active_relationship_with_other_agent",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Clear FK blockers and delete the auth user
    await clearBlockers(admin, buyerAuthId);
    const { error: delErr } = await admin.auth.admin.deleteUser(buyerAuthId);
    if (delErr) {
      console.error("revoke-buyer-auth delete error:", delErr.message);
      return new Response(
        JSON.stringify({ success: false, error: delErr.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `revoke-buyer-auth: deleted auth user ${buyerAuthId} (${buyerEmail}) on behalf of agent ${callerId}`,
    );
    return new Response(
      JSON.stringify({ success: true, deleted_user_id: buyerAuthId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("revoke-buyer-auth exception:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
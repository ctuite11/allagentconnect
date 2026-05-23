import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const results: any[] = [];
    let page = 1;
    const perPage = 200;
    while (true) {
      const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) break;
      for (const u of list.users) {
        if (!u.email) continue;
        // skip agents/admins
        const { data: roles } = await admin
          .from("user_roles").select("role").eq("user_id", u.id);
        if ((roles ?? []).some((r: any) => r.role === "agent" || r.role === "admin")) continue;
        // skip if any active/pending relationship still exists
        const { data: rels } = await admin
          .from("client_agent_relationships")
          .select("id").eq("client_id", u.id).is("ended_at", null)
          .in("status", ["active", "pending"]);
        if ((rels?.length ?? 0) > 0) continue;
        // orphan: clear FKs and delete
        for (const { table, column } of NULLABLE_FK_CHECKS) {
          await admin.from(table).update({ [column]: null }).eq(column, u.id);
        }
        for (const { table, column } of BLOCKER_CHECKS) {
          await admin.from(table).delete().eq(column, u.id);
        }
        await admin.from("profiles").delete().eq("id", u.id);
        const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
        results.push({ id: u.id, email: u.email, deleted: !delErr, error: delErr?.message });
      }
      if (list.users.length < perPage) break;
      page++;
    }
    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
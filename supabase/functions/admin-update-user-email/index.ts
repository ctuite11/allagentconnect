// @auth-classification: admin-jwt (service-role also permitted)
//
// Corrects a user's email address across auth + app tables.
// Used when an agent was created with a typo'd address, so setup/login
// links bounce at the recipient's mail server.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json(500, { error: "Server misconfigured" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (bearer !== serviceKey) {
      if (!bearer) return json(401, { error: "Unauthorized" });
      const { data: caller } = await admin.auth.getUser(bearer);
      if (!caller?.user) return json(401, { error: "Unauthorized" });
      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: caller.user.id,
        _role: "admin",
      });
      if (isAdmin !== true) return json(403, { error: "Forbidden" });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    const newEmail = typeof body.new_email === "string"
      ? body.new_email.trim().toLowerCase()
      : "";

    if (!UUID_RE.test(userId)) return json(400, { error: "user_id (uuid) is required" });
    if (!EMAIL_RE.test(newEmail)) return json(400, { error: "new_email must be a valid email" });

    const { data: target, error: targetErr } = await admin.auth.admin.getUserById(userId);
    const oldEmail = target?.user?.email?.trim().toLowerCase() ?? null;
    if (targetErr || !oldEmail) return json(404, { error: "No auth user for that id" });
    if (oldEmail === newEmail) return json(200, { success: true, unchanged: true, email: newEmail });

    // Reject if the new address already belongs to someone else.
    const { data: existing } = await admin.rpc("auth_user_exists_by_email", { _email: newEmail })
      .then((r) => r, () => ({ data: null }));
    if (existing === true) return json(409, { error: "That email already belongs to another account" });

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: true,
    });
    if (updErr) {
      console.error("[admin-update-user-email] updateUserById failed:", updErr.message);
      return json(500, { error: updErr.message });
    }

    const results: Record<string, string> = {};
    const tables: Array<[string, string, string]> = [
      ["profiles", "id", "email"],
      ["agent_profiles", "id", "email"],
    ];
    for (const [table, idCol, emailCol] of tables) {
      const { error } = await admin.from(table).update({ [emailCol]: newEmail }).eq(idCol, userId);
      results[table] = error ? `error: ${error.message}` : "updated";
    }

    const { error: pvErr } = await admin
      .from("pending_verifications")
      .update({ email: newEmail })
      .eq("email", oldEmail);
    results["pending_verifications"] = pvErr ? `error: ${pvErr.message}` : "updated";

    console.log(`[admin-update-user-email] ${userId}: ${oldEmail} -> ${newEmail}`);
    return json(200, { success: true, userId, oldEmail, newEmail, results });
  } catch (err) {
    console.error("[admin-update-user-email] error:", (err as Error).message);
    return json(500, { error: "Unexpected error" });
  }
});

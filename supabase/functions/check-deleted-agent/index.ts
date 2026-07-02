import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findDeletedAgent } from "../_shared/checkDeletedAgent.ts";

/**
 * Phase 4 — admin-only lookup used by admin UI (Admin Approvals, Admin
 * Create Agent, License Verified resend) to detect that an email was
 * previously deleted as an agent. Read-only, no mutations, no side effects.
 *
 * Response shape:
 *   { deleted: false, match: null }
 *   { deleted: true,  match: { id, original_user_id, email, ... } }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return json(401, { error: "Authorization required" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Admin gate — this endpoint returns archived personal data, so restrict
  // to admins even though deleted_users RLS would also allow it.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !caller) {
    return json(401, { error: "Invalid session" });
  }
  const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
    _user_id: caller.id,
    _role: "admin",
  });
  if (roleErr) {
    console.error("[check-deleted-agent] role check error:", roleErr.message);
    return json(500, { error: "Failed to verify admin role" });
  }
  if (isAdmin !== true) {
    return json(403, { error: "Admin access required" });
  }

  let email: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.email === "string") email = body.email;
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  if (!email) {
    return json(400, { error: "email is required" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const match = await findDeletedAgent(admin, email);
  return json(200, { deleted: Boolean(match), match });
});
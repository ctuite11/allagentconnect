import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SETUP_REDIRECT =
  "https://allagentconnect.com/auth/callback?type=recovery&setup=1";

interface BodyInput {
  userId?: string;
  email?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // ── Admin gate: require an authenticated admin caller. ──────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: caller.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // ── Resolve target email ────────────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as BodyInput;
    let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email && body.userId) {
      const { data: profile } = await admin
        .from("agent_profiles")
        .select("email")
        .eq("id", body.userId)
        .maybeSingle();
      email = (profile?.email ?? "").toLowerCase();
      if (!email) {
        const { data: u } = await admin.auth.admin.getUserById(body.userId);
        email = (u?.user?.email ?? "").toLowerCase();
      }
    }

    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Could not resolve agent email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: SETUP_REDIRECT },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      // Do not echo provider error detail.
      console.error("[generate-agent-setup-link] generateLink failed");
      return new Response(
        JSON.stringify({ error: "Failed to generate setup link" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // IMPORTANT: never log the setup URL.
    return new Response(
      JSON.stringify({ setupUrl: linkData.properties.action_link, email }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err) {
    console.error("[generate-agent-setup-link] error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: "Unexpected error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
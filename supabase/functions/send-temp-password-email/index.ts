import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TEMPLATE = "agent-temp-password";
const SUBJECT = "Your All Agent Connect sign-in details";
const REPLY_TO = "hello@allagentconnect.com";

async function shortHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ error: "Server misconfigured" }, 500);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller?.user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: caller.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !email.includes("@") || password.length < 8) {
      return json({ error: "Invalid email or password" }, 400);
    }

    // Resolve the agent's first name server-side (never trusted from the client).
    let recipientName: string | null = null;
    const { data: profile } = await admin
      .from("agent_profiles")
      .select("first_name")
      .ilike("email", email)
      .maybeSingle();
    if (profile?.first_name && String(profile.first_name).trim()) {
      recipientName = String(profile.first_name).trim();
    }

    const idempotencyKey = `temp-password:${email}:${await shortHash(password)}`;

    const { data: existing } = await admin
      .from("email_jobs")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing?.id) {
      return json({ success: true, deduped: true, jobId: existing.id }, 200);
    }

    const signInUrl = `https://allagentconnect.com/auth?email=${encodeURIComponent(email)}`;

    const { data: inserted, error: insertError } = await admin
      .from("email_jobs")
      .insert({
        idempotency_key: idempotencyKey,
        payload: {
          provider: "resend",
          template: TEMPLATE,
          to: email,
          subject: SUBJECT,
          reply_to: REPLY_TO,
          variables: {
            recipientName,
            agentEmail: email,
            password,
            signInUrl,
          },
          idempotency_key: idempotencyKey,
        },
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      if (insertError.code === "23505") {
        return json({ success: true, deduped: true }, 200);
      }
      // Never echo the payload — it carries the password.
      console.error("[send-temp-password-email] enqueue failed:", insertError.code);
      return json({ error: "Failed to queue email" }, 500);
    }

    console.log("[send-temp-password-email] enqueued job", inserted?.id);
    return json({ success: true, jobId: inserted?.id ?? null }, 200);
  } catch (err) {
    console.error("[send-temp-password-email] error:", (err as Error).name);
    return json({ error: "Unexpected error" }, 500);
  }
});
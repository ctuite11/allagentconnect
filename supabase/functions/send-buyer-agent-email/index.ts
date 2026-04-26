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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1) Authenticate caller
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ success: false, error: "Missing auth token" }, 401);

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userData?.user) return json({ success: false, error: "Unauthorized" }, 401);

  const userId = userData.user.id;
  const buyerEmail = (userData.user.email ?? "").trim();
  if (!buyerEmail) return json({ success: false, error: "Buyer email not found" }, 400);

  // 2) Parse body
  let input: { subject?: string; message?: string };
  try {
    input = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const message = input.message?.trim();
  if (!message) return json({ success: false, error: "message is required" }, 400);

  const finalSubject =
    (input.subject?.trim() || "Message from your client via AllAgentConnect").slice(0, 200);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // 3) Resolve active agent from client_agent_relationships
  const { data: rel, error: relErr } = await supabaseAdmin
    .from("client_agent_relationships")
    .select("agent_id")
    .eq("client_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (relErr) return json({ success: false, error: relErr.message }, 500);
  if (!rel?.agent_id) return json({ success: false, error: "No active agent relationship" }, 400);

  const agentId = rel.agent_id as string;

  // 4) Resolve agent email/name from agent_profiles (fallback to profiles)
  let agentEmail: string | null = null;
  let agentName: string | null = null;

  const { data: agentProfile } = await supabaseAdmin
    .from("agent_profiles")
    .select("id, email, first_name, last_name")
    .eq("id", agentId)
    .maybeSingle();

  if (agentProfile) {
    agentEmail = agentProfile.email ?? null;
    agentName =
      [agentProfile.first_name, agentProfile.last_name].filter(Boolean).join(" ").trim() || null;
  }

  if (!agentEmail) {
    const { data: fallback } = await supabaseAdmin
      .from("profiles")
      .select("id, email, first_name, last_name")
      .eq("id", agentId)
      .maybeSingle();

    if (fallback) {
      agentEmail = fallback.email ?? null;
      agentName =
        [fallback.first_name, fallback.last_name].filter(Boolean).join(" ").trim() || null;
    }
  }

  if (!agentEmail) return json({ success: false, error: "Agent email not found" }, 400);

  // 5) Resolve buyer name from profiles
  const { data: buyerProfile } = await supabaseAdmin
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", userId)
    .maybeSingle();

  const buyerName =
    [buyerProfile?.first_name, buyerProfile?.last_name].filter(Boolean).join(" ").trim() ||
    "Your client";

  // 6) Enqueue email job
  const { error: jobErr } = await supabaseAdmin
    .from("email_jobs")
    .insert({
      payload: {
        provider: "resend",
        template: "client-agent-message",
        to: agentEmail,
        subject: finalSubject,
        variables: {
          agentName: agentName || "Agent",
          clientName: buyerName,
          clientEmail: buyerEmail,
          subject: finalSubject,
          message,
        },
        reply_to: buyerEmail,
      },
    });

  if (jobErr) {
    return json({ success: false, error: `Email enqueue failed: ${jobErr.message}` }, 500);
  }

  return json({ success: true });
});

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

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!jwt) return json({ success: false, error: "Missing auth token" }, 401);

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userData?.user) return json({ success: false, error: "Unauthorized" }, 401);

  const userId = userData.user.id;

  let input: { clientId?: string; subject?: string; message?: string };
  try {
    input = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const clientId = input.clientId?.trim();
  const message = input.message?.trim();
  if (!clientId) return json({ success: false, error: "clientId is required" }, 400);
  if (!message) return json({ success: false, error: "message is required" }, 400);

  const finalSubject =
    (input.subject?.trim() || "Message from your client via AllAgentConnect").slice(0, 200);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // 1) Buyer email via profiles (email bridge)
  const { data: buyerProfile, error: buyerErr } = await supabaseAdmin
    .from("profiles")
    .select("id, email, first_name, last_name")
    .eq("id", userId)
    .maybeSingle();

  if (buyerErr) return json({ success: false, error: buyerErr.message }, 500);
  const buyerEmail = (buyerProfile?.email ?? "").trim();
  if (!buyerEmail) return json({ success: false, error: "Buyer email not found" }, 400);

  // 2) CRM client row
  const { data: crmClient, error: crmErr } = await supabaseAdmin
    .from("clients")
    .select("id, agent_id, first_name, last_name, email")
    .eq("id", clientId)
    .maybeSingle();

  if (crmErr) return json({ success: false, error: crmErr.message }, 500);
  if (!crmClient) return json({ success: false, error: "Client not found" }, 404);

  const crmEmail = (crmClient.email ?? "").trim();
  if (!crmEmail) return json({ success: false, error: "Client email missing" }, 400);

  // Email-bridge validation
  if (crmEmail.toLowerCase() !== buyerEmail.toLowerCase()) {
    return json({ success: false, error: "Forbidden" }, 403);
  }

  const agentId = crmClient.agent_id as string | null;
  if (!agentId) return json({ success: false, error: "No agent assigned" }, 400);

  // 3) Resolve agent email/name
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

  const clientName =
    [crmClient.first_name, crmClient.last_name].filter(Boolean).join(" ").trim() || "Your client";

  // 4) Insert message row
  const { data: msgRow, error: msgErr } = await supabaseAdmin
    .from("client_agent_messages")
    .insert({
      client_id: clientId,
      agent_id: agentId,
      sender_user_id: userId,
      subject: finalSubject,
      message,
    })
    .select("id")
    .single();

  if (msgErr) return json({ success: false, error: msgErr.message }, 500);

  // 5) Enqueue email job
  const { data: jobRow, error: jobErr } = await supabaseAdmin
    .from("email_jobs")
    .insert({
      stream: "transactional",
      payload: {
        provider: "resend",
        template: "client-agent-message",
        to: agentEmail,
        subject: finalSubject,
        variables: {
          agentName: agentName || "Agent",
          clientName,
          clientEmail: buyerEmail,
          subject: finalSubject,
          message,
        },
        reply_to: buyerEmail,
      },
    })
    .select("id")
    .single();

  if (jobErr) {
    return json(
      { success: false, error: `Message saved, but email enqueue failed: ${jobErr.message}` },
      500,
    );
  }

  // 6) Backfill email_job_id
  await supabaseAdmin
    .from("client_agent_messages")
    .update({ email_job_id: jobRow.id })
    .eq("id", msgRow.id);

  return json({ success: true });
});

/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

  // Authenticate caller (must be the agent)
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ success: false, error: "Missing auth token" }, 401);
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json({ success: false, error: "Missing auth token" }, 401);
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: authHeader,
    },
  });
  if (!userResponse.ok) {
    const detail = await userResponse.text().catch(() => "");
    console.warn("[send-agent-client-email] auth user lookup failed", {
      status: userResponse.status,
      detail,
    });
    return json({ success: false, error: "Unauthorized: invalid or expired session" }, 401);
  }

  const authUser = (await userResponse.json()) as { id?: string; email?: string };
  if (!authUser.id) return json({ success: false, error: "Unauthorized: invalid session" }, 401);

  const agentId = authUser.id;
  const authEmail = authUser.email ?? null;

  // Parse + validate body
  let body: {
    clientId?: string;
    recipientEmail?: string;
    recipientName?: string;
    subject?: string;
    message?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const subject = (body.subject ?? "").trim().slice(0, 200);
  const message = (body.message ?? "").trim();
  if (!subject) return json({ success: false, error: "subject is required" }, 400);
  if (!message) return json({ success: false, error: "message is required" }, 400);
  if (message.length > 10000) {
    return json({ success: false, error: "message too long" }, 400);
  }

  const supaAdmin = createClient(supabaseUrl, serviceRoleKey);

  console.log("[send-agent-client-email] authenticated", { agentId });

  // Resolve recipient
  let recipientEmail = (body.recipientEmail ?? "").trim();
  let recipientName = (body.recipientName ?? "").trim();

  if (body.clientId) {
    const { data: client, error: clientErr } = await supaAdmin
      .from("clients")
      .select("id, agent_id, email, first_name, last_name")
      .eq("id", body.clientId)
      .maybeSingle();

    if (clientErr) {
      console.error("[send-agent-client-email] client lookup failed", clientErr);
      return json({ success: false, error: clientErr.message }, 500);
    }
    if (!client) return json({ success: false, error: "Client not found" }, 404);
    if (client.agent_id !== agentId) {
      return json({ success: false, error: "Forbidden" }, 403);
    }

    if (!recipientEmail) recipientEmail = (client.email ?? "").trim();
    if (!recipientName) {
      recipientName =
        [client.first_name, client.last_name].filter(Boolean).join(" ").trim();
    }
  }

  if (!recipientEmail) {
    return json({ success: false, error: "recipientEmail is required" }, 400);
  }
  // Basic email shape check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return json({ success: false, error: "Invalid recipient email" }, 400);
  }

  // Resolve agent identity
  let agentEmail: string | null = null;
  let agentName: string | null = null;
  let agentPhone: string | null = null;

  const { data: agentProfile } = await supaAdmin
    .from("agent_profiles")
    .select("id, email, first_name, last_name, cell_phone, phone")
    .eq("id", agentId)
    .maybeSingle();

  if (agentProfile) {
    agentEmail = agentProfile.email ?? null;
    agentName =
      [agentProfile.first_name, agentProfile.last_name].filter(Boolean).join(" ").trim() ||
      null;
    agentPhone = agentProfile.cell_phone || agentProfile.phone || null;
  }

  if (!agentEmail) {
    const { data: fallback } = await supaAdmin
      .from("profiles")
      .select("id, email, first_name, last_name")
      .eq("id", agentId)
      .maybeSingle();
    if (fallback) {
      agentEmail = fallback.email ?? authEmail ?? null;
      agentName =
        agentName ||
        [fallback.first_name, fallback.last_name].filter(Boolean).join(" ").trim() ||
        null;
    }
  }

  agentEmail = agentEmail || authEmail || null;
  if (!agentEmail) return json({ success: false, error: "Agent email not found" }, 400);

  // Deliverability (locked):
  // - From: canonical brand only via sendEmail/transactionalSender — NEVER
  //   `${agentName} <hello@mail…>` (rotating display names damaged reputation).
  // - Reply-To: agent's real inbox so replies route correctly.
  // - Agent identity: subject/body/signature only — not in From.
  // - No category, no List-Unsubscribe, no tracking — same as hot-sheet-alert jobs.

  // Enqueue exactly one transactional email job
  const { data: jobRow, error: jobErr } = await supaAdmin
    .from("email_jobs")
    .insert({
      stream: "transactional",
      payload: {
        provider: "resend",
        template: "agent-client-email",
        to: recipientEmail,
        subject,
        variables: {
          clientName: recipientName || "there",
          agentName: agentName || "Your agent",
          agentEmail,
          agentPhone: agentPhone || "",
          subject,
          message,
        },
        reply_to: agentEmail,
      },
    })
    .select("id")
    .single();

  if (jobErr) {
    console.error("[send-agent-client-email] email enqueue failed", jobErr);
    return json({ success: false, error: `Email enqueue failed: ${jobErr.message}` }, 500);
  }

  // Best-effort kick (cron also drains the queue)
  try {
    await fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: "{}",
    });
  } catch (e) {
    console.warn("[send-agent-client-email] kick failed (non-fatal):", e);
  }

  return json({ success: true, jobId: jobRow.id });
});
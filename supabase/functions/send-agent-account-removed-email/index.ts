import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Notifies verified-but-never-activated agents that an admin removed their account.
 *
 * Eligibility (checked against live agent_settings BEFORE the caller deletes rows):
 *   agent_status = 'verified' AND account_activated_at IS NULL
 *
 * Uses the standard email_jobs → kick-email-queue pipeline.
 * Callers must invoke this before admin_delete_agent so settings still exist.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEMPLATE = "agent-account-removed";
const SUBJECT = "Your All Agent Connect account was removed";
const REPLY_TO = "chris@allagentconnect.com";

interface SendRequest {
  agentId: string;
  email?: string;
  firstName?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SendRequest;
    const agentId = typeof body?.agentId === "string" ? body.agentId.trim() : "";
    if (!agentId) {
      return new Response(
        JSON.stringify({ success: false, error: "agentId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server misconfigured: missing Supabase service credentials");
    }
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Eligibility must be evaluated while agent_settings still exist.
    const { data: settings, error: settingsErr } = await admin
      .from("agent_settings")
      .select("agent_status, account_activated_at")
      .eq("user_id", agentId)
      .maybeSingle();

    if (settingsErr) {
      console.error("[send-agent-account-removed-email] settings lookup failed:", settingsErr);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to load agent settings" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const verified = settings?.agent_status === "verified";
    const notActivated = !settings?.account_activated_at;
    if (!verified || !notActivated) {
      console.log(
        `[send-agent-account-removed-email] skipped ${agentId}: verified=${verified} activated=${!!settings?.account_activated_at}`,
      );
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: !verified ? "not_verified" : "already_activated",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    let recipientEmail =
      typeof body.email === "string" && body.email.includes("@") ? body.email.trim() : "";
    let recipientName =
      typeof body.firstName === "string" && body.firstName.trim()
        ? body.firstName.trim()
        : "";

    if (!recipientEmail || !recipientName) {
      const { data: profile } = await admin
        .from("agent_profiles")
        .select("email, first_name")
        .eq("id", agentId)
        .maybeSingle();
      recipientEmail = recipientEmail || profile?.email || "";
      recipientName = recipientName || profile?.first_name || "there";
    }

    if (!recipientEmail || !recipientEmail.includes("@")) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid recipient email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const recipientLc = recipientEmail.toLowerCase();
    const idempotencyKey = `${TEMPLATE}:${agentId}`;

    const { data: existing } = await admin
      .from("email_jobs")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing?.id) {
      return new Response(
        JSON.stringify({ success: true, deduped: true, jobId: existing.id }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { data: inserted, error: insertError } = await admin
      .from("email_jobs")
      .insert({
        stream: "transactional",
        idempotency_key: idempotencyKey,
        payload: {
          provider: "resend",
          template: TEMPLATE,
          to: recipientEmail,
          subject: SUBJECT,
          reply_to: REPLY_TO,
          variables: { recipientName },
          idempotency_key: idempotencyKey,
        },
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      if (insertError.code === "23505") {
        return new Response(
          JSON.stringify({ success: true, deduped: true }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
      console.error("[send-agent-account-removed-email] enqueue failed:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    void fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }).catch((err) => {
      console.warn("[send-agent-account-removed-email] kick-email-queue failed:", err);
    });

    console.log(
      `[send-agent-account-removed-email] queued for ${recipientLc} (agent ${agentId}) job=${inserted?.id}`,
    );

    return new Response(
      JSON.stringify({ success: true, jobId: inserted?.id ?? null, to: recipientEmail }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-agent-account-removed-email] error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});

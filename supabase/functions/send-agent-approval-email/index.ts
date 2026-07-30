import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ApprovalEmailRequest {
  userId?: string | null;
  email?: string;
  firstName?: string;
  approved: boolean;
  isEarlyAccess?: boolean;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, firstName, approved, isEarlyAccess }: ApprovalEmailRequest = await req.json();

    if (!isEarlyAccess && !userId) {
      console.error("No userId provided for non-early-access agent");
      return new Response(
        JSON.stringify({ error: "userId is required for real agents" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (isEarlyAccess && !email) {
      console.error("No email provided for early access agent");
      return new Response(
        JSON.stringify({ error: "email is required for early access agents" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Processing ${approved ? 'approval' : 'rejection'} email for ${isEarlyAccess ? 'early access' : 'real'} agent: ${email || userId}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let recipientEmail = email;
    let recipientName = firstName || "Agent";

    if (!isEarlyAccess && (!recipientEmail || !recipientName || recipientName === "Agent")) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("agent_profiles")
        .select("email, first_name")
        .eq("id", userId)
        .maybeSingle();

      if (profileError || !profile?.email) {
        console.error("Error fetching agent profile:", profileError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch agent profile" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      recipientEmail = email || profile.email;
      recipientName = firstName || profile.first_name || "Agent";
    }

    console.log(`Sending ${approved ? 'approval' : 'rejection'} email to ${recipientEmail} (${recipientName})`);

    // Approval does NOT create the account — the agent already set a password
    // when requesting access. The CTA simply sends them to /auth to sign in,
    // with their email prefilled when available.
    const signInUrl = approved && recipientEmail
      ? `https://allagentconnect.com/auth?email=${encodeURIComponent(recipientEmail)}`
      : "https://allagentconnect.com/auth";

    // Unified pipeline: enqueue into email_jobs and let process-email-queue
    // handle From/Reply-To/plain-text/suppression/idempotency/retry — same as
    // every other AAC transactional email (listing-share, hot-sheet, etc).
    const template = approved ? "agent-approval-accepted" : "agent-approval-rejected";
    // Pure ASCII subjects only — apostrophes and em-dashes force RFC-2047
    // encoded-word wrapping (=?UTF-8?Q?...?=), which Yahoo down-scores on
    // transactional mail.
    const subject = approved
      ? "Your All Agent Connect account is ready"
      : "All Agent Connect account verification update";
    const variables = approved
      ? { recipientName, signInUrl }
      : { recipientName };

    const idempotencyKey = `agent-approval:${approved ? "accept" : "reject"}:${userId ?? recipientEmail}`;

    const { error: insertError } = await supabaseAdmin
      .from("email_jobs")
      .insert({
        stream: "transactional",
        payload: {
          provider: "resend",
          template,
          to: recipientEmail,
          subject,
          reply_to: "hello@allagentconnect.com",
          variables,
          idempotency_key: idempotencyKey,
        },
      });

    if (insertError) {
      console.error("[send-agent-approval-email] Failed to enqueue job:", insertError);
      return new Response(
        JSON.stringify({ error: `Failed to queue email: ${insertError.message}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    console.log(`[send-agent-approval-email] Job enqueued for ${recipientEmail}`);

    // Only mark approval_email_sent after a successful enqueue.
    if (approved && userId && !isEarlyAccess) {
      const { error: updateError } = await supabaseAdmin
        .from("agent_settings")
        .update({ approval_email_sent: true })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Warning: Failed to update approval_email_sent flag:", updateError);
      }
    }

    // Best-effort: kick the queue so the send runs immediately.
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/kick-email-queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
        },
        body: "{}",
      });
    } catch (e) {
      console.warn("[send-agent-approval-email] kick-email-queue failed (non-fatal):", e);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email queued for delivery" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );

  } catch (error: any) {
    console.error("Error in send-agent-approval-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

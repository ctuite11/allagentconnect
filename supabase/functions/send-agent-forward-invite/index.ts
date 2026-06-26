import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { buildAgentForwardEmailHtml } from "../_shared/buildAgentForwardEmailHtml.ts";

const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://allagentconnect.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ForwardInviteRequest {
  to: string[];
  ctaUrl?: string;
  subject?: string;
}

const DEFAULT_SUBJECT = "All Agent Connect — A professional platform built for agents";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ForwardInviteRequest;
    const recipients = Array.isArray(body?.to)
      ? body.to.filter((e) => typeof e === "string" && e.includes("@"))
      : [];

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid recipients provided" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const ctaUrl = body.ctaUrl?.trim() || `${PUBLIC_SITE_URL}/register`;
    const subject = body.subject?.trim() || DEFAULT_SUBJECT;

    const html = buildAgentForwardEmailHtml({ ctaUrl });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server misconfigured: missing Supabase service credentials");
    }
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const results: Array<{ email: string; success: boolean; error?: string }> = [];

    for (const email of recipients) {
      const { error } = await admin.from("email_jobs").insert({
        payload: {
          provider: "resend",
          template: "agent-forward-invite",
          to: email,
          subject,
          html,
          reply_to: "hello@allagentconnect.com",
        },
      });

      if (error) {
        console.error(`[send-agent-forward-invite] enqueue failed for ${email}:`, error);
        results.push({ email, success: false, error: error.message });
      } else {
        results.push({ email, success: true });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    if (successCount > 0) {
      void fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      }).catch((err) => {
        console.warn("[send-agent-forward-invite] kick-email-queue failed:", err);
      });
    }

    return new Response(
      JSON.stringify({ success: true, successCount, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err: any) {
    console.error("[send-agent-forward-invite] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);

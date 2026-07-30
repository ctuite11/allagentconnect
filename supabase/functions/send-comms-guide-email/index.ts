import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import {
  buildCommsCenterGuideEmailHtml,
  COMMS_CENTER_GUIDE_SUBJECT,
} from "../_shared/buildCommsCenterGuideEmailHtml.ts";
import { resolveAacCtaUrl } from "../_shared/aacPublicUrl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CommsGuideRequest {
  to?: string[];
  agentFirstName?: string;
  ctaUrl?: string;
  subject?: string;
  preview?: boolean;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as CommsGuideRequest;
    const recipients = (Array.isArray(body?.to) ? body.to : []).filter(
      (e) => typeof e === "string" && e.includes("@"),
    );

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid recipients" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const ctaUrl = resolveAacCtaUrl(body.ctaUrl, "/communications");
    const subject = body.subject?.trim() || COMMS_CENTER_GUIDE_SUBJECT;
    const html = buildCommsCenterGuideEmailHtml({
      agentFirstName: body.agentFirstName ?? null,
      ctaUrl,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server misconfigured: missing service credentials");
    }
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const results: Array<{ email: string; success: boolean; error?: string }> = [];
    for (const email of recipients) {
      const idempotencyKey = body.preview
        ? `comms-guide-preview-${email}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
        : `comms-guide-${email}-${today}`;
      const { error } = await admin.from("email_jobs").insert({
        stream: "communications",
        idempotency_key: idempotencyKey,
        payload: {
          provider: "resend",
          template: "comms-center-guide",
          to: email,
          subject,
          html,
          reply_to: "hello@allagentconnect.com",
        },
      });
      if (error) {
        console.error(`[send-comms-guide-email] enqueue failed for ${email}:`, error);
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
        console.warn("[send-comms-guide-email] kick-email-queue failed:", err);
      });
    }

    return new Response(
      JSON.stringify({ success: true, successCount, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err: any) {
    console.error("[send-comms-guide-email] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { buildPersonalForwardEmailHtml } from "../_shared/buildPersonalForwardEmailHtml.ts";
import { resolveAacCtaUrl } from "../_shared/aacPublicUrl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PersonalForwardRequest {
  to?: string[];
  ctaUrl?: string;
  subject?: string;
}

const DEFAULT_TO = "chris@allagentconnect.com";
const DEFAULT_SUBJECT = "You\u2019re invited to join All Agent Connect";

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as PersonalForwardRequest;
    const recipients = (Array.isArray(body?.to) && body.to.length
      ? body.to
      : [DEFAULT_TO]
    ).filter((e) => typeof e === "string" && e.includes("@"));

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid recipients" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const ctaUrl = resolveAacCtaUrl(body.ctaUrl, "/auth?mode=register&source=personal_forward");
    const subject = body.subject?.trim() || DEFAULT_SUBJECT;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server misconfigured: missing service credentials");
    }
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const replyTo = "chris@allagentconnect.com";
    const html = buildPersonalForwardEmailHtml({ ctaUrl });

    const results: Array<{ email: string; success: boolean; error?: string }> = [];
    for (const email of recipients) {
      const { error } = await admin.from("email_jobs").insert({
        payload: {
          provider: "resend",
          template: "personal-forward-invite",
          to: email,
          subject,
          html,
          reply_to: replyTo,
        },
      });
      if (error) {
        console.error(`[send-personal-forward-invite] enqueue failed for ${email}:`, error);
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
        console.warn("[send-personal-forward-invite] kick-email-queue failed:", err);
      });
    }

    return new Response(
      JSON.stringify({ success: true, successCount, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err: any) {
    console.error("[send-personal-forward-invite] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
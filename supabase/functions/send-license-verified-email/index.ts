import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { buildLicenseVerifiedEmailHtml } from "../_shared/buildLicenseVerifiedEmailHtml.ts";
import { resolveAacCtaUrl } from "../_shared/aacPublicUrl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendRequest {
  to: string | string[];
  ctaUrl?: string;
  subject?: string;
  agentName?: string;
}

const DEFAULT_SUBJECT = "Your license has been verified — welcome to All Agent Connect";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SendRequest;
    const toList = Array.isArray(body?.to) ? body.to : body?.to ? [body.to] : [];
    const recipients = toList.filter((e) => typeof e === "string" && e.includes("@"));

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid recipients provided" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const ctaUrl = resolveAacCtaUrl(body.ctaUrl, "/auth");
    const subject = body.subject?.trim() || DEFAULT_SUBJECT;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server misconfigured: missing Supabase service credentials");
    }
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const footerAgent = {
      firstName: "Chris",
      lastName: "Tuite",
      title: "Founder",
      company: null,
      email: "chris@allagentconnect.com",
      phone: "6178770519",
      headshotUrl:
        "https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/agent-headshots/1fc50da1-2664-4931-8cab-64e24dc5ed8c/headshot-1773973124574.jpg",
    };
    const html = buildLicenseVerifiedEmailHtml({ ctaUrl, agentName: body.agentName, footerAgent });
    const replyTo = "chris@allagentconnect.com";

    const results: Array<{ email: string; success: boolean; error?: string }> = [];

    for (const email of recipients) {
      const { error } = await admin.from("email_jobs").insert({
        payload: {
          provider: "resend",
          template: "license-verified",
          to: email,
          subject,
          html,
          reply_to: replyTo,
        },
      });

      if (error) {
        console.error(`[send-license-verified-email] enqueue failed for ${email}:`, error);
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
        console.warn("[send-license-verified-email] kick-email-queue failed:", err);
      });
    }

    return new Response(
      JSON.stringify({ success: true, successCount, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err: any) {
    console.error("[send-license-verified-email] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);

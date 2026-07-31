import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { buildAgentForwardEmailHtml } from "../_shared/buildAgentForwardEmailHtml.ts";
import { resolveAacCtaUrl } from "../_shared/aacPublicUrl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ForwardInviteRequest {
  to: string[];
  ctaUrl?: string;
  subject?: string;
  agentId?: string;
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

    const ctaUrl = resolveAacCtaUrl(body.ctaUrl, "/auth?mode=register&source=agent_forward");
    const subject = body.subject?.trim() || DEFAULT_SUBJECT;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server misconfigured: missing Supabase service credentials");
    }
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    let agent: any = null;
    let replyTo = "hello@allagentconnect.com";
    if (body.agentId) {
      const { data: ap } = await admin
        .from("agent_profiles")
        .select("first_name,last_name,title,company,email,phone,cell_phone,headshot_url,social_links")
        .eq("id", body.agentId)
        .maybeSingle();
      if (ap) {
        const website = (ap.social_links as any)?.website ?? null;
        agent = {
          firstName: ap.first_name,
          lastName: ap.last_name,
          title: ap.title,
          company: ap.company,
          email: ap.email,
          phone: ap.phone || ap.cell_phone,
          headshotUrl: ap.headshot_url,
          websiteUrl: website,
        };
        if (ap.email) replyTo = ap.email;
      }
    }

    const html = buildAgentForwardEmailHtml({ ctaUrl, agent });

    const results: Array<{ email: string; success: boolean; error?: string }> = [];

    for (const email of recipients) {
      const { error } = await admin.from("email_jobs").insert({
        stream: "transactional",
        payload: {
          provider: "resend",
          template: "agent-forward-invite",
          to: email,
          subject,
          html,
          reply_to: replyTo,
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

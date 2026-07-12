import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  teamId: string;
  teamName: string;
  slug?: string;
  company?: string;
  bio?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  requesterRole: "lead" | "delegate";
  requesterName?: string;
  requesterEmail?: string;
  teamLeadName?: string;
  teamLeadEmail?: string;
}

const ADMIN_EMAIL = "chris@allagentconnect.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const p = (await req.json()) as Payload;
    const appOrigin = Deno.env.get("APP_ORIGIN") || "https://allagentconnect.com";
    const reviewUrl = `${appOrigin}/admin/team-approvals`;
    const previewUrl = `${appOrigin}/team/${p.slug || p.teamId}`;

    const row = (label: string, value?: string) =>
      value ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">${label}</td><td style="padding:4px 0;"><strong>${value}</strong></td></tr>` : "";

    const html = `
      <h1 style="margin:0 0 16px;">New Team Account request</h1>
      <p>A new Team Account request is awaiting review.</p>
      <table style="border-collapse:collapse;margin:16px 0;">
        ${row("Team name", p.teamName)}
        ${row("Brokerage", p.company)}
        ${row("Requester", `${p.requesterName || ""} <${p.requesterEmail || ""}> (${p.requesterRole})`)}
        ${row("Team Lead", p.teamLeadName ? `${p.teamLeadName} <${p.teamLeadEmail || ""}>` : undefined)}
        ${row("Website", p.website)}
        ${row("Contact email", p.contactEmail)}
        ${row("Contact phone", p.contactPhone)}
      </table>
      ${p.bio ? `<p style="white-space:pre-wrap;color:#333;">${p.bio}</p>` : ""}
      <p style="margin:24px 0;">
        <a href="${reviewUrl}" style="background:#0E56F5;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Review in Admin</a>
        &nbsp;
        <a href="${previewUrl}" style="color:#0E56F5;">Preview team profile</a>
      </p>
    `;

    const { error } = await supabase.from("email_jobs").insert({
      payload: {
        provider: "resend",
        template: "team-request-notification",
        to: ADMIN_EMAIL,
        subject: `New Team Account request: ${p.teamName}`,
        variables: { contentHtml: html },
        idempotency_key: `team-request:${p.teamId}`,
      },
    });
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-team-request-notification]", err);
    return new Response(JSON.stringify({ success: false, error: err?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
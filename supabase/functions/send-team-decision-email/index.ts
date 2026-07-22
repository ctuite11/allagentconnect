import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildAacEmail } from "../_shared/aacEmailTemplate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  teamId: string;
  decision: "approved" | "rejected";
  rejectionReason?: string;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Unauthorized - no auth header" });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json(401, { error: "Unauthorized - invalid session" });

    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (roleErr) return json(500, { error: "Failed to verify admin role" });
    if (!isAdmin) return json(403, { error: "Forbidden - admin role required" });

    const { teamId, decision, rejectionReason } = (await req.json()) as Payload;
    if (!teamId || (decision !== "approved" && decision !== "rejected")) {
      return json(400, { error: "Missing teamId or invalid decision" });
    }
    if (decision === "rejected" && !rejectionReason?.trim()) {
      return json(400, { error: "rejectionReason required for rejected decision" });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: team, error: teamErr } = await admin
      .from("teams")
      .select("id, name, slug, team_lead_user_id, created_by, logo_url")
      .eq("id", teamId)
      .maybeSingle();
    if (teamErr || !team) return json(404, { error: "Team not found" });

    // Resolve recipient: agent_profiles.email for lead, then creator, then auth.users
    async function emailFromProfiles(userId?: string | null): Promise<string | null> {
      if (!userId) return null;
      const { data } = await admin
        .from("agent_profiles")
        .select("email")
        .eq("user_id", userId)
        .maybeSingle();
      return data?.email || null;
    }
    async function emailFromAuth(userId?: string | null): Promise<string | null> {
      if (!userId) return null;
      const { data } = await admin.auth.admin.getUserById(userId);
      return data?.user?.email || null;
    }

    const recipient =
      (await emailFromProfiles(team.team_lead_user_id)) ||
      (await emailFromProfiles(team.created_by)) ||
      (await emailFromAuth(team.team_lead_user_id)) ||
      (await emailFromAuth(team.created_by));

    if (!recipient) return json(422, { error: "Could not resolve team lead email" });

    const appOrigin = Deno.env.get("APP_ORIGIN") || "https://allagentconnect.com";
    const teamName = team.name || "your team";
    const manageUrl = `${appOrigin}/team/${team.id}/manage`;
    const publicUrl = `${appOrigin}/team/${team.slug || team.id}`;
    const requestUrl = `${appOrigin}/team/request`;

    let subject: string;
    let template: string;
    let idempotencyKey: string;
    let body: string;
    let ctaLabel: string;
    let ctaUrl: string;
    let headline: string;
    let preheader: string;

    if (decision === "approved") {
      subject = `Your team account "${teamName}" is approved`;
      template = "team-approved";
      idempotencyKey = `team-approved:${team.id}`;
      headline = "Your team account is approved";
      preheader = `${teamName} is live on All Agent Connect.`;
      ctaLabel = "Manage your team";
      ctaUrl = manageUrl;
      body = `
        <p style="margin:0 0 14px;font-size:15px;color:#0f172a;">Great news — your team account <strong>${escapeHtml(teamName)}</strong> has been approved and is live on All Agent Connect.</p>
        <p style="margin:0 0 14px;font-size:15px;color:#0f172a;">Use the button below to add teammates, upload your team photo, and fine-tune your public profile.</p>
        <p style="margin:18px 0 0;font-size:14px;color:#475569;">
          Prefer to view your public profile first?
          <a href="${publicUrl}" style="color:#0E56F5;text-decoration:none;">View public team profile</a>
        </p>
      `;
    } else {
      subject = `Your team account request needs changes`;
      template = "team-rejected";
      // include short hash of reason so a resubmission can re-send
      const reasonHash = Array.from(rejectionReason!.trim())
        .reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffffffff, 0)
        .toString(36);
      idempotencyKey = `team-rejected:${team.id}:${reasonHash}`;
      headline = "Your team account needs a few changes";
      preheader = `A quick update is needed on ${teamName}.`;
      ctaLabel = "Update your request";
      ctaUrl = requestUrl;
      body = `
        <p style="margin:0 0 14px;font-size:15px;color:#0f172a;">Thanks for submitting <strong>${escapeHtml(teamName)}</strong>. Before we can approve it, we need a few changes:</p>
        <div style="margin:16px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;color:#0f172a;font-size:14px;white-space:pre-wrap;">${escapeHtml(rejectionReason!)}</div>
        <p style="margin:0;font-size:15px;color:#0f172a;">Use the button below to update your request. Once resubmitted, our team will review it again.</p>
      `;
    }

    const html = buildAacEmail({
      headline,
      body,
      ctaLabel,
      ctaUrl,
      preheader,
    });

    const { error: insertErr } = await admin.from("email_jobs").insert({
      payload: {
        provider: "resend",
        template,
        to: recipient,
        subject,
        variables: { contentHtml: html },
        idempotency_key: idempotencyKey,
      },
    });
    if (insertErr) throw insertErr;

    return json(200, { success: true, resolvedRecipient: recipient });
  } catch (err: any) {
    console.error("[send-team-decision-email]", err);
    return json(500, { success: false, error: err?.message || String(err) });
  }
});
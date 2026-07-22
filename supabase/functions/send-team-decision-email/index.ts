import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  teamId: string;
  decision: "approved" | "rejected";
  rejectionReason?: string;
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
        .eq("id", userId)
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
    let variables: Record<string, unknown>;

    if (decision === "approved") {
      subject = `Your team account "${teamName}" is approved`;
      template = "team-approved";
      idempotencyKey = `team-approved:${team.id}`;
      variables = { teamName, manageUrl, publicUrl };
    } else {
      subject = `Your team account request needs changes`;
      template = "team-rejected";
      const reasonHash = Array.from(rejectionReason!.trim())
        .reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffffffff, 0)
        .toString(36);
      idempotencyKey = `team-rejected:${team.id}:${reasonHash}`;
      variables = { teamName, requestUrl, rejectionReason };
    }

    const { error: insertErr } = await admin.from("email_jobs").insert({
      payload: {
        provider: "resend",
        template,
        to: recipient,
        subject,
        variables,
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
/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { resolveEmailBaseUrl } from "../_shared/aacPublicUrl.ts";
import {
  assertDelegatesFeatureEnabled,
  isLicensedOwner,
  kickEmailQueue,
  resolveAuthUserEmail,
} from "../_shared/agentDelegatesGate.ts";
import { formatPersonDisplayName } from "../_shared/personDisplayName.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appUrl = resolveEmailBaseUrl(
    Deno.env.get("EMAIL_BASE_URL") || Deno.env.get("APP_URL"),
  );

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ success: false, error: "Missing auth token" }, 401);
  }

  const jwt = authHeader.replace("Bearer ", "");
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser(jwt);
  if (userErr || !user) return json({ success: false, error: "Unauthorized" }, 401);

  const ownerUserId = user.id;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const flag = await assertDelegatesFeatureEnabled(supabaseAdmin);
  if (!flag.ok) return json({ success: false, error: flag.error }, flag.status);

  if (!(await isLicensedOwner(supabaseAdmin, ownerUserId))) {
    return json({ success: false, error: "Only verified account owners can invite delegates" }, 403);
  }

  let input: { invite_email?: string; display_name?: string; role_label?: string };
  try {
    input = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const inviteEmail = input.invite_email?.trim().toLowerCase();
  if (!inviteEmail) {
    return json({ success: false, error: "invite_email is required" }, 400);
  }

  const ownerEmail = await resolveAuthUserEmail(supabaseAdmin, ownerUserId);
  if (ownerEmail && ownerEmail === inviteEmail) {
    return json({ success: false, error: "You cannot invite yourself as a delegate" }, 400);
  }

  const displayName = input.display_name?.trim() || null;
  const roleLabel = input.role_label?.trim() || null;

  const { data: pendingInvite } = await supabaseAdmin
    .from("agent_account_members")
    .select("id")
    .eq("owner_user_id", ownerUserId)
    .eq("invite_email", inviteEmail)
    .eq("status", "invited")
    .maybeSingle();

  if (pendingInvite) {
    return json({ success: false, error: "This person has already been invited." }, 400);
  }

  const { data: acceptedMembership } = await supabaseAdmin
    .from("agent_account_members")
    .select("id, delegate_user_id")
    .eq("owner_user_id", ownerUserId)
    .eq("invite_email", inviteEmail)
    .eq("status", "accepted")
    .maybeSingle();

  if (acceptedMembership) {
    return json({ success: false, error: "This person is already a delegate on your account." }, 400);
  }

  const { data: memberRow, error: insertErr } = await supabaseAdmin
    .from("agent_account_members")
    .insert({
      owner_user_id: ownerUserId,
      invite_email: inviteEmail,
      display_name: displayName,
      role_label: roleLabel,
      status: "invited",
      invited_by: ownerUserId,
    })
    .select("id, invite_token")
    .single();

  if (insertErr || !memberRow) {
    console.error("[invite-account-delegate] insert failed:", insertErr);
    if (insertErr?.code === "23505") {
      return json({ success: false, error: "This person has already been invited." }, 400);
    }
    return json({ success: false, error: "Failed to create invite" }, 500);
  }

  const { data: ownerProfile } = await supabaseAdmin
    .from("agent_profiles")
    .select("first_name, last_name, company")
    .eq("id", ownerUserId)
    .maybeSingle();

  const ownerName = formatPersonDisplayName(
    [ownerProfile?.first_name, ownerProfile?.last_name].filter(Boolean).join(" ") || "An agent",
  );

  const inviteLink = `${appUrl}/accept-delegate-invite?token=${memberRow.invite_token}`;
  const subject = `${ownerName} invited you to their All Agent Connect account`;

  const { error: emailErr } = await supabaseAdmin.from("email_jobs").insert({
    payload: {
      provider: "resend",
      template: "account-delegate-invite",
      to: inviteEmail,
      subject,
      variables: {
        ownerName,
        ownerBrokerage: ownerProfile?.company || "",
        roleLabel: roleLabel || "",
        inviteeName: displayName || "",
        inviteLink,
      },
    },
  });

  if (emailErr) {
    console.error("[invite-account-delegate] email enqueue failed:", emailErr);
    await supabaseAdmin.from("agent_account_members").delete().eq("id", memberRow.id);
    return json({ success: false, error: "Failed to send invite email" }, 500);
  }

  kickEmailQueue(supabaseUrl, serviceRoleKey);

  return json({
    success: true,
    member_id: memberRow.id,
    invite_email: inviteEmail,
  });
});

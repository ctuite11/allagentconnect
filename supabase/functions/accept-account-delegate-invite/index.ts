/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  assertDelegatesFeatureEnabled,
  hasAgentRole,
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

  const userId = user.id;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const flag = await assertDelegatesFeatureEnabled(supabaseAdmin);
  if (!flag.ok) return json({ success: false, error: flag.error }, flag.status);

  let input: { token?: string };
  try {
    input = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const inviteToken = input.token?.trim();
  if (!inviteToken) return json({ success: false, error: "token is required" }, 400);

  const { data: invite, error: inviteErr } = await supabaseAdmin
    .from("agent_account_members")
    .select(
      "id, owner_user_id, delegate_user_id, invite_email, status, invite_expires_at, accepted_at",
    )
    .eq("invite_token", inviteToken)
    .maybeSingle();

  if (inviteErr || !invite) {
    return json({ success: false, error: "Invalid invite token" }, 400);
  }

  if (invite.status === "accepted") {
    if (invite.delegate_user_id === userId) {
      const ownerName = await loadOwnerDisplayName(supabaseAdmin, invite.owner_user_id);
      return json({
        success: true,
        owner_user_id: invite.owner_user_id,
        owner_display_name: ownerName,
      });
    }
    return json({ success: false, error: "This invite has already been accepted" }, 400);
  }

  if (invite.status === "revoked") {
    return json({ success: false, error: "This invite is no longer valid" }, 400);
  }

  if (invite.status !== "invited") {
    return json({ success: false, error: "Invalid invite status" }, 400);
  }

  if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
    return json({ success: false, error: "This invite has expired" }, 400);
  }

  if (invite.owner_user_id === userId) {
    return json({ success: false, error: "Account owners cannot accept their own delegate invite" }, 400);
  }

  const userEmail = await resolveAuthUserEmail(supabaseAdmin, userId);
  if (!userEmail || userEmail !== invite.invite_email.toLowerCase()) {
    return json({ success: false, error: "This invite was sent to a different email address" }, 403);
  }

  if (!(await hasAgentRole(supabaseAdmin, userId))) {
    return json({
      success: false,
      error: "You must have an agent account to accept this invitation",
    }, 403);
  }

  const { error: updateErr } = await supabaseAdmin
    .from("agent_account_members")
    .update({
      status: "accepted",
      delegate_user_id: userId,
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invite.id)
    .eq("status", "invited");

  if (updateErr) {
    console.error("[accept-account-delegate-invite] update failed:", updateErr);
    return json({ success: false, error: "Failed to accept invite" }, 500);
  }

  const ownerName = await loadOwnerDisplayName(supabaseAdmin, invite.owner_user_id);

  return json({
    success: true,
    owner_user_id: invite.owner_user_id,
    owner_display_name: ownerName,
  });
});

async function loadOwnerDisplayName(
  admin: ReturnType<typeof createClient>,
  ownerUserId: string,
): Promise<string> {
  const { data: ownerProfile } = await admin
    .from("agent_profiles")
    .select("first_name, last_name")
    .eq("id", ownerUserId)
    .maybeSingle();

  return formatPersonDisplayName(
    [ownerProfile?.first_name, ownerProfile?.last_name].filter(Boolean).join(" ") || "the account owner",
  );
}

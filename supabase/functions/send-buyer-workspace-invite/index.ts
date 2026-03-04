/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
  const appUrl = Deno.env.get("APP_URL") || "https://allagentconnect.lovable.app";

  // Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ success: false, error: "Missing auth token" }, 401);

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.slice(7);
  const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) return json({ success: false, error: "Unauthorized" }, 401);

  const userId = claimsData.claims.sub as string;

  // Parse body
  let input: { firstName?: string; lastName?: string; email?: string };
  try {
    input = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  const email = input.email?.trim().toLowerCase();

  if (!firstName || !lastName || !email) {
    return json({ success: false, error: "firstName, lastName, and email are required" }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Resolve caller's workspace (must be owner)
  const { data: membership, error: memErr } = await supabaseAdmin
    .from("buyer_workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();

  if (memErr || !membership) {
    return json({ success: false, error: "No buyer workspace found. You must be a primary buyer." }, 400);
  }

  const workspaceId = membership.workspace_id;

  // Check if already a member
  const { data: existing } = await supabaseAdmin
    .from("buyer_workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(10);

  // Check if email is already invited (pending token)
  const { data: existingTokens } = await supabaseAdmin
    .from("share_tokens")
    .select("id, payload")
    .eq("agent_id", userId);

  const alreadyInvited = (existingTokens || []).some((t: any) => {
    const p = t.payload ?? {};
    return p.type === "buyer_workspace_invite" &&
      p.buyer_workspace_id === workspaceId &&
      p.invite_email?.toLowerCase() === email &&
      !p.accepted_at;
  });

  if (alreadyInvited) {
    return json({ success: false, error: "This person has already been invited." }, 400);
  }

  // Get inviter's name
  const { data: inviterProfile } = await supabaseAdmin
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", userId)
    .maybeSingle();

  const inviterName = [inviterProfile?.first_name, inviterProfile?.last_name].filter(Boolean).join(" ") || "A buyer";
  const inviterEmail = inviterProfile?.email || "";

  // Resolve sticky agent (if any)
  const { data: agentRel } = await supabaseAdmin
    .from("client_agent_relationships")
    .select("agent_id")
    .eq("client_id", userId)
    .eq("status", "active")
    .maybeSingle();

  const stickyAgentId = agentRel?.agent_id ?? null;

  // Create share token
  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from("share_tokens")
    .insert({
      agent_id: stickyAgentId || userId, // use buyer as fallback agent_id (required FK)
      payload: {
        type: "buyer_workspace_invite",
        buyer_workspace_id: workspaceId,
        invite_email: email,
        invite_first_name: firstName,
        invite_last_name: lastName,
        created_by_user_id: userId,
        sticky_agent_id: stickyAgentId,
      },
    })
    .select("token")
    .single();

  if (tokenErr || !tokenRow) {
    console.error("Token creation failed:", tokenErr);
    return json({ success: false, error: "Failed to create invite token" }, 500);
  }

  const inviteLink = `${appUrl}/accept-buyer-workspace-invite?token=${tokenRow.token}`;

  // Enqueue email
  const { error: emailErr } = await supabaseAdmin
    .from("email_jobs")
    .insert({
      payload: {
        provider: "resend",
        template: "buyer-workspace-invite",
        to: email,
        subject: `${inviterName} invited you to share their home search`,
        variables: {
          inviterName,
          inviterEmail,
          friendName: firstName,
          inviteLink,
        },
      },
    });

  if (emailErr) {
    console.error("Email enqueue failed:", emailErr);
    return json({ success: false, error: "Failed to send invite email" }, 500);
  }

  return json({ success: true });
});

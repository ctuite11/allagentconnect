/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { resolveEmailBaseUrl } from "../_shared/aacPublicUrl.ts";

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

  // Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  console.log("[send-invite] request start", { hasAuth: !!authHeader, startsWithBearer: authHeader.startsWith("Bearer ") });

  if (!authHeader.startsWith("Bearer ")) return json({ success: false, error: "Missing auth token" }, 401);

  const jwt = authHeader.replace("Bearer ", "");

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser(jwt);
  console.log("[send-invite] user lookup", { userId: user?.id ?? null, error: userErr?.message ?? null });

  if (userErr || !user) return json({ success: false, error: "Unauthorized" }, 401);

  const userId = user.id;

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

  // Check if email is already invited (pending invite in buyer_workspace_invites)
  const { data: existingInvites } = await supabaseAdmin
    .from("buyer_workspace_invites")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("buyer_email", email)
    .is("accepted_at", null);

  if (existingInvites && existingInvites.length > 0) {
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

  // Create invite in buyer_workspace_invites (service role bypasses RLS)
  const { data: inviteRow, error: inviteErr } = await supabaseAdmin
    .from("buyer_workspace_invites")
    .insert({
      workspace_id: workspaceId,
      agent_id: stickyAgentId,
      created_by_user_id: userId,
      buyer_email: email,
      buyer_first_name: firstName,
      buyer_last_name: lastName,
    })
    .select("token")
    .single();

  if (inviteErr || !inviteRow) {
    console.error("Invite creation failed:", inviteErr);
    // Unique constraint violation = duplicate pending invite
    if (inviteErr?.code === "23505") {
      return json({ success: false, error: "This person has already been invited." }, 400);
    }
    return json({ success: false, error: "Failed to create invite" }, 500);
  }

  const inviteLink = `${appUrl}/accept-buyer-workspace-invite?token=${inviteRow.token}`;

  // Enqueue email
  const { error: emailErr } = await supabaseAdmin
    .from("email_jobs")
    .insert({
      stream: "transactional",
      payload: {
        provider: "resend",
        template: "buyer-workspace-invite",
        to: email,
        subject: `AAC`,
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

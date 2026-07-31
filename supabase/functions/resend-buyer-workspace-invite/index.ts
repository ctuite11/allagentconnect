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
  if (!authHeader.startsWith("Bearer ")) return json({ success: false, error: "Missing auth token" }, 401);

  const jwt = authHeader.replace("Bearer ", "");
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser(jwt);
  if (userErr || !user) return json({ success: false, error: "Unauthorized" }, 401);

  const userId = user.id;

  // Parse body
  let input: { inviteId?: string; extend?: boolean };
  try {
    input = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const inviteId = input.inviteId?.trim();
  const extend = input.extend === true;
  if (!inviteId) return json({ success: false, error: "inviteId is required" }, 400);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Fetch invite
  const { data: invite, error: inviteErr } = await supabaseAdmin
    .from("buyer_workspace_invites")
    .select(
      "id, token, workspace_id, buyer_email, buyer_first_name, buyer_last_name, accepted_at, expires_at, last_resent_at"
    )
    .eq("id", inviteId)
    .maybeSingle();

  if (inviteErr || !invite) return json({ success: false, error: "Invite not found" }, 404);

  // Verify caller owns workspace
  const { data: workspace, error: wsErr } = await supabaseAdmin
    .from("buyer_workspaces")
    .select("id, owner_id")
    .eq("id", invite.workspace_id)
    .maybeSingle();

  if (wsErr || !workspace) return json({ success: false, error: "Workspace not found" }, 404);
  if (workspace.owner_id !== userId) return json({ success: false, error: "Forbidden" }, 403);

  // Reject accepted
  if (invite.accepted_at) {
    return json({ success: false, error: "This invite has already been accepted" }, 400);
  }

  // Race-safe throttle runs BEFORE expiry check to prevent spam on all resend attempts
  const { data: throttleResult, error: throttleErr } = await supabaseAdmin
    .rpc("rate_limit_consume", {
      p_key: `bwi_resend:${inviteId}`,
      p_window_seconds: 60,
      p_limit: 1,
    });

  if (throttleErr) {
    console.error("Throttle check failed:", throttleErr);
    return json({ success: false, error: "Internal error" }, 500);
  }

  if (!throttleResult?.allowed) {
    const resetAt = throttleResult?.reset_at;
    const waitSecs = resetAt
      ? Math.max(1, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000))
      : 60;
    return json({ success: false, error: `Please wait ${waitSecs}s before resending` }, 429);
  }

  // Check expired — only reject if not extending
  const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date();
  if (isExpired && !extend) {
    return json({ success: false, error: "This invite has expired. Use Resend + Extend to reactivate it." }, 400);
  }

  // If extending, update expires_at to 30 days from now (last_resent_at updated after email enqueue)
  if (extend && isExpired) {
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("buyer_workspace_invites")
      .update({ expires_at: newExpiry })
      .eq("id", inviteId);
  }

  // Inviter name/email
  const { data: inviterProfile } = await supabaseAdmin
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", userId)
    .maybeSingle();

  const inviterName =
    [inviterProfile?.first_name, inviterProfile?.last_name].filter(Boolean).join(" ") || "A buyer";
  const inviterEmail = inviterProfile?.email || "";

  const friendName =
    [invite.buyer_first_name, invite.buyer_last_name].filter(Boolean).join(" ") || invite.buyer_email;

  const inviteLink = `${appUrl}/accept-buyer-workspace-invite?token=${invite.token}`;

  // Enqueue email
  const { error: emailErr } = await supabaseAdmin.from("email_jobs").insert({
    stream: "transactional",
    payload: {
      provider: "resend",
      template: "buyer-workspace-invite",
      to: invite.buyer_email,
      subject: `AAC`,
      variables: {
        inviterName,
        inviterEmail,
        friendName,
        inviteLink,
      },
    },
  });

  if (emailErr) {
    console.error("Email enqueue failed:", emailErr);
    return json({ success: false, error: "Failed to resend invite email" }, 500);
  }

  // Update last_resent_at only after email enqueue succeeds
  await supabaseAdmin
    .from("buyer_workspace_invites")
    .update({ last_resent_at: new Date().toISOString() })
    .eq("id", inviteId);

  return json({ success: true });
});

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

  // Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ success: false, error: "Missing auth token" }, 401);

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const jwtToken = authHeader.slice(7);
  const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(jwtToken);
  if (claimsErr || !claimsData?.claims) return json({ success: false, error: "Unauthorized" }, 401);

  const userId = claimsData.claims.sub as string;

  // Parse body
  let input: { token?: string };
  try {
    input = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const inviteToken = input.token?.trim();
  if (!inviteToken) return json({ success: false, error: "token is required" }, 400);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Validate token
  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from("share_tokens")
    .select("id, token, payload, accepted_at, accepted_by_user_id, expires_at")
    .eq("token", inviteToken)
    .maybeSingle();

  if (tokenErr || !tokenRow) {
    return json({ success: false, error: "Invalid invite token" }, 400);
  }

  const payload = (tokenRow.payload as any) ?? {};

  if (payload.type !== "buyer_workspace_invite") {
    return json({ success: false, error: "Invalid token type" }, 400);
  }

  if (tokenRow.accepted_at) {
    return json({ success: false, error: "This invite has already been accepted" }, 400);
  }

  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return json({ success: false, error: "This invite has expired" }, 400);
  }

  const workspaceId = payload.buyer_workspace_id;
  if (!workspaceId) {
    return json({ success: false, error: "Invalid invite: missing workspace" }, 400);
  }

  // Check workspace exists
  const { data: workspace } = await supabaseAdmin
    .from("buyer_workspaces")
    .select("id, owner_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!workspace) {
    return json({ success: false, error: "Workspace no longer exists" }, 400);
  }

  // Prevent owner from joining as member
  if (workspace.owner_id === userId) {
    return json({ success: false, error: "You are already the owner of this workspace" }, 400);
  }

  // Insert membership
  const { error: memberErr } = await supabaseAdmin
    .from("buyer_workspace_members")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: "member",
    })
    .select()
    .single();

  if (memberErr) {
    if (memberErr.code === "23505") {
      // Already a member — just mark token accepted
    } else {
      console.error("Membership insert failed:", memberErr);
      return json({ success: false, error: "Failed to join workspace" }, 500);
    }
  }

  // Mark token accepted
  const { error: updateErr } = await supabaseAdmin
    .from("share_tokens")
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by_user_id: userId,
    })
    .eq("id", tokenRow.id);

  if (updateErr) {
    console.error("Token update failed:", updateErr);
  }

  // If there's a sticky agent, create agent relationship for the friend
  const stickyAgentId = payload.sticky_agent_id;
  if (stickyAgentId) {
    // Ensure buyer role exists for friend
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "buyer" })
      .select()
      .maybeSingle(); // ignore conflict

    // Create agent relationship
    const { error: relErr } = await supabaseAdmin
      .from("client_agent_relationships")
      .insert({
        client_id: userId,
        agent_id: stickyAgentId,
        status: "active",
      })
      .select()
      .maybeSingle();

    if (relErr && relErr.code !== "23505") {
      console.error("Agent relationship creation failed:", relErr);
    }
  }

  // Get owner name for toast
  const { data: ownerProfile } = await supabaseAdmin
    .from("profiles")
    .select("first_name")
    .eq("id", workspace.owner_id)
    .maybeSingle();

  const ownerName = ownerProfile?.first_name || "your friend";

  return json({ success: true, workspaceId, ownerName });
});

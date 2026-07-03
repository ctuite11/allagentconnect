/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  assertDelegatesFeatureEnabled,
  isLicensedOwner,
} from "../_shared/agentDelegatesGate.ts";

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

  const ownerUserId = user.id;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const flag = await assertDelegatesFeatureEnabled(supabaseAdmin);
  if (!flag.ok) return json({ success: false, error: flag.error }, flag.status);

  if (!(await isLicensedOwner(supabaseAdmin, ownerUserId))) {
    return json({ success: false, error: "Only verified account owners can revoke delegates" }, 403);
  }

  let input: { member_id?: string };
  try {
    input = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const memberId = input.member_id?.trim();
  if (!memberId) return json({ success: false, error: "member_id is required" }, 400);

  const { data: member, error: memberErr } = await supabaseAdmin
    .from("agent_account_members")
    .select("id, owner_user_id, delegate_user_id, status")
    .eq("id", memberId)
    .maybeSingle();

  if (memberErr || !member) {
    return json({ success: false, error: "Delegate membership not found" }, 404);
  }

  if (member.owner_user_id !== ownerUserId) {
    return json({ success: false, error: "Not authorized for this delegate" }, 403);
  }

  if (member.status === "revoked") {
    return json({ success: true });
  }

  const { error: updateErr } = await supabaseAdmin
    .from("agent_account_members")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: ownerUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .eq("owner_user_id", ownerUserId);

  if (updateErr) {
    console.error("[revoke-account-delegate] update failed:", updateErr);
    return json({ success: false, error: "Failed to revoke delegate" }, 500);
  }

  if (member.delegate_user_id) {
    const { error: contextErr } = await supabaseAdmin
      .from("agent_active_context")
      .delete()
      .eq("user_id", member.delegate_user_id)
      .eq("active_owner_user_id", ownerUserId);

    if (contextErr) {
      console.error("[revoke-account-delegate] context clear failed:", contextErr);
    }
  }

  return json({ success: true });
});

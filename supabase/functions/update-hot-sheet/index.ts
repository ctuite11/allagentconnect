import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) throw new Error("Not authenticated");

    const { hotSheetId, name, criteria, notify_client_email, notify_agent_email, notification_schedule } = await req.json();
    const submittedName = typeof name === "string" ? name.trim() : "";
    console.log("update-hot-sheet", { hotSheetId, submittedName });

    if (!hotSheetId || !submittedName) throw new Error("Hot sheet name is required");

    const { data: existing, error: existingError } = await adminClient
      .from("hot_sheets")
      .select("id, user_id")
      .eq("id", hotSheetId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) throw new Error("Hot sheet not found");

    if (existing.user_id !== userData.user.id) {
      const { data: links } = await adminClient
        .from("hot_sheet_clients")
        .select("client_id")
        .eq("hot_sheet_id", hotSheetId);

      const linkedClientIds = (links || []).map((link) => link.client_id).filter(Boolean);
      if (!linkedClientIds.length) throw new Error("Not allowed to update this hot sheet");

      const { data: relationship } = await adminClient
        .from("client_agent_relationships")
        .select("id")
        .eq("agent_id", existing.user_id)
        .eq("client_id", userData.user.id)
        .in("crm_client_id", linkedClientIds)
        .in("status", ["active", "pending"])
        .maybeSingle();

      if (!relationship) throw new Error("Not allowed to update this hot sheet");
    }

    const { error: updateError } = await adminClient
      .from("hot_sheets")
      .update({ name: submittedName, criteria, notify_client_email, notify_agent_email, notification_schedule })
      .eq("id", hotSheetId);

    if (updateError) {
      console.error("update-hot-sheet failed", { hotSheetId, submittedName, error: updateError });
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to update hot sheet";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
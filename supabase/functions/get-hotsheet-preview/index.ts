import "../_shared/migrationRuntime.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return new Response(null, { status: 405, headers: corsHeaders });

  try {
    const raw = await req.text();
    if (raw.length > 2048) return new Response(null, { status: 400, headers: corsHeaders });
    const { token, email, first_name } = JSON.parse(raw);

    if (!token || typeof token !== "string" || token.length < 20 || token.length > 200) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve subscriber → hot sheet
    const { data: subscriber } = await supabase
      .from("hot_sheet_subscribers")
      .select("id, hot_sheet_id, status")
      .eq("preview_token", token)
      .maybeSingle();

    if (!subscriber || subscriber.status !== "active") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const hotSheetId = subscriber.hot_sheet_id;

    // Fetch hot sheet metadata + criteria
    const { data: hotSheet } = await supabase
      .from("hot_sheets")
      .select("id, name, criteria, user_id")
      .eq("id", hotSheetId)
      .single();

    if (!hotSheet) {
      return new Response(
        JSON.stringify({ success: false, error: "Hot sheet not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: scoped, error: scopeError } = await supabase.rpc("get_shared_hot_sheet", { p_token: token });
    if (scopeError || !scoped) return new Response(JSON.stringify({ success: false, error: "Link unavailable" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });

    // If email provided → self-subscribe
    if (email && typeof email === "string") {
      const trimmedEmail = email.trim().toLowerCase();

      // Check existing
      const { data: existing } = await supabase
        .from("hot_sheet_subscribers")
        .select("id, status")
        .eq("hot_sheet_id", hotSheetId)
        .eq("email", trimmedEmail)
        .maybeSingle();

      if (existing && existing.status === "active") {
        return new Response(
          JSON.stringify({ success: true, message: "Already subscribed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (existing) {
        // Reactivate
        await supabase
          .from("hot_sheet_subscribers")
          .update({ status: "active", unsubscribed_at: null, first_name: first_name?.trim() || null })
          .eq("id", existing.id);
      } else {
        // Insert new subscriber
        await supabase
          .from("hot_sheet_subscribers")
          .insert({
            hot_sheet_id: hotSheetId,
            email: trimmedEmail,
            first_name: first_name?.trim() || null,
          });
      }

      return new Response(
        JSON.stringify({ success: true, message: "Subscribed", hotSheetName: hotSheet.name }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({
      success: true, hotSheetName: scoped.hot_sheet.name,
      agentName: `${scoped.agent.first_name} ${scoped.agent.last_name}`.trim(),
      agentCompany: scoped.agent.company || null, listings: scoped.listings,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });

  } catch (error: any) {
    console.error("[get-hotsheet-preview] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

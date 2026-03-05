import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      // Idempotent: don't leak whether token exists
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch subscriber + hot sheet name in one go
    const { data: subscriber } = await supabase
      .from("hot_sheet_subscribers")
      .select("id, status, hot_sheet_id, hot_sheets(name)")
      .eq("unsubscribe_token", token)
      .maybeSingle();

    if (!subscriber) {
      // Token not found — still return success (idempotent, no leaking)
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const hotSheetName = (subscriber as any).hot_sheets?.name || null;

    if (subscriber.status === "active") {
      await supabase
        .from("hot_sheet_subscribers")
        .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
        .eq("id", subscriber.id);
    }

    return new Response(
      JSON.stringify({ success: true, hotSheetName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[unsubscribe-hotsheet] Error:", error);
    return new Response(
      JSON.stringify({ success: true }), // idempotent even on error
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

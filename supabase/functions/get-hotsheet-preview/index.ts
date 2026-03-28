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
    const { token, email, first_name } = await req.json();

    if (!token || typeof token !== "string") {
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

    if (!subscriber) {
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

    // Otherwise → return preview data (listings)
    const criteria = hotSheet.criteria || {};

    // Build a simple query based on hot sheet criteria
    let query = supabase
      .from("listings")
      .select("id, address, city, state, zip_code, price, bedrooms, bathrooms, square_feet, property_type, photos, status, created_at")
      .in("status", ["active", "new", "coming_soon"]);

    if (criteria.state) {
      query = query.ilike("state", criteria.state);
    }
    if (criteria.cities?.length) {
      query = query.in("city", criteria.cities);
    }
    if (criteria.minPrice) {
      query = query.gte("price", criteria.minPrice);
    }
    if (criteria.maxPrice) {
      query = query.lte("price", criteria.maxPrice);
    }
    if (criteria.bedrooms) {
      query = query.gte("bedrooms", criteria.bedrooms);
    }
    if (criteria.bathrooms) {
      query = query.gte("bathrooms", criteria.bathrooms);
    }
    if (criteria.propertyTypes?.length) {
      // Map property types
      const typeMap: Record<string, string> = {
        single_family: "Single Family",
        condo: "condo",
        Condominium: "condo",
        multi_family: "Multi Family",
        townhouse: "Townhouse",
        land: "Land",
        commercial: "Commercial",
      };
      const mappedTypes = criteria.propertyTypes.map((t: string) => typeMap[t] || t);
      query = query.in("property_type", mappedTypes);
    }

    const { data: listings } = await query
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch agent info for attribution
    const { data: agentProfile } = await supabase
      .from("agent_profiles")
      .select("first_name, last_name, company")
      .eq("id", hotSheet.user_id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        hotSheetName: hotSheet.name,
        agentName: agentProfile
          ? `${agentProfile.first_name} ${agentProfile.last_name}`.trim()
          : null,
        agentCompany: agentProfile?.company || null,
        listings: listings || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[get-hotsheet-preview] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

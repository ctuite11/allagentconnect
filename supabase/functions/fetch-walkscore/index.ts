import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude, address, city, state } = await req.json();

    const WALK_SCORE_API_KEY = Deno.env.get("WALK_SCORE_API_KEY");

    // If API key is not configured, return disabled status
    if (!WALK_SCORE_API_KEY) {
      console.log("[fetch-walkscore] Walk Score API key not configured");
      return new Response(
        JSON.stringify({ enabled: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the Walk Score API URL
    const addressParam = address ? `${address}, ${city}, ${state}` : `${city}, ${state}`;
    const walkScoreUrl = `https://api.walkscore.com/score?format=json&lat=${latitude}&lon=${longitude}&address=${encodeURIComponent(addressParam)}&wsapikey=${WALK_SCORE_API_KEY}&transit=1&bike=1`;

    console.log("[fetch-walkscore] Calling Walk Score API for:", addressParam);

    const response = await fetch(walkScoreUrl);
    
    if (!response.ok) {
      console.error("[fetch-walkscore] Walk Score API error:", response.status);
      return new Response(
        JSON.stringify({ enabled: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Normalize the response
    const result = {
      enabled: true,
      walkScore: data.walkscore ?? null,
      walkDescription: data.description ?? null,
      transitScore: data.transit?.score ?? null,
      transitDescription: data.transit?.description ?? null,
      bikeScore: data.bike?.score ?? null,
      bikeDescription: data.bike?.description ?? null,
    };

    console.log("[fetch-walkscore] Walk Score data fetched successfully");

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[fetch-walkscore] Error:", error);
    return new Response(
      JSON.stringify({ enabled: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

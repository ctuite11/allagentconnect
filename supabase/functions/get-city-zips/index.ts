import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { state, city } = await req.json();

    if (!state || !city) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: state and city" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stateSlug = String(state).toLowerCase();
    const citySlug = encodeURIComponent(String(city).toLowerCase());

    const url = `https://api.zippopotam.us/us/${stateSlug}/${citySlug}`;
    const resp = await fetch(url, { method: "GET" });

    if (!resp.ok) {
      // 404 means no data for that city/state combo
      if (resp.status === 404) {
        return new Response(
          JSON.stringify({ zips: [], count: 0, source: "zippopotam.us" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await resp.text();
      return new Response(
        JSON.stringify({ error: `Lookup failed (${resp.status})`, details: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    // Zippopotam response shape: { "places": [{ "post code": "92101", ... }] }
    const places = Array.isArray(data?.places) ? data.places : [];
    const zipsSet = new Set<string>();
    for (const p of places) {
      const zip = p?.["post code"] || p?.["post_code"] || p?.post_code || p?.postcode || p?.zip;
      if (zip) zipsSet.add(String(zip));
    }

    const zips = Array.from(zipsSet);

    return new Response(
      JSON.stringify({ zips, count: zips.length, source: "zippopotam.us" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[get-city-zips] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

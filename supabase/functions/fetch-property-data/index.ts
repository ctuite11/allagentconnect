import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, city, state, zip } = await req.json();

    if (!address || !city || !state) {
      return new Response(
        JSON.stringify({ error: true, message: "Address, city, and state are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const attomApiKey = Deno.env.get("ATTOM_API_KEY");
    if (!attomApiKey) {
      console.error("ATTOM_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: true, message: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Neighborhood to city mappings for common cases
    const neighborhoodToCityMap: Record<string, string> = {
      "charlestown": "Boston",
      "southie": "Boston",
      "south boston": "Boston",
      "dorchester": "Boston",
      "roxbury": "Boston",
      "jamaica plain": "Boston",
      "west roxbury": "Boston",
      "roslindale": "Boston",
      "mattapan": "Boston",
      "hyde park": "Boston",
      "allston": "Boston",
      "brighton": "Boston",
      "back bay": "Boston",
      "beacon hill": "Boston",
      "north end": "Boston",
      "south end": "Boston",
      "fenway": "Boston",
      "mission hill": "Boston",
      "east boston": "Boston",
    };

    // Try to map neighborhood to city
    const normalizedCity = city.toLowerCase();
    const mappedCity = neighborhoodToCityMap[normalizedCity] || city;

    // Build ATTOM API URL
    const params = new URLSearchParams({
      address: address,
      city: mappedCity,
      state: state,
    });
    if (zip) {
      params.append("postalcode", zip);
    }

    const attomUrl = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile?${params.toString()}`;
    console.log("[fetch-property-data] Calling ATTOM API:", attomUrl);

    const attomResponse = await fetch(attomUrl, {
      headers: {
        accept: "application/json",
        apikey: attomApiKey,
      },
    });

    if (!attomResponse.ok) {
      const errorText = await attomResponse.text();
      console.error("[fetch-property-data] ATTOM API error:", attomResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: true, message: "Failed to fetch property data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const attomData = await attomResponse.json();
    console.log("[fetch-property-data] ATTOM API response:", JSON.stringify(attomData));

    if (!attomData?.property?.length) {
      return new Response(
        JSON.stringify({ error: true, message: "No property data found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const property = attomData.property[0];
    const building = property.building || {};
    const lot = property.lot || {};
    const summary = property.summary || {};
    const assessment = property.assessment || {};
    const address_info = property.address || {};

    // Extract ATTOM ID
    const attomId = property.identifier?.attomId || null;

    // Normalize response
    const normalized = {
      attomId,
      beds: building.rooms?.beds || null,
      baths: building.rooms?.bathsTotal || building.rooms?.bathsFull || null,
      sqft: building.size?.bldgSize || building.size?.livingSize || null,
      lotSizeSqft: lot.lotSize2 || lot.lotSize1 || null,
      yearBuilt: summary.yearBuilt || null,
      lastSaleDate: property.sale?.saleTransDate || null,
      lastSalePrice: property.sale?.saleAmt || null,
      taxYear: assessment.tax?.taxYear || null,
      taxAmount: assessment.tax?.taxAmt || null,
      latitude: address_info.latitude || null,
      longitude: address_info.longitude || null,
    };

    // Cache the raw response
    if (attomId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase
          .from("public_records_cache")
          .upsert({
            attom_id: attomId,
            raw: attomData,
          });

        console.log("[fetch-property-data] Cached public record for ATTOM ID:", attomId);
      } catch (cacheError) {
        console.error("[fetch-property-data] Failed to cache record:", cacheError);
        // Continue anyway - caching failure shouldn't block the response
      }
    }

    return new Response(JSON.stringify(normalized), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[fetch-property-data] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      JSON.stringify({ error: true, message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

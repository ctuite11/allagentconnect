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
    const body = await req.json();
    console.log("[fetch-property-data] Incoming payload:", JSON.stringify(body));
    
    const { address, city, state, zip } = body;

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

    // Build ATTOM API URL - ATTOM prefers a single address parameter with full address
    let fullAddress = `${address}, ${mappedCity}, ${state}`;
    if (zip) {
      fullAddress += ` ${zip}`;
    }
    
    const params = new URLSearchParams({
      address: fullAddress,
    });

    const attomUrl = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile?${params.toString()}`;
    console.log("[fetch-property-data] ATTOM request URL:", attomUrl);

    const attomResponse = await fetch(attomUrl, {
      headers: {
        accept: "application/json",
        apikey: attomApiKey,
      },
    });

    console.log("[fetch-property-data] ATTOM status:", attomResponse.status);

    // Parse ATTOM response - even 400 responses may contain valid "no results" data
    const attomData = await attomResponse.json();
    
    // Check if this is a "no results found" response (ATTOM returns 400 with SuccessWithoutResult)
    if (!attomResponse.ok) {
      const statusCode = attomData?.status?.code;
      const statusMsg = attomData?.status?.msg;
      
      if (statusCode === 400 && statusMsg === "SuccessWithoutResult") {
        // This is a valid "no records found" response, not an error
        console.log("[fetch-property-data] ATTOM: No records found for address");
        return new Response(
          JSON.stringify({ results: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // For other errors, log and return error
      console.error("[fetch-property-data] ATTOM API error:", attomResponse.status, JSON.stringify(attomData));
      return new Response(
        JSON.stringify({ error: true, message: "Failed to fetch property data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fetch-property-data] ATTOM API response properties count:", attomData?.property?.length || 0);

    if (!attomData?.property?.length) {
      return new Response(
        JSON.stringify({ results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Process all properties from the response
    const results = await Promise.all(
      attomData.property.map(async (property: any) => {
        const building = property.building || {};
        const lot = property.lot || {};
        const summary = property.summary || {};
        const assessment = property.assessment || {};
        const address_info = property.address || {};
        const owner = property.owner || {};
        const attomId = property.identifier?.attomId || null;

        // Cache the raw response for this property
        if (attomId) {
          try {
            await supabase
              .from("public_records_cache")
              .upsert({
                attom_id: attomId,
                raw: { property: [property] }, // Store individual property
              });
            console.log("[fetch-property-data] Cached public record for ATTOM ID:", attomId);
          } catch (cacheError) {
            console.error("[fetch-property-data] Failed to cache record:", cacheError);
          }
        }

        // Extract unit number from address if present
        // ATTOM may include unit in line1 like "300 COMMERCIAL ST #404" or in a separate field
        let streetAddress = address_info.line1 || '';
        let unitNumber = address_info.unitNumber || null;
        
        // Parse unit from street address if not in separate field
        // Common patterns: #404, Unit 404, Apt 404, Suite 404
        if (!unitNumber && streetAddress) {
          const unitPatterns = [
            /\s+#(\S+)$/i,           // #404
            /\s+unit\s+(\S+)$/i,     // Unit 404
            /\s+apt\.?\s+(\S+)$/i,   // Apt 404, Apt. 404
            /\s+suite\s+(\S+)$/i,    // Suite 404
            /\s+ste\.?\s+(\S+)$/i,   // Ste 404
          ];
          
          for (const pattern of unitPatterns) {
            const match = streetAddress.match(pattern);
            if (match) {
              unitNumber = match[1];
              // Remove unit from street address
              streetAddress = streetAddress.replace(pattern, '').trim();
              break;
            }
          }
        }

        // Build normalized result
        return {
          attom_id: attomId,
          address: streetAddress || address_info.oneLine || '',
          unit_number: unitNumber,
          city: address_info.locality || city,
          state: address_info.countrySubd || state,
          zip: address_info.postal1 || zip || null,
          owner: owner.owner1?.lastNameOrCorporation || owner.owner1?.companyName || null,
          property_type: summary.propClass || summary.propType || null,
          beds: building.rooms?.beds || null,
          baths: building.rooms?.bathsTotal || building.rooms?.bathsFull || null,
          sqft: building.size?.bldgSize || building.size?.livingSize || null,
          lotSizeSqft: lot.lotSize2 || lot.lotSize1 || null,
          yearBuilt: summary.yearBuilt || null,
          lastSaleDate: property.sale?.saleTransDate || null,
          lastSalePrice: property.sale?.saleAmt || null,
          taxYear: assessment.tax?.taxYear || null,
          taxAmount: assessment.tax?.taxAmt || null,
          assessedValue: assessment.assessed?.assdTtlValue || null,
          marketValue: assessment.market?.mktTtlValue || null,
          latitude: address_info.latitude || null,
          longitude: address_info.longitude || null,
          raw: property,
        };
      })
    );

    return new Response(JSON.stringify({ results }), {
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

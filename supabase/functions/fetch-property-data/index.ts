import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter (resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const checkRateLimit = (userId: string, maxRequests = 10, windowMs = 60000): boolean => {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (userLimit.count >= maxRequests) {
    return false;
  }

  userLimit.count++;
  return true;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting check (10 requests per minute)
    if (!checkRateLimit(user.id, 10, 60000)) {
      console.warn(`Rate limit exceeded for user ${user.id}`);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { latitude, longitude, address, city, state, zip_code, unit_number, property_type } = await req.json();

    // Validate inputs
    if (latitude !== undefined && (typeof latitude !== "number" || latitude < -90 || latitude > 90)) {
      throw new Error("Invalid latitude");
    }
    if (longitude !== undefined && (typeof longitude !== "number" || longitude < -180 || longitude > 180)) {
      throw new Error("Invalid longitude");
    }
    if (address && (typeof address !== "string" || address.length > 500)) {
      throw new Error("Invalid address");
    }
    if (city && (typeof city !== "string" || city.length > 200)) {
      throw new Error("Invalid city");
    }
    if (state && (typeof state !== "string" || state.length > 50)) {
      throw new Error("Invalid state");
    }
    if (zip_code && (typeof zip_code !== "string" || !/^\d{5}(-\d{4})?$/.test(zip_code))) {
      throw new Error("Invalid ZIP code");
    }
    if (unit_number && (typeof unit_number !== "string" || unit_number.length > 50)) {
      throw new Error("Invalid unit number");
    }

    const attomApiKey = Deno.env.get("ATTOM_API_KEY");
    const walkScoreApiKey = Deno.env.get("WALKSCORE_API_KEY");
    const greatSchoolsApiKey = Deno.env.get("GREATSCHOOLS_API_KEY");

    const results: any = {
      attom: null,
      walkScore: null,
      schools: null,
      valueEstimate: null,
    };

    // Fetch Attom data
    if (attomApiKey && address && (city || state || zip_code)) {
      try {
        const parts: string[] = [];
        if (city) parts.push(city);
        if (state && zip_code) parts.push(`${state} ${zip_code}`);
        else if (state) parts.push(state);
        else if (zip_code) parts.push(zip_code);
        const address2 = parts.join(", ");
        
        // Construct street address with unit number for condominiums
        let streetAddress = address;
        if (unit_number && (property_type === "Condominium" || property_type === "Townhouse" || property_type === "Residential Rental")) {
          streetAddress = `${address} Unit ${unit_number}`;
          console.log("[fetch-property-data] Added unit number to address:", streetAddress);
        }
        
        const fullAddress = [streetAddress, address2].filter(Boolean).join(", ");

        // Try basicprofile first (more tolerant), then fallback to address endpoint
        const attomUrlBasic = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile?address=${encodeURIComponent(fullAddress)}&debug=true`;
        const attomUrlAddr = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/address?address1=${encodeURIComponent(streetAddress)}&address2=${encodeURIComponent(address2)}`;

        console.log("[fetch-property-data] Calling Attom basicprofile:", attomUrlBasic);

        let attomResponse = await fetch(attomUrlBasic, {
          headers: {
            accept: "application/json",
            apikey: attomApiKey,
          },
        });

        let attomData: any = null;
        if (attomResponse.ok) {
          attomData = await attomResponse.json();
        } else {
          console.warn("[fetch-property-data] basicprofile failed:", attomResponse.status);
        }

        if (!attomData?.property?.length) {
          console.warn("[fetch-property-data] No property from basicprofile, trying address endpoint:", attomUrlAddr);
          attomResponse = await fetch(attomUrlAddr, {
            headers: {
              accept: "application/json",
              apikey: attomApiKey,
            },
          });
          if (attomResponse.ok) {
            attomData = await attomResponse.json();
          } else {
            const txt = await attomResponse.text();
            console.error("[fetch-property-data] Address endpoint failed:", attomResponse.status, txt);
          }
        }
        
        if (attomData?.property?.length) {
          const property = attomData.property[0];
          const building = property.building || {};
          const lot = property.lot || {};
          const summary = property.summary || {};
          const assessment = property.assessment || {};

          results.attom = {
            bedrooms: building.rooms?.beds || null,
            bathrooms: building.rooms?.bathsTotal || building.rooms?.bathsFull || null,
            square_feet: building.size?.bldgSize || building.size?.livingSize || null,
            lot_size: lot.lotSize2 || lot.lotSize1 || null,
            year_built: summary.yearBuilt || null,
            property_type: summary.propType || null,
            zoning: lot.zoningType || null,
            parking_spaces: building.parking?.prkgSpaces || null,
            stories: building.summary?.levels || null,
            unit_number: unit_number || null,
            // Tax and assessment data - using field names expected by AddListing page
            annual_property_tax: assessment.tax?.taxAmt || null,
            tax_year: assessment.tax?.taxYear || null,
            tax_assessment_value: assessment.assessed?.assdTtlValue || null,
            assessed_improvement_value: assessment.assessed?.assdImprValue || null,
            assessed_land_value: assessment.assessed?.assdLandValue || null,
          };

          if (property.assessment?.market) {
            results.valueEstimate = {
              estimate: property.assessment.market.mktTtlValue || null,
              high: property.assessment.market.mktHighValue || null,
              low: property.assessment.market.mktLowValue || null,
            };
          }
          
          console.log(`[fetch-property-data] ATTOM data fetched successfully for ${unit_number ? 'unit ' + unit_number : 'property'}:`, results.attom);
        } else {
          console.warn("[fetch-property-data] Attom returned no properties for:", { fullAddress, streetAddress, address2 });
        }
      } catch (error) {
        console.error("[fetch-property-data] Error fetching Attom data:", error);
      }
    } else {
      console.warn("[fetch-property-data] Skipping Attom fetch due to missing address/city/state/zip");
    }

    // Fetch Walk Score data
    if (walkScoreApiKey && latitude && longitude && address) {
      try {
        const walkScoreUrl = `https://api.walkscore.com/score?format=json&address=${encodeURIComponent(
          address
        )}&lat=${latitude}&lon=${longitude}&wsapikey=${walkScoreApiKey}`;

        const walkScoreResponse = await fetch(walkScoreUrl);

        if (walkScoreResponse.ok) {
          const walkScoreData = await walkScoreResponse.json();
          results.walkScore = {
            walkscore: walkScoreData.walkscore || null,
            description: walkScoreData.description || null,
          };
        }
      } catch (error) {
        console.error("Error fetching Walk Score data:", error);
      }
    }

    // Fetch GreatSchools data
    if (greatSchoolsApiKey && latitude && longitude) {
      try {
        const schoolsUrl = `https://api.greatschools.org/schools/nearby?state=${state}&lat=${latitude}&lon=${longitude}&radius=5&limit=5`;

        const schoolsResponse = await fetch(schoolsUrl, {
          headers: {
            "X-API-Key": greatSchoolsApiKey,
          },
        });

        if (schoolsResponse.ok) {
          const schoolsData = await schoolsResponse.json();
          if (schoolsData.schools) {
            results.schools = {
              schools: schoolsData.schools.map((school: any) => ({
                name: school.name,
                type: school.type,
                rating: school.rating,
                distance: school.distance,
              })),
            };
          }
        }
      } catch (error) {
        console.error("Error fetching GreatSchools data:", error);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in fetch-property-data function:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

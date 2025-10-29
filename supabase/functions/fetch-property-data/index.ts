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

    const { latitude, longitude, address, city, state, zip_code } = await req.json();

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
    if (attomApiKey && address) {
      try {
        const attomUrl = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/address?address1=${encodeURIComponent(
          address
        )}&address2=${encodeURIComponent(`${city}, ${state} ${zip_code}`)}`;

        const attomResponse = await fetch(attomUrl, {
          headers: {
            accept: "application/json",
            apikey: attomApiKey,
          },
        });

        if (attomResponse.ok) {
          const attomData = await attomResponse.json();
          if (attomData.property && attomData.property.length > 0) {
            const property = attomData.property[0];
            const building = property.building || {};
            const lot = property.lot || {};

            results.attom = {
              bedrooms: building.rooms?.beds || null,
              bathrooms: building.rooms?.bathstotal || null,
              square_feet: building.size?.bldgsize || null,
              lot_size: lot.lotsize1 || null,
              year_built: building.summary?.yearbuilt || null,
              property_type: building.summary?.propertytype || null,
            };

            // Value estimate from Attom
            if (property.assessment?.market) {
              results.valueEstimate = {
                estimate: property.assessment.market.mktttlvalue || null,
                high: property.assessment.market.mkthighvalue || null,
                low: property.assessment.market.mktlowvalue || null,
              };
            }
          }
        }
      } catch (error) {
        console.error("Error fetching Attom data:", error);
      }
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

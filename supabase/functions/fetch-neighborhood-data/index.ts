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
    const { attomId, latitude, longitude } = await req.json();

    const attomApiKey = Deno.env.get("ATTOM_API_KEY");
    if (!attomApiKey) {
      console.error("ATTOM_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: true, message: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any = {
      schools: [],
      neighborhood: null,
    };

    // Fetch neighborhood data using ATTOM ID if available
    if (attomId) {
      try {
        // ATTOM Property Detail endpoint for neighborhood/school data
        const attomUrl = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail?attomid=${attomId}`;
        console.log("[fetch-neighborhood-data] Calling ATTOM Detail API:", attomUrl);

        const attomResponse = await fetch(attomUrl, {
          headers: {
            accept: "application/json",
            apikey: attomApiKey,
          },
        });

        if (attomResponse.ok) {
          const attomData = await attomResponse.json();
          const property = attomData.property?.[0];

          // Extract school data
          if (property?.school) {
            const schools = property.school;
            results.schools = Object.keys(schools)
              .filter(key => key.startsWith('elementary') || key.startsWith('middle') || key.startsWith('high'))
              .map((key: string) => {
                const school = schools[key];
                return {
                  name: school.name || "Unknown",
                  distanceMiles: school.distance || null,
                  gradeRange: school.gradeRange || null,
                  rating: school.rating || null,
                  type: key.includes('elementary') ? 'Elementary' : key.includes('middle') ? 'Middle' : 'High',
                };
              })
              .filter((s: any) => s.name !== "Unknown");
          }

          // Extract neighborhood data
          if (property?.area) {
            const area = property.area;
            results.neighborhood = {
              walkabilityIndex: area.walkScore || null,
              transitScore: area.transitScore || null,
              crimeIndex: area.crimeIndex || null,
            };
          }
        } else {
          console.warn("[fetch-neighborhood-data] ATTOM Detail API failed:", attomResponse.status);
        }
      } catch (error) {
        console.error("[fetch-neighborhood-data] Error fetching ATTOM data:", error);
      }
    }

    // Fallback: Use lat/long for school lookup if ATTOM ID didn't work
    if (results.schools.length === 0 && latitude && longitude) {
      try {
        // ATTOM School API endpoint
        const schoolUrl = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/school/detail?latitude=${latitude}&longitude=${longitude}&radius=3`;
        console.log("[fetch-neighborhood-data] Calling ATTOM School API:", schoolUrl);

        const schoolResponse = await fetch(schoolUrl, {
          headers: {
            accept: "application/json",
            apikey: attomApiKey,
          },
        });

        if (schoolResponse.ok) {
          const schoolData = await schoolResponse.json();
          if (schoolData.school) {
            results.schools = schoolData.school.map((school: any) => ({
              name: school.filingname || school.name || "Unknown",
              distanceMiles: school.distance ? (school.distance * 0.000621371).toFixed(2) : null,
              gradeRange: school.gradeLevel || null,
              rating: school.rating || null,
              type: school.level || "Unknown",
            }));
          }
        }
      } catch (error) {
        console.error("[fetch-neighborhood-data] Error fetching schools:", error);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[fetch-neighborhood-data] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      JSON.stringify({ error: true, message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

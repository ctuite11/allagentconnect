import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude, address, city, state, zip_code } = await req.json();

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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

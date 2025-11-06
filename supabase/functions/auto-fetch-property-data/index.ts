import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const { listing_id } = await req.json();

    if (!listing_id) {
      throw new Error("listing_id is required");
    }

    console.log(`[auto-fetch-property-data] Processing listing: ${listing_id}`);

    // Initialize Supabase client with service role key for full access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the listing data
    const { data: listing, error: fetchError } = await supabase
      .from("listings")
      .select("id, address, city, state, zip_code, latitude, longitude")
      .eq("id", listing_id)
      .single();

    if (fetchError || !listing) {
      console.error(`[auto-fetch-property-data] Failed to fetch listing: ${fetchError?.message}`);
      throw new Error("Listing not found");
    }

    // Check if we have required data
    if (!listing.address || !listing.city || !listing.state) {
      console.log(`[auto-fetch-property-data] Skipping - missing address data for listing ${listing_id}`);
      return new Response(
        JSON.stringify({ message: "Skipped - missing required address fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const attomApiKey = Deno.env.get("ATTOM_API_KEY");
    const walkScoreApiKey = Deno.env.get("WALKSCORE_API_KEY");
    const greatSchoolsApiKey = Deno.env.get("GREATSCHOOLS_API_KEY");

    const updates: any = {};

    // Fetch ATTOM data
    if (attomApiKey) {
      try {
        const parts: string[] = [];
        if (listing.city) parts.push(listing.city);
        if (listing.state && listing.zip_code) parts.push(`${listing.state} ${listing.zip_code}`);
        else if (listing.state) parts.push(listing.state);
        else if (listing.zip_code) parts.push(listing.zip_code);
        const address2 = parts.join(", ");
        const fullAddress = [listing.address, address2].filter(Boolean).join(", ");

        console.log(`[auto-fetch-property-data] Fetching ATTOM data for: ${fullAddress}`);

        const attomUrl = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile?address=${encodeURIComponent(fullAddress)}`;

        const attomResponse = await fetch(attomUrl, {
          headers: {
            accept: "application/json",
            apikey: attomApiKey,
          },
        });

        if (attomResponse.ok) {
          const attomData = await attomResponse.json();
          
          if (attomData?.property?.length) {
            const property = attomData.property[0];
            const building = property.building || {};
            const lot = property.lot || {};
            const summary = property.summary || {};

            // Update ATTOM data
            updates.attom_data = {
              bedrooms: building.rooms?.beds || null,
              bathrooms: building.rooms?.bathstotal || building.rooms?.bathsfull || null,
              square_feet: building.size?.bldgsize || building.size?.livingsize || null,
              lot_size: lot.lotsize2 || lot.lotsize1 || null,
              year_built: summary.yearbuilt || null,
              property_type: summary.proptype || null,
              zoning: lot.zoning || null,
              parking_spaces: building.parking?.prkgSpaces || null,
              stories: building.summary?.stories || null,
            };

            // Update basic listing fields if empty
            if (!listing.latitude && property.location?.latitude) {
              updates.latitude = property.location.latitude;
            }
            if (!listing.longitude && property.location?.longitude) {
              updates.longitude = property.location.longitude;
            }

            // Update value estimate
            if (property.assessment?.market) {
              updates.value_estimate = {
                estimate: property.assessment.market.mktttlvalue || null,
                high: property.assessment.market.mkthighvalue || null,
                low: property.assessment.market.mktlowvalue || null,
              };
            }

            console.log(`[auto-fetch-property-data] ATTOM data fetched successfully`);
          } else {
            console.warn(`[auto-fetch-property-data] No property data returned from ATTOM`);
          }
        } else {
          console.error(`[auto-fetch-property-data] ATTOM API error: ${attomResponse.status}`);
        }
      } catch (error) {
        console.error(`[auto-fetch-property-data] Error fetching ATTOM data:`, error);
      }
    }

    // Fetch Walk Score data
    if (walkScoreApiKey && listing.latitude && listing.longitude && listing.address) {
      try {
        console.log(`[auto-fetch-property-data] Fetching Walk Score data`);

        const walkScoreUrl = `https://api.walkscore.com/score?format=json&address=${encodeURIComponent(
          listing.address
        )}&lat=${listing.latitude}&lon=${listing.longitude}&wsapikey=${walkScoreApiKey}`;

        const walkScoreResponse = await fetch(walkScoreUrl);

        if (walkScoreResponse.ok) {
          const walkScoreData = await walkScoreResponse.json();
          updates.walk_score_data = {
            walkscore: walkScoreData.walkscore || null,
            description: walkScoreData.description || null,
          };
          console.log(`[auto-fetch-property-data] Walk Score data fetched successfully`);
        }
      } catch (error) {
        console.error(`[auto-fetch-property-data] Error fetching Walk Score:`, error);
      }
    }

    // Fetch GreatSchools data
    if (greatSchoolsApiKey && listing.latitude && listing.longitude) {
      try {
        console.log(`[auto-fetch-property-data] Fetching Schools data`);

        const schoolsUrl = `https://api.greatschools.org/schools/nearby?state=${listing.state}&lat=${listing.latitude}&lon=${listing.longitude}&radius=5&limit=5`;

        const schoolsResponse = await fetch(schoolsUrl, {
          headers: {
            "X-API-Key": greatSchoolsApiKey,
          },
        });

        if (schoolsResponse.ok) {
          const schoolsData = await schoolsResponse.json();
          if (schoolsData.schools) {
            updates.schools_data = {
              schools: schoolsData.schools.map((school: any) => ({
                name: school.name,
                type: school.type,
                rating: school.rating,
                distance: school.distance,
              })),
            };
            console.log(`[auto-fetch-property-data] Schools data fetched successfully`);
          }
        }
      } catch (error) {
        console.error(`[auto-fetch-property-data] Error fetching Schools:`, error);
      }
    }

    // Update the listing with fetched data
    if (Object.keys(updates).length > 0) {
      console.log(`[auto-fetch-property-data] Updating listing with fetched data`);
      
      const { error: updateError } = await supabase
        .from("listings")
        .update(updates)
        .eq("id", listing_id);

      if (updateError) {
        console.error(`[auto-fetch-property-data] Error updating listing:`, updateError);
        throw updateError;
      }

      console.log(`[auto-fetch-property-data] Listing updated successfully`);
    } else {
      console.log(`[auto-fetch-property-data] No data to update`);
    }

    return new Response(
      JSON.stringify({ success: true, updated_fields: Object.keys(updates) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[auto-fetch-property-data] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

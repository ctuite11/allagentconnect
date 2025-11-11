import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to get walk score description
function getWalkScoreDescription(score: number | null): string {
  if (!score) return "Walk Score not available";
  if (score >= 90) return "Walker's Paradise - Daily errands do not require a car";
  if (score >= 70) return "Very Walkable - Most errands can be accomplished on foot";
  if (score >= 50) return "Somewhat Walkable - Some errands can be accomplished on foot";
  if (score >= 25) return "Car-Dependent - Most errands require a car";
  return "Very Car-Dependent - Almost all errands require a car";
}

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
    const googleMapsApiKey = Deno.env.get("VITE_GOOGLE_MAPS_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the listing data
    const { data: listing, error: fetchError } = await supabase
      .from("listings")
      .select("id, address, city, state, zip_code, latitude, longitude, property_type, condo_details")
      .eq("id", listing_id)
      .single();

    if (fetchError || !listing) {
      console.error(`[auto-fetch-property-data] Failed to fetch listing: ${fetchError?.message}`);
      throw new Error("Listing not found");
    }

    // Check if we have required data - address can contain full address from Google Places
    if (!listing.address) {
      console.log(`[auto-fetch-property-data] Skipping - no address for listing ${listing_id}`);
      return new Response(
        JSON.stringify({ message: "Skipped - no address provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract unit number for condominiums
    let unitNumber = null;
    if (listing.property_type === "Condominium" && listing.condo_details) {
      unitNumber = listing.condo_details.unit_number;
      console.log(`[auto-fetch-property-data] Detected condo unit number: ${unitNumber}`);
    }

    // Parse address if city/state/zip are empty but address contains full address
    let city = listing.city;
    let state = listing.state;
    let zipCode = listing.zip_code;
    
    if (!city || !state || !zipCode) {
      // Try to parse from full address (e.g., "9 Short St, Charlestown, MA 02129, USA")
      const addressParts = listing.address.split(',').map((p: string) => p.trim());
      
      if (addressParts.length >= 3) {
        // Second to last part usually contains "State ZIP"
        const stateZipPart = addressParts[addressParts.length - 2];
        const stateZipMatch = stateZipPart.match(/([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
        
        if (stateZipMatch) {
          state = state || stateZipMatch[1];
          zipCode = zipCode || stateZipMatch[2];
        }
        
        // City is typically the second part in US addresses
        if (addressParts.length >= 3) {
          city = city || addressParts[addressParts.length - 3];
        }
      }
      
      console.log(`[auto-fetch-property-data] Parsed address: city=${city}, state=${state}, zip=${zipCode}`);
    }

    const attomApiKey = Deno.env.get("ATTOM_API_KEY");
    const updates: any = {};

    // Geocode if coordinates are missing
    let latitude = listing.latitude;
    let longitude = listing.longitude;

    if ((!latitude || !longitude) && googleMapsApiKey) {
      try {
        // Use parsed or existing city/state/zip for geocoding
        const parts: string[] = [];
        if (city) parts.push(city);
        if (state && zipCode) parts.push(`${state} ${zipCode}`);
        else if (state) parts.push(state);
        else if (zipCode) parts.push(zipCode);
        const address2 = parts.join(", ");
        
        const fullAddress = address2 ? [listing.address.split(',')[0], address2].join(", ") : listing.address;
        console.log(`[auto-fetch-property-data] Geocoding address: ${fullAddress}`);

        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${googleMapsApiKey}`;
        const geocodeResponse = await fetch(geocodeUrl);

        if (geocodeResponse.ok) {
          const geocodeData = await geocodeResponse.json();
          if (geocodeData.results?.[0]?.geometry?.location) {
            latitude = geocodeData.results[0].geometry.location.lat;
            longitude = geocodeData.results[0].geometry.location.lng;
            console.log(`[auto-fetch-property-data] Geocoded coordinates: ${latitude}, ${longitude}`);
          }
        } else {
          console.error(`[auto-fetch-property-data] Geocoding API error: ${geocodeResponse.status}`);
        }
      } catch (error) {
        console.error(`[auto-fetch-property-data] Error geocoding:`, error);
      }
    }

    // Store geocoded coordinates
    if (latitude && longitude && (!listing.latitude || !listing.longitude)) {
      updates.latitude = latitude;
      updates.longitude = longitude;
    }

    // Fetch ATTOM data
    if (attomApiKey) {
      try {
        // Use parsed or existing city/state/zip
        const parts: string[] = [];
        if (city) parts.push(city);
        if (state && zipCode) parts.push(`${state} ${zipCode}`);
        else if (state) parts.push(state);
        else if (zipCode) parts.push(zipCode);
        const address2 = parts.join(", ");
        
        // Construct the street address with unit number if available
        let streetAddress = listing.address.split(',')[0];
        if (unitNumber) {
          streetAddress = `${streetAddress} Unit ${unitNumber}`;
          console.log(`[auto-fetch-property-data] Added unit number to address: ${streetAddress}`);
        }
        
        // If no parsed parts, use full address as-is
        const fullAddress = address2 ? [streetAddress, address2].join(", ") : streetAddress;

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

            // Update ATTOM data with condo-specific information
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
              unit_number: unitNumber || null,
            };

            console.log(`[auto-fetch-property-data] ATTOM data fetched successfully for ${unitNumber ? 'condo unit ' + unitNumber : 'property'}`);
          } else {
            console.warn(`[auto-fetch-property-data] No property data returned from ATTOM`);
          }
        } else {
          console.error(`[auto-fetch-property-data] ATTOM API error: ${attomResponse.status}`);
        }
      } catch (error) {
        console.error(`[auto-fetch-property-data] Error fetching ATTOM data:`, error);
      }

      // Fetch ATTOM Schools data
      if (latitude && longitude && state) {
        try {
          console.log(`[auto-fetch-property-data] Fetching ATTOM Schools data`);

          const schoolsUrl = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/school/snapshot?latitude=${latitude}&longitude=${longitude}&radius=5`;

          const schoolsResponse = await fetch(schoolsUrl, {
            headers: {
              accept: "application/json",
              apikey: attomApiKey,
            },
          });

          if (schoolsResponse.ok) {
            const schoolsData = await schoolsResponse.json();
            if (schoolsData?.school?.length) {
              updates.schools_data = {
                schools: schoolsData.school.slice(0, 10).map((school: any) => ({
                  name: school.filedAs || school.institutionName || 'Unknown School',
                  type: school.educationLevels?.join(', ') || school.gradeLevel || 'Not specified',
                  rating: school.greatSchoolsRating || null,
                  distance: school.distance?.value || null,
                  address: school.address?.oneLine || null,
                  phone: school.phone || null,
                  website: school.website || null,
                })),
              };
              console.log(`[auto-fetch-property-data] ATTOM Schools data fetched: ${schoolsData.school.length} schools found`);
            }
          } else {
            console.error(`[auto-fetch-property-data] ATTOM Schools API error: ${schoolsResponse.status}`);
          }
        } catch (error) {
          console.error(`[auto-fetch-property-data] Error fetching ATTOM Schools:`, error);
        }
      }

      // Fetch ATTOM Neighborhood/Walk Score data
      if (latitude && longitude) {
        try {
          console.log(`[auto-fetch-property-data] Fetching ATTOM Neighborhood data`);

          const neighborhoodUrl = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/area/full?latitude=${latitude}&longitude=${longitude}`;

          const neighborhoodResponse = await fetch(neighborhoodUrl, {
            headers: {
              accept: "application/json",
              apikey: attomApiKey,
            },
          });

          if (neighborhoodResponse.ok) {
            const neighborhoodData = await neighborhoodResponse.json();
            
            // Extract walkability and transit data from ATTOM neighborhood data
            const walkabilityScore = neighborhoodData?.area?.[0]?.vintage?.[0]?.area1?.[0]?.walkScore || null;
            const transitScore = neighborhoodData?.area?.[0]?.vintage?.[0]?.area1?.[0]?.transitScore || null;
            
            if (walkabilityScore || transitScore) {
              updates.walk_score_data = {
                walkscore: walkabilityScore,
                description: getWalkScoreDescription(walkabilityScore),
                transit: transitScore ? { score: transitScore } : null,
              };
              console.log(`[auto-fetch-property-data] ATTOM Neighborhood data fetched: Walk Score ${walkabilityScore || 'N/A'}`);
            }
          } else {
            console.error(`[auto-fetch-property-data] ATTOM Neighborhood API error: ${neighborhoodResponse.status}`);
          }
        } catch (error) {
          console.error(`[auto-fetch-property-data] Error fetching ATTOM Neighborhood data:`, error);
        }
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

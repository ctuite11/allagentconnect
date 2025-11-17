import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ProcessHotSheetRequest {
  hotSheetId: string;
  sendInitialBatch?: boolean;
  selectedListingIds?: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { hotSheetId, sendInitialBatch = false, selectedListingIds }: ProcessHotSheetRequest = await req.json();

    console.log("Processing hot sheet:", hotSheetId);

    // Get hot sheet with client info
    const { data: hotSheet, error: hotSheetError } = await supabaseClient
      .from("hot_sheets")
      .select(`
        *,
        clients (
          first_name,
          last_name,
          email
        )
      `)
      .eq("id", hotSheetId)
      .single();

    if (hotSheetError) throw hotSheetError;
    if (!hotSheet) throw new Error("Hot sheet not found");

    console.log("Hot sheet criteria:", hotSheet.criteria);

    // Build query to match listings
    let query = supabaseClient
      .from("listings")
      .select("*");

    const criteria = hotSheet.criteria || {};

    // Map criteria property type values to database values
    const propertyTypeMap: Record<string, string> = {
      'single_family': 'Single Family',
      'condo': 'Condominium',
      'multi_family': 'Multi Family',
      'townhouse': 'Townhouse',
      'land': 'Land',
      'commercial': 'Commercial',
      'business_opp': 'Business Opportunity'
    };

    // Apply filters based on criteria
    if (criteria.propertyTypes && criteria.propertyTypes.length > 0) {
      const mappedTypes = criteria.propertyTypes.map((type: string) => 
        propertyTypeMap[type] || type
      );
      query = query.in("property_type", mappedTypes);
    }

    if (criteria.statuses && criteria.statuses.length > 0) {
      query = query.in("status", criteria.statuses);
    } else {
      // Default to match Search page behavior
      query = query.in("status", ["active", "coming_soon"]);
    }
    if (criteria.minPrice) {
      query = query.gte("price", criteria.minPrice);
    }

    if (criteria.maxPrice) {
      query = query.lte("price", criteria.maxPrice);
    }

    if (criteria.bedrooms) {
      query = query.gte("bedrooms", criteria.bedrooms);
    }

    if (criteria.bathrooms) {
      query = query.gte("bathrooms", criteria.bathrooms);
    }

    if (criteria.minSqft) {
      query = query.gte("square_feet", criteria.minSqft);
    }

    if (criteria.maxSqft) {
      query = query.lte("square_feet", criteria.maxSqft);
    }

    if (criteria.city) {
      query = query.ilike("city", `%${criteria.city}%`);
    }

    if (criteria.zipCode) {
      query = query.eq("zip_code", criteria.zipCode);
    }

    if (criteria.state) {
      query = query.eq("state", criteria.state);
    }

    // Handle cities with neighborhoods
    if (criteria.cities && criteria.cities.length > 0) {
      const cityFilters = criteria.cities.map((cityStr: string) => {
        const parts = cityStr.split(',');
        const cityPart = parts[0].trim();
        
        // Check if it's a city-neighborhood format (e.g., "Boston-Charlestown")
        if (cityPart.includes('-')) {
          const [city, neighborhood] = cityPart.split('-').map((s: string) => s.trim());
          return { city, neighborhood };
        }
        
        return { city: cityPart, neighborhood: null };
      });
      
      // Group by cities that have neighborhoods vs just cities
      const citiesWithNeighborhoods = cityFilters.filter((f: {city: string, neighborhood: string | null}) => f.neighborhood);
      const citiesOnly = cityFilters.filter((f: {city: string, neighborhood: string | null}) => !f.neighborhood).map((f: {city: string, neighborhood: string | null}) => f.city);
      
      // Build complex filter with proper quoting (handles spaces like "Back Bay")
      const q = (v: string) => `"${String(v).replace(/"/g, '\\"')}"`;
      if (citiesWithNeighborhoods.length > 0 && citiesOnly.length > 0) {
        query = query.or(
          `city.in.(${citiesOnly.map(q).join(',')}),` +
          citiesWithNeighborhoods.map((f: {city: string, neighborhood: string | null}) => `and(city.eq.${q(f.city)},neighborhood.eq.${q(f.neighborhood!)})`).join(',')
        );
      } else if (citiesWithNeighborhoods.length > 0) {
        query = query.or(
          citiesWithNeighborhoods.map((f: {city: string, neighborhood: string | null}) => `and(city.eq.${q(f.city)},neighborhood.eq.${q(f.neighborhood!)})`).join(',')
        );
      } else if (citiesOnly.length > 0) {
        query = query.in("city", citiesOnly);
      }
    }

    const { data: matchingListings, error: listingsError } = await query.order("created_at", { ascending: false });

    if (listingsError) throw listingsError;

    console.log("Found matching listings:", matchingListings?.length || 0);

    // Get already sent listings
    const { data: sentListings } = await supabaseClient
      .from("hot_sheet_sent_listings")
      .select("listing_id")
      .eq("hot_sheet_id", hotSheetId);

    const sentListingIds = new Set(sentListings?.map(sl => sl.listing_id) || []);

    // Filter out already sent listings or use selected listings
    let newListings;
    if (selectedListingIds && selectedListingIds.length > 0) {
      // Use only the selected listings
      newListings = matchingListings?.filter(listing => 
        selectedListingIds.includes(listing.id) && !sentListingIds.has(listing.id)
      ) || [];
    } else {
      // Use all new listings not yet sent
      newListings = matchingListings?.filter(listing => !sentListingIds.has(listing.id)) || [];
    }

    console.log("New listings to send:", newListings.length);

    if (newListings.length === 0) {
      return new Response(
        JSON.stringify({ message: "No new listings found", matchingCount: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email if requested or if notification settings allow
    const shouldSendEmail = sendInitialBatch || 
      (hotSheet.notification_schedule === "immediately" && 
       (hotSheet.notify_client_email || hotSheet.notify_agent_email));

    if (shouldSendEmail) {
      const recipients = [];
      
      if (hotSheet.notify_agent_email) {
        const { data: agentProfile } = await supabaseClient
          .from("agent_profiles")
          .select("email")
          .eq("id", hotSheet.user_id)
          .single();
        
        if (agentProfile?.email) {
          recipients.push(agentProfile.email);
        }
      }

      if (hotSheet.notify_client_email) {
        // Try to get client email from criteria first, then from clients table
        const clientEmail = hotSheet.criteria?.clientEmail || hotSheet.clients?.email;
        if (clientEmail) {
          recipients.push(clientEmail);
        }
      }

      if (recipients.length > 0) {
        const baseUrl = req.headers.get("origin") || "http://localhost:5173";
        const accessUrl = `${baseUrl}/client-hot-sheet/${hotSheet.access_token}`;
        
        const listingsHtml = newListings.slice(0, 5).map(listing => {
          const photos = listing.photos || [];
          const photoUrl = photos[0]?.url || '';
          
          return `
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
            ${photoUrl ? `<img src="${photoUrl}" alt="${listing.address}" style="width: 100%; height: 200px; object-fit: cover;" />` : ''}
            <div style="padding: 16px;">
              <h3 style="margin: 0 0 8px 0; font-size: 18px;">${listing.address}</h3>
              <p style="margin: 4px 0; color: #6b7280;">${listing.city}, ${listing.state} ${listing.zip_code}</p>
              <p style="margin: 8px 0; font-size: 24px; font-weight: bold; color: #2563eb;">$${listing.price?.toLocaleString()}</p>
              ${listing.bedrooms || listing.bathrooms ? `
                <p style="margin: 4px 0; color: #6b7280;">
                  ${listing.bedrooms ? `${listing.bedrooms} beds` : ''} 
                  ${listing.bathrooms ? `• ${listing.bathrooms} baths` : ''}
                  ${listing.square_feet ? `• ${listing.square_feet.toLocaleString()} sqft` : ''}
                </p>
              ` : ''}
            </div>
          </div>
        `;
        }).join('');

        const clientName = hotSheet.criteria?.clientFirstName && hotSheet.criteria?.clientLastName ?
          `${hotSheet.criteria.clientFirstName} ${hotSheet.criteria.clientLastName}` :
          hotSheet.clients ? 
          `${hotSheet.clients.first_name} ${hotSheet.clients.last_name}` : 
          "Client";

        const { data, error: emailError } = await resend.emails.send({
          from: "AAC Worldwide <hello@allagentconnect.com>",
          to: recipients,
          subject: `${newListings.length} New Properties Match Your Search - ${hotSheet.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1f2937; margin-bottom: 16px;">New Properties Available!</h1>
              <p style="color: #6b7280; margin-bottom: 24px;">
                We found ${newListings.length} new ${newListings.length === 1 ? 'property' : 'properties'} matching your hot sheet "${hotSheet.name}"${hotSheet.clients ? ` for ${clientName}` : ''}.
              </p>
              
              ${listingsHtml}
              
              ${newListings.length > 5 ? `
                <p style="color: #6b7280; margin: 16px 0;">
                  And ${newListings.length - 5} more ${newListings.length - 5 === 1 ? 'property' : 'properties'}...
                </p>
              ` : ''}
              
              <div style="margin-top: 32px; padding: 16px; background-color: #f3f4f6; border-radius: 8px;">
                <p style="margin: 0 0 12px 0; color: #1f2937;">View all properties and add comments:</p>
                <a href="${accessUrl}" 
                   style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                  View Hot Sheet
                </a>
              </div>
            </div>
          `,
        });

        if (emailError) {
          console.error("Resend API error:", emailError);
          throw emailError;
        }

        console.log("Email sent successfully to:", recipients);

        console.log("Email sent to:", recipients);
      }
    }

    // Mark listings as sent
    const sentRecords = newListings.map(listing => ({
      hot_sheet_id: hotSheetId,
      listing_id: listing.id,
    }));

    if (sentRecords.length > 0) {
      await supabaseClient
        .from("hot_sheet_sent_listings")
        .insert(sentRecords);
    }

    // Update last_sent_at
    await supabaseClient
      .from("hot_sheets")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", hotSheetId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        matchingCount: newListings.length,
        message: `Processed ${newListings.length} new ${newListings.length === 1 ? 'listing' : 'listings'}`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error processing hot sheet:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
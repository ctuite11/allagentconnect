import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Listing {
  listing_id: string;
  address: string;
  city: string;
  state: string;
  price: number;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const listing: Listing = await req.json();
    console.log("Processing new listing:", listing.listing_id);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find matching client needs
    let clientNeedsQuery = supabase
      .from("client_needs")
      .select("*, profiles!client_needs_submitted_by_fkey(email, first_name, last_name)");

    if (listing.state) {
      clientNeedsQuery = clientNeedsQuery.eq("state", listing.state);
    }
    if (listing.city) {
      clientNeedsQuery = clientNeedsQuery.ilike("city", `%${listing.city}%`);
    }
    if (listing.property_type) {
      clientNeedsQuery = clientNeedsQuery.eq("property_type", listing.property_type);
    }
    if (listing.price) {
      clientNeedsQuery = clientNeedsQuery.gte("max_price", listing.price);
    }

    const { data: matchingNeeds, error: needsError } = await clientNeedsQuery;
    if (needsError) throw needsError;

    console.log(`Found ${matchingNeeds?.length || 0} matching client needs`);

    // Find matching hot sheets
    const { data: hotSheets, error: hotSheetsError } = await supabase
      .from("hot_sheets")
      .select("*, profiles!hot_sheets_user_id_fkey(email, first_name, last_name)")
      .eq("is_active", true);

    if (hotSheetsError) throw hotSheetsError;

    // Filter hot sheets based on criteria
    const matchingHotSheets = hotSheets?.filter((sheet: any) => {
      const criteria = sheet.criteria;
      
      // Property type mapping
      const propertyTypeMap: Record<string, string> = {
        'single_family': 'Single Family',
        'condo': 'Condominium',
        'multi_family': 'Multi Family',
        'townhouse': 'Townhouse',
        'land': 'Land',
        'commercial': 'Commercial',
        'business_opp': 'Business Opportunity'
      };
      
      // Check state
      if (criteria.state && criteria.state !== listing.state) return false;
      
      // Check cities
      if (criteria.cities && criteria.cities.length > 0) {
        const cityMatches = criteria.cities.some((city: string) => 
          city.toLowerCase().includes(listing.city?.toLowerCase() || "")
        );
        if (!cityMatches) return false;
      }
      
      // Check property types - map criteria values to database values
      if (criteria.propertyTypes && criteria.propertyTypes.length > 0) {
        const mappedTypes = criteria.propertyTypes.map((type: string) => 
          propertyTypeMap[type] || type
        );
        if (!mappedTypes.includes(listing.property_type)) return false;
      }
      
      // Check price range
      if (criteria.minPrice && listing.price < criteria.minPrice) return false;
      if (criteria.maxPrice && listing.price > criteria.maxPrice) return false;
      
      // Check bedrooms
      if (criteria.bedrooms && listing.bedrooms && listing.bedrooms < criteria.bedrooms) return false;
      
      // Check bathrooms
      if (criteria.bathrooms && listing.bathrooms && listing.bathrooms < criteria.bathrooms) return false;
      
      return true;
    }) || [];

    console.log(`Found ${matchingHotSheets.length} matching hot sheets`);

    // Get agent info for the listing
    const { data: agentProfile, error: agentError } = await supabase
      .from("agent_profiles")
      .select("first_name, last_name, email, cell_phone")
      .eq("id", (await supabase.from("listings").select("agent_id").eq("id", listing.listing_id).single()).data?.agent_id)
      .single();

    if (agentError) {
      console.error("Error fetching agent profile:", agentError);
    }

    const agentName = agentProfile 
      ? `${agentProfile.first_name} ${agentProfile.last_name}`.trim()
      : "An agent";
    const agentEmail = agentProfile?.email || "agent@example.com";
    const agentPhone = agentProfile?.cell_phone || "";

    // Combine all recipients (dedupe by email)
    const recipientsMap = new Map();

    matchingNeeds?.forEach((need: any) => {
      if (need.profiles?.email) {
        recipientsMap.set(need.profiles.email, {
          email: need.profiles.email,
          first_name: need.profiles.first_name,
          last_name: need.profiles.last_name,
          source: "client_need",
        });
      }
    });

    matchingHotSheets?.forEach((sheet: any) => {
      if (sheet.profiles?.email) {
        recipientsMap.set(sheet.profiles.email, {
          email: sheet.profiles.email,
          first_name: sheet.profiles.first_name,
          last_name: sheet.profiles.last_name,
          source: "hot_sheet",
        });
      }
    });

    const recipients = Array.from(recipientsMap.values());
    console.log(`Sending to ${recipients.length} unique recipients`);

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No matching buyers found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send emails to all recipients
    const emailPromises = recipients.map(async (recipient) => {
      const recipientName = recipient.first_name
        ? `${recipient.first_name} ${recipient.last_name || ""}`.trim()
        : "there";

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">🏡 New Property Alert!</h1>
            </div>
            
            <div style="background-color: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">Hi ${recipientName},</p>
              
              <p style="margin: 20px 0; font-size: 16px; color: #667eea; font-weight: bold;">
                A new property just hit the market that matches your search criteria!
              </p>
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h2 style="margin: 0 0 15px 0; color: #333; font-size: 20px;">${listing.address}</h2>
                <p style="margin: 5px 0; color: #666;">📍 ${listing.city}, ${listing.state}</p>
                <p style="margin: 15px 0 10px 0; font-size: 28px; color: #667eea; font-weight: bold;">
                  $${listing.price.toLocaleString()}
                </p>
                <div style="display: flex; gap: 20px; margin-top: 15px; flex-wrap: wrap;">
                  ${listing.bedrooms ? `<div style="flex: 1; min-width: 100px;"><span style="font-weight: bold;">🛏️ ${listing.bedrooms}</span> bed</div>` : ""}
                  ${listing.bathrooms ? `<div style="flex: 1; min-width: 100px;"><span style="font-weight: bold;">🛁 ${listing.bathrooms}</span> bath</div>` : ""}
                  ${listing.square_feet ? `<div style="flex: 1; min-width: 100px;"><span style="font-weight: bold;">📐 ${listing.square_feet.toLocaleString()}</span> sqft</div>` : ""}
                </div>
              </div>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #fafafa; border-left: 4px solid #667eea; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #555;">
                  💡 <strong>Why you're seeing this:</strong> This property matches your ${recipient.source === "hot_sheet" ? "hot sheet criteria" : "buyer preferences"}.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${SUPABASE_URL.replace('.supabase.co', '.lovable.app')}/property/${listing.listing_id}" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  View Full Listing Details
                </a>
              </div>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Contact the Listing Agent</h3>
                <p style="margin: 5px 0;"><strong>Agent:</strong> ${agentName}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${agentEmail}" style="color: #667eea;">${agentEmail}</a></p>
                ${agentPhone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${agentPhone}</p>` : ""}
              </div>
              
              <div style="margin-top: 30px; padding: 15px; background-color: #f0f7ff; border-radius: 8px; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #555;">
                  ⚡ Act fast! New listings get a lot of interest in the first 48 hours.
                </p>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
              <p>You're receiving this because a new listing matches your search criteria.</p>
              <p>Update your preferences in your account settings to change notification preferences.</p>
            </div>
          </body>
        </html>
      `;

      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Property Alerts <noreply@allagentconnect.com>",
            to: [recipient.email],
            reply_to: agentEmail,
            subject: `🏡 New Listing Alert: ${listing.address}`,
            html: html,
          }),
        });

        if (!response.ok) {
          throw new Error(`Resend API error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`Email sent to ${recipient.email}:`, data);
        return { success: true, email: recipient.email };
      } catch (error) {
        console.error(`Failed to send email to ${recipient.email}:`, error);
        return { success: false, email: recipient.email, error };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(`Notification complete: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        total_matches: recipients.length,
        client_needs_matches: matchingNeeds?.length || 0,
        hot_sheet_matches: matchingHotSheets.length,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-matching-buyers function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

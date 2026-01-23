import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  neighborhood?: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const listing: Listing = await req.json();
    console.log("[notify-matching-buyers] Processing listing:", listing.listing_id);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find matching client needs
    let clientNeedsQuery = supabase
      .from("client_needs")
      .select("*, profiles!client_needs_submitted_by_fkey(email, first_name, last_name)");

    if (listing.state) clientNeedsQuery = clientNeedsQuery.eq("state", listing.state);
    if (listing.city) clientNeedsQuery = clientNeedsQuery.ilike("city", `%${listing.city}%`);
    if (listing.property_type) clientNeedsQuery = clientNeedsQuery.eq("property_type", listing.property_type);
    if (listing.price) clientNeedsQuery = clientNeedsQuery.gte("max_price", listing.price);

    const { data: matchingNeeds, error: needsError } = await clientNeedsQuery;
    if (needsError) throw needsError;

    // Find matching hot sheets
    const { data: hotSheets, error: hotSheetsError } = await supabase
      .from("hot_sheets")
      .select("*, profiles!hot_sheets_user_id_fkey(email, first_name, last_name)")
      .eq("is_active", true);

    if (hotSheetsError) throw hotSheetsError;

    // Filter hot sheets based on criteria
    const matchingHotSheets = hotSheets?.filter((sheet: any) => {
      const criteria = sheet.criteria;
      if (criteria.state && criteria.state !== listing.state) return false;
      if (criteria.cities?.length > 0 && !criteria.cities.some((c: string) => c.toLowerCase().includes(listing.city?.toLowerCase()))) return false;
      if (criteria.minPrice && listing.price < criteria.minPrice) return false;
      if (criteria.maxPrice && listing.price > criteria.maxPrice) return false;
      if (criteria.bedrooms && listing.bedrooms && listing.bedrooms < criteria.bedrooms) return false;
      if (criteria.bathrooms && listing.bathrooms && listing.bathrooms < criteria.bathrooms) return false;
      return true;
    }) || [];

    // Get agent info for the listing
    const { data: listingData } = await supabase
      .from("listings")
      .select("agent_id")
      .eq("id", listing.listing_id)
      .single();

    const { data: agentProfile } = await supabase
      .from("agent_profiles")
      .select("first_name, last_name, email, cell_phone")
      .eq("id", listingData?.agent_id)
      .single();

    const agentName = agentProfile ? `${agentProfile.first_name} ${agentProfile.last_name}`.trim() : "An agent";
    const agentEmail = agentProfile?.email || "";

    // Combine recipients (dedupe by email)
    const recipientsMap = new Map();
    matchingNeeds?.forEach((need: any) => {
      if (need.profiles?.email) {
        recipientsMap.set(need.profiles.email, {
          email: need.profiles.email,
          first_name: need.profiles.first_name,
          source: "client_need",
        });
      }
    });
    matchingHotSheets?.forEach((sheet: any) => {
      if (sheet.profiles?.email) {
        recipientsMap.set(sheet.profiles.email, {
          email: sheet.profiles.email,
          first_name: sheet.profiles.first_name,
          source: "hot_sheet",
        });
      }
    });

    const recipients = Array.from(recipientsMap.values());
    console.log(`[notify-matching-buyers] Enqueuing ${recipients.length} jobs`);

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No matching buyers found", queued: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enqueue jobs
    const emailJobs = recipients.map((recipient) => ({
      payload: {
        provider: "resend",
        template: "new-listing-alert",
        to: recipient.email,
        subject: `🏡 New Listing Alert: ${listing.address}`,
        reply_to: agentEmail,
        variables: {
          recipientName: recipient.first_name || "there",
          source: recipient.source,
          address: listing.address,
          city: listing.city,
          state: listing.state,
          price: listing.price.toLocaleString(),
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          squareFeet: listing.square_feet?.toLocaleString(),
          listingId: listing.listing_id,
          agentName,
          agentEmail,
          agentPhone: agentProfile?.cell_phone,
          contentHtml: `
            <h2>🏡 New Property Alert!</h2>
            <p>Hi ${recipient.first_name || "there"},</p>
            <p>A new property just hit the market that matches your ${recipient.source === "hot_sheet" ? "hot sheet criteria" : "buyer preferences"}!</p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px;">${listing.address}</h3>
              <p style="margin: 5px 0;">📍 ${listing.city}, ${listing.state}</p>
              <p style="margin: 10px 0; font-size: 24px; color: #2754C5; font-weight: bold;">$${listing.price.toLocaleString()}</p>
              ${listing.bedrooms ? `<span>🛏️ ${listing.bedrooms} bed</span>` : ""}
              ${listing.bathrooms ? `<span> | 🛁 ${listing.bathrooms} bath</span>` : ""}
              ${listing.square_feet ? `<span> | 📐 ${listing.square_feet.toLocaleString()} sqft</span>` : ""}
            </div>
            <p><strong>Contact:</strong> ${agentName} - ${agentEmail}</p>
          `,
        },
      },
    }));

    const { error: insertError } = await supabase.from("email_jobs").insert(emailJobs);

    if (insertError) {
      console.error("[notify-matching-buyers] Failed to enqueue:", insertError);
      throw new Error("Failed to queue emails");
    }

    return new Response(
      JSON.stringify({
        success: true,
        queued: emailJobs.length,
        client_needs_matches: matchingNeeds?.length || 0,
        hot_sheet_matches: matchingHotSheets.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[notify-matching-buyers] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
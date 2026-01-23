import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active hot sheets with notification preferences
    const { data: hotSheets, error: fetchError } = await supabase
      .from("hot_sheets")
      .select(`*, user:profiles!user_id(email, first_name)`)
      .eq("is_active", true);

    if (fetchError) throw fetchError;

    if (!hotSheets || hotSheets.length === 0) {
      return new Response(
        JSON.stringify({ message: "No hot sheets to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-new-match-notification] Processing ${hotSheets.length} hot sheets`);

    let totalMatches = 0;
    let jobsQueued = 0;

    for (const hotSheet of hotSheets) {
      // Check for new matches
      const { data: matchingListings, error: matchError } = await supabase
        .rpc("check_hot_sheet_matches", { p_hot_sheet_id: hotSheet.id });

      if (matchError || !matchingListings?.length) continue;

      totalMatches += matchingListings.length;

      // Fetch full listing details
      const { data: listings } = await supabase
        .from("listings")
        .select("*")
        .in("id", matchingListings.map((m: any) => m.listing_id));

      if (!listings?.length || !hotSheet.user?.email) continue;

      // Build listings HTML
      const listingsHtml = listings.map((listing: any) => `
        <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h3 style="margin: 0 0 8px;">$${listing.price.toLocaleString()}</h3>
          <p style="margin: 0 0 12px; color: #6b7280;">${listing.address}, ${listing.city}, ${listing.state}</p>
          <div style="display: flex; gap: 16px;">
            ${listing.bedrooms ? `<span>${listing.bedrooms} beds</span>` : ""}
            ${listing.bathrooms ? `<span>${listing.bathrooms} baths</span>` : ""}
            ${listing.square_feet ? `<span>${listing.square_feet.toLocaleString()} sqft</span>` : ""}
          </div>
        </div>
      `).join("");

      // Enqueue email job
      const { error: insertError } = await supabase.from("email_jobs").insert({
        payload: {
          provider: "resend",
          template: "new-match-notification",
          to: hotSheet.user.email,
          subject: `New Match Alert: ${listings.length} new ${listings.length === 1 ? 'property matches' : 'properties match'} "${hotSheet.name}"`,
          variables: {
            userName: hotSheet.user.first_name || "",
            hotSheetName: hotSheet.name,
            matchCount: listings.length,
            listingsHtml,
          },
        },
      });

      if (!insertError) {
        jobsQueued++;
        
        // Record notifications
        const notificationRecords = matchingListings.map((match: any) => ({
          hot_sheet_id: hotSheet.id,
          listing_id: match.listing_id,
          user_id: hotSheet.user_id,
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        }));

        await supabase.from("hot_sheet_notifications").insert(notificationRecords);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        hotSheetsProcessed: hotSheets.length,
        totalMatches,
        jobsQueued,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-new-match-notification] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
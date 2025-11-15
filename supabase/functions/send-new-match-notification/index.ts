import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
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
      .select(`
        *,
        user:profiles!user_id(email, first_name)
      `)
      .eq("is_active", true);

    if (fetchError) {
      console.error("Error fetching hot sheets:", fetchError);
      throw fetchError;
    }

    if (!hotSheets || hotSheets.length === 0) {
      console.log("No active hot sheets found");
      return new Response(
        JSON.stringify({ message: "No hot sheets to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${hotSheets.length} hot sheets`);

    let totalMatches = 0;
    let emailsSent = 0;

    // Process each hot sheet
    for (const hotSheet of hotSheets) {
      // Check for new matches using the database function
      const { data: matchingListings, error: matchError } = await supabase
        .rpc("check_hot_sheet_matches", { p_hot_sheet_id: hotSheet.id });

      if (matchError) {
        console.error(`Error checking matches for hot sheet ${hotSheet.id}:`, matchError);
        continue;
      }

      if (!matchingListings || matchingListings.length === 0) {
        console.log(`No new matches for hot sheet ${hotSheet.name}`);
        continue;
      }

      console.log(`Found ${matchingListings.length} new matches for ${hotSheet.name}`);
      totalMatches += matchingListings.length;

      // Fetch full listing details
      const { data: listings, error: listingsError } = await supabase
        .from("listings")
        .select("*")
        .in("id", matchingListings.map((m: any) => m.listing_id));

      if (listingsError) {
        console.error("Error fetching listing details:", listingsError);
        continue;
      }

      // Send email notification
      if (hotSheet.user?.email) {
        const listingsHtml = listings
          ?.map((listing: any) => {
            const photoUrl = listing.photos?.[0]?.url || "";
            return `
              <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; gap: 16px;">
                ${photoUrl ? `
                  <img src="${photoUrl}" alt="${listing.address}" 
                       style="width: 200px; height: 150px; object-fit: cover; border-radius: 6px;">
                ` : ""}
                <div style="flex: 1;">
                  <h3 style="margin: 0 0 8px 0; font-size: 18px;">$${listing.price.toLocaleString()}</h3>
                  <p style="margin: 0 0 12px 0; color: #6b7280;">${listing.address}, ${listing.city}, ${listing.state}</p>
                  <div style="display: flex; gap: 16px; margin-bottom: 12px;">
                    ${listing.bedrooms ? `<span style="color: #6b7280;">${listing.bedrooms} beds</span>` : ""}
                    ${listing.bathrooms ? `<span style="color: #6b7280;">${listing.bathrooms} baths</span>` : ""}
                    ${listing.square_feet ? `<span style="color: #6b7280;">${listing.square_feet.toLocaleString()} sqft</span>` : ""}
                  </div>
                  <a href="${supabaseUrl.replace('.supabase.co', '.lovable.app')}/consumer-property/${listing.id}" 
                     style="display: inline-block; padding: 8px 16px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
                    View Property
                  </a>
                </div>
              </div>
            `;
          })
          .join("");

        try {
          await resend.emails.send({
            from: "AAC Worldwide <noreply@allagentconnect.com>",
            to: [hotSheet.user.email],
            subject: `New Match Alert: ${listings.length} new ${listings.length === 1 ? 'property matches' : 'properties match'} your search "${hotSheet.name}"`,
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f9fafb;">
                  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                      <h1 style="margin: 0 0 8px 0; font-size: 28px; color: #111827;">New Properties Match Your Search!</h1>
                      <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 16px;">
                        ${hotSheet.user.first_name ? `Hi ${hotSheet.user.first_name}, ` : ""}We found ${listings.length} new ${listings.length === 1 ? 'property' : 'properties'} matching your saved search "<strong>${hotSheet.name}</strong>".
                      </p>
                      ${listingsHtml}
                      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                        <a href="${supabaseUrl.replace('.supabase.co', '.lovable.app')}/hot-sheets/${hotSheet.id}/review" 
                           style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
                          View All Matches
                        </a>
                      </div>
                      <div style="margin-top: 24px;">
                        <p style="margin: 0; color: #6b7280; font-size: 14px;">
                          You're receiving this because you created a saved search. 
                          <a href="${supabaseUrl.replace('.supabase.co', '.lovable.app')}/consumer/dashboard" style="color: #2563eb;">Manage your notifications</a>
                        </p>
                      </div>
                    </div>
                  </div>
                </body>
              </html>
            `,
          });

          emailsSent++;
          console.log(`Sent new match notification to ${hotSheet.user.email} for ${hotSheet.name}`);

          // Record notifications
          const notificationRecords = matchingListings.map((match: any) => ({
            hot_sheet_id: hotSheet.id,
            listing_id: match.listing_id,
            user_id: hotSheet.user_id,
            notification_sent: true,
            notification_sent_at: new Date().toISOString(),
          }));

          const { error: insertError } = await supabase
            .from("hot_sheet_notifications")
            .insert(notificationRecords);

          if (insertError) {
            console.error("Error recording notifications:", insertError);
          }
        } catch (emailError) {
          console.error(`Failed to send email to ${hotSheet.user.email}:`, emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        hotSheetsProcessed: hotSheets.length,
        totalMatches,
        emailsSent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-new-match-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PriceChange {
  id: string;
  favorite_id: string;
  listing_id: string;
  old_price: number;
  new_price: number;
  changed_at: string;
  listing: {
    address: string;
    city: string;
    state: string;
    photos: any[];
  };
  favorite: {
    user_id: string;
    user: {
      email: string;
    };
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch price changes that need notification
    const { data: priceChanges, error: fetchError } = await supabase
      .from("favorite_price_history")
      .select(`
        *,
        listing:listings(address, city, state, photos),
        favorite:favorites(
          user_id,
          user:profiles(email)
        )
      `)
      .eq("notification_sent", false)
      .order("changed_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching price changes:", fetchError);
      throw fetchError;
    }

    if (!priceChanges || priceChanges.length === 0) {
      console.log("No price changes to notify");
      return new Response(
        JSON.stringify({ message: "No notifications to send" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${priceChanges.length} price changes to notify`);

    // Group by user to send one email per user
    const changesByUser = priceChanges.reduce((acc: any, change: any) => {
      const userId = change.favorite.user_id;
      if (!acc[userId]) {
        acc[userId] = {
          email: change.favorite.user?.email,
          changes: [],
        };
      }
      acc[userId].changes.push(change);
      return acc;
    }, {});

    let emailsSent = 0;
    const notificationIds: string[] = [];

    // Send emails
    for (const [userId, data] of Object.entries(changesByUser) as any) {
      if (!data.email) {
        console.log(`No email for user ${userId}, skipping`);
        continue;
      }

      const priceChangesHtml = data.changes
        .map((change: PriceChange) => {
          const priceDiff = change.new_price - change.old_price;
          const percentChange = ((priceDiff / change.old_price) * 100).toFixed(1);
          const direction = priceDiff > 0 ? "increased" : "decreased";
          const color = priceDiff > 0 ? "#ef4444" : "#22c55e";
          const photoUrl = change.listing.photos?.[0]?.url || '';

          return `
            <div style="margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
              ${photoUrl ? `<img src="${photoUrl}" alt="${change.listing.address}" style="width: 100%; height: 200px; object-fit: cover;" />` : ''}
              <div style="padding: 16px;">
                <h3 style="margin: 0 0 8px 0; font-size: 18px;">${change.listing.address}</h3>
                <p style="margin: 0 0 12px 0; color: #6b7280;">${change.listing.city}, ${change.listing.state}</p>
                <div style="display: flex; align-items: center; gap: 16px;">
                  <div>
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">Old Price</p>
                    <p style="margin: 0; font-size: 18px; text-decoration: line-through;">$${change.old_price.toLocaleString()}</p>
                  </div>
                  <div>
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">New Price</p>
                    <p style="margin: 0; font-size: 24px; font-weight: bold; color: ${color};">$${change.new_price.toLocaleString()}</p>
                  </div>
                </div>
                <p style="margin: 12px 0 0 0; color: ${color}; font-weight: 600;">
                  Price ${direction} by $${Math.abs(priceDiff).toLocaleString()} (${percentChange}%)
                </p>
                <a href="${supabaseUrl.replace('.supabase.co', '.lovable.app')}/consumer-property/${change.listing_id}" 
                   style="display: inline-block; margin-top: 12px; padding: 8px 16px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
                  View Property
                </a>
              </div>
            </div>
          `;
        })
        .join("");

      try {
        await resend.emails.send({
          from: "All Agent Connect <hello@allagentconnect.com>",
          to: [data.email],
          subject: `Price Alert: ${data.changes.length} saved ${data.changes.length === 1 ? 'home has' : 'homes have'} changed price`,
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
                    <h1 style="margin: 0 0 24px 0; font-size: 28px; color: #111827;">Price Alert on Your Saved Homes</h1>
                    <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 16px;">
                      Good news! The price has changed on ${data.changes.length} of your saved properties.
                    </p>
                    ${priceChangesHtml}
                    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0; color: #6b7280; font-size: 14px;">
                        You're receiving this because you saved these properties. 
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
        notificationIds.push(...data.changes.map((c: PriceChange) => c.id));
        console.log(`Sent price change notification to ${data.email}`);
      } catch (emailError) {
        console.error(`Failed to send email to ${data.email}:`, emailError);
      }
    }

    // Mark notifications as sent
    if (notificationIds.length > 0) {
      const { error: updateError } = await supabase
        .from("favorite_price_history")
        .update({
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        })
        .in("id", notificationIds);

      if (updateError) {
        console.error("Error updating notification status:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent,
        notificationsSent: notificationIds.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-price-change-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
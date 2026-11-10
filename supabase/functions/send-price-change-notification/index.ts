import "../_shared/migrationRuntime.ts";
// @auth-classification: internal-cron
import { authorizeInternalServiceRole } from "../_shared/internalServiceRoleAuth.ts";
import { assertMigrationDeliveryAllowed } from "../_shared/migrationSafety.ts";
import { LISTING_OG_PLACEHOLDER } from "../_shared/listingPhotoUrl.ts";
import { formatListingShareEmailStreetLine } from "../_shared/listingShareEmailAddress.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveEmailBaseUrl } from "../_shared/aacPublicUrl.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const appBaseUrl = resolveEmailBaseUrl(
  Deno.env.get("EMAIL_BASE_URL") || Deno.env.get("APP_URL"),
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

interface PriceChange {
  id: string;
  favorite_id: string;
  listing_id: string;
  old_price: number;
  new_price: number;
  changed_at: string;
  scope: { listing_id: string; network: boolean; hot_sheet_id?: string; authorized_at?: string };
  listing: {
    address: string;
    city: string;
    state: string;
    unit_number?: string;
    zip_code?: string;
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

  if (req.method !== "POST") return new Response(null, { status: 405, headers: corsHeaders });
  const auth = authorizeInternalServiceRole(req);
  if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: corsHeaders });

  try {
    assertMigrationDeliveryAllowed();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch price changes that need notification
    const { data: priceChanges, error: fetchError } = await supabase
      .from("favorite_price_history")
      .select(`
        id, favorite_id, listing_id, old_price, new_price, changed_at,
        favorite:favorites(user_id)
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
      const userId = change.favorite?.user_id;
      if (!userId) return acc;
      if (!acc[userId]) {
        acc[userId] = {
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
      const allowed: PriceChange[] = [];
      const contexts = new Map<string, { email: string; listing: PriceChange["listing"]; scope: PriceChange["scope"] } | null>();
      for (const change of data.changes) {
        if (!contexts.has(change.listing_id)) {
          const { data: context, error } = await supabase.rpc("get_price_alert_context", {
            p_user_id: userId, p_listing_id: change.listing_id,
          });
          if (error) throw new Error("Price alert authorization unavailable");
          contexts.set(change.listing_id, context);
        }
        const context = contexts.get(change.listing_id);
        if (!context?.listing || !context.email || !context.scope) continue;
        if (!context.scope.network) {
          const changedAt = Date.parse(change.changed_at);
          const authorizedAt = Date.parse(context.scope.authorized_at ?? "");
          if (!Number.isFinite(changedAt) || !Number.isFinite(authorizedAt) || changedAt < authorizedAt) continue;
        }
        allowed.push({ ...change, listing: context.listing, scope: context.scope });
        if (allowed.length >= 200) break;
      }
      if (allowed.length === 0) continue;
      data.changes = allowed;
      data.email = contexts.get(allowed[0].listing_id)!.email;
      const scopes = [...new Map(allowed.map(change => [change.listing_id, change.scope])).values()];

      const priceChangesHtml = data.changes
        .map((change: PriceChange) => {
          const priceDiff = change.new_price - change.old_price;
          const percentChange = ((priceDiff / change.old_price) * 100).toFixed(1);
          const direction = priceDiff > 0 ? "increased" : "decreased";
          const color = priceDiff > 0 ? "#ef4444" : "#22c55e";
          const photoUrl = LISTING_OG_PLACEHOLDER;
          const address = escapeHtml(formatListingShareEmailStreetLine(change.listing));
          const path = change.scope.network ? `/property/${change.listing_id}`
            : `/client/shared-property/${change.listing_id}?sheet=${encodeURIComponent(change.scope.hot_sheet_id!)}`;

          return `
            <div style="margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
              ${photoUrl ? `<img src="${photoUrl}" alt="${address}" style="width: 100%; height: 200px; object-fit: cover;" />` : ''}
              <div style="padding: 16px;">
                <h3 style="margin: 0 0 8px 0; font-size: 18px;">${address}</h3>
                <p style="margin: 0 0 12px 0; color: #6b7280;">${escapeHtml(change.listing.city)}, ${escapeHtml(change.listing.state)}</p>
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
                <a href="${appBaseUrl}${path}" 
                   style="display: inline-block; margin-top: 12px; padding: 8px 16px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
                  View Property
                </a>
              </div>
            </div>
          `;
        })
        .join("");

      try {
        const subject = `Price Alert: ${data.changes.length} saved ${data.changes.length === 1 ? 'home has' : 'homes have'} changed price`;
        const html = `
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
                        <a href="${appBaseUrl}/consumer/dashboard" style="color: #2563eb;">Manage your notifications</a>
                      </p>
                    </div>
                  </div>
                </div>
              </body>
            </html>
          `;

        const changeIds = data.changes
          .map((c: PriceChange) => c.id)
          .sort();
        const idempotencyKey = `price-change:${userId}:${changeIds.join(",")}`;

        const { error: enqueueError } = await supabase
          .from("email_jobs")
          .insert({
            idempotency_key: idempotencyKey,
            payload: {
              provider: "resend",
              template: "price-change-notification",
              privacy: { version: 1, audience: "favorite", recipient_user_id: userId,
                listing_ids: scopes.map(scope => scope.listing_id), scopes },
              to: data.email,
              subject,
              html,
            },
          });

        if (enqueueError) throw enqueueError;

        emailsSent++;
        notificationIds.push(...data.changes.map((c: PriceChange) => c.id));
        console.log(`Enqueued price change notification to ${data.email}`);
      } catch (emailError) {
        console.error(`Failed to enqueue email to ${data.email}:`, emailError);
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

    if (emailsSent > 0) {
      void fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      }).catch((err) => {
        console.warn("[send-price-change-notification] kick-email-queue failed:", err);
      });
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
      JSON.stringify({ error: error?.code === "MIGRATION_OUTBOUND_BLOCKED" ? "Delivery is paused" : "Price alert processing failed" }),
      {
        status: error?.code === "MIGRATION_OUTBOUND_BLOCKED" ? 503 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

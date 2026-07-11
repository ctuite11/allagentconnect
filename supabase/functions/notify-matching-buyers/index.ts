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

/**
 * CANONICAL ROUTING (post-consolidation):
 * - Hot Sheet matching is OWNED by `send-new-match-notification`
 *   (cron + listing-trigger near-realtime). It enforces:
 *     • acceptance gate (no-spam-before-accept)
 *     • status-aware dedup via hot_sheet_sent_listings
 *     • routes to BUYER/CLIENT, never the agent
 *
 * - This function ONLY handles legacy `client_needs` matching.
 *   It also fires `send-new-match-notification` for the same listing
 *   so hot-sheet recipients get near-realtime delivery.
 */
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const listing: Listing = await req.json();
    console.log("[notify-matching-buyers] Processing listing:", listing.listing_id);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Fan-out to canonical hot-sheet matcher (near-realtime path)
    //    Fire-and-forget; cron remains the safety net.
    try {
      supabase.functions.invoke("send-new-match-notification", {
        body: { trigger: "listing", listing_id: listing.listing_id },
      }).then(({ error }) => {
        if (error) console.error("[notify-matching-buyers] hot-sheet fanout error:", error);
      });
    } catch (e) {
      console.error("[notify-matching-buyers] hot-sheet fanout invoke threw:", e);
    }

    // 1b) Fan-out to automatic AGENT new-listing notifications
    //     Independent of buyer/client path; owns its own dedup table
    //     (agent_sent_listings) so cron/repeat triggers cannot duplicate.
    try {
      supabase.functions.invoke("notify-agents-new-listing", {
        body: { listing_id: listing.listing_id },
      }).then(({ error }) => {
        if (error) console.error("[notify-matching-buyers] agent fanout error:", error);
      });
    } catch (e) {
      console.error("[notify-matching-buyers] agent fanout invoke threw:", e);
    }

    // 2) Legacy client_needs matching (kept for backward compatibility)
    let clientNeedsQuery = supabase
      .from("client_needs")
      .select("*, profiles!client_needs_submitted_by_fkey(email, first_name, last_name)");

    if (listing.state) clientNeedsQuery = clientNeedsQuery.eq("state", listing.state);
    if (listing.city) clientNeedsQuery = clientNeedsQuery.ilike("city", `%${listing.city}%`);
    if (listing.property_type) clientNeedsQuery = clientNeedsQuery.eq("property_type", listing.property_type);
    if (listing.price) clientNeedsQuery = clientNeedsQuery.gte("max_price", listing.price);

    const { data: matchingNeeds, error: needsError } = await clientNeedsQuery;
    if (needsError) throw needsError;

    // Listing agent (for reply_to)
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

    const recipientsMap = new Map<string, { email: string; first_name: string; source: string }>();
    matchingNeeds?.forEach((need: any) => {
      if (need.profiles?.email) {
        recipientsMap.set(need.profiles.email, {
          email: need.profiles.email,
          first_name: need.profiles.first_name,
          source: "client_need",
        });
      }
    });

    const recipients = Array.from(recipientsMap.values());
    console.log(`[notify-matching-buyers] client_needs recipients: ${recipients.length}`);

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, queued: 0, hot_sheet_fanout: "invoked" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
            <p>A new property just hit the market that matches your buyer preferences!</p>
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
        hot_sheet_fanout: "invoked",
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

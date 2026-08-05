import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertHotSheetEnqueueAllowed } from "../_shared/emailStreams.ts";
import {
  authorizeInternalServiceRole,
  serviceRoleInvokeHeaders,
} from "../_shared/internalServiceRoleAuth.ts";

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
 * Listing-event bridge → canonical Hot Sheet matcher ONLY.
 *
 * Isolation rules:
 * - Does NOT fan out to notify-agents-new-listing (retired).
 * - Does NOT enqueue Communications Center jobs.
 * - Does NOT enqueue legacy client_needs / new-listing-alert emails
 *   (listing events may only notify Hot Sheet recipients).
 * - Does NOT read Communications Center preferences.
 * - Internal service-role callers only.
 */
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = authorizeInternalServiceRole(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const listing: Listing = await req.json();
    console.log("[notify-matching-buyers] Processing listing:", listing.listing_id);

    const pauseGate = assertHotSheetEnqueueAllowed();
    if (pauseGate.paused) {
      console.log(`[notify-matching-buyers] paused: ${pauseGate.switch}`);
      return new Response(
        JSON.stringify({
          paused: true,
          switch: pauseGate.switch,
          reason: pauseGate.reason,
          hot_sheet_fanout: "skipped",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fan-out to canonical hot-sheet matcher (near-realtime path).
    // Fire-and-forget; cron remains the safety net.
    // Explicit service-role Authorization + apikey so gateway JWT verify and
    // the in-function exact-key gate both accept the downstream call.
    try {
      supabase.functions.invoke("send-new-match-notification", {
        headers: serviceRoleInvokeHeaders(SUPABASE_SERVICE_ROLE_KEY),
        body: { trigger: "listing", listing_id: listing.listing_id },
      }).then(({ error }) => {
        if (error) console.error("[notify-matching-buyers] hot-sheet fanout error:", error);
      });
    } catch (e) {
      console.error("[notify-matching-buyers] hot-sheet fanout invoke threw:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        queued: 0,
        hot_sheet_fanout: "invoked",
        legacy_client_needs_emails: "disabled_for_isolation",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[notify-matching-buyers] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
};

serve(handler);

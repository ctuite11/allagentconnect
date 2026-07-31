import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * RETIRED broad-audience property-alert path.
 *
 * Property notifications are delivered only through matching active Hot Sheets
 * via `send-new-match-notification` / `process-hot-sheet`.
 *
 * This stub remains for compatibility so stray or old callers cannot:
 * - query the verified-agent audience
 * - use Communications Center preferences
 * - write to agent_sent_listings
 * - insert email_jobs
 * - enqueue missing-opportunity reminders
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      disabled: true,
      reason:
        "Property notifications are now delivered only through matching active hot sheets",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

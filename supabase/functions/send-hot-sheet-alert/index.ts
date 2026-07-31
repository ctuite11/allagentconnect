import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * RETIRED legacy Hot Sheet alert enqueue path.
 *
 * Hot Sheet emails are delivered only through:
 * - `send-new-match-notification` (canonical match/status/subscriber path)
 * - `process-hot-sheet` (manual/batch + baselineOnly)
 *
 * This stub remains so stray callers cannot insert `email_jobs` without
 * pause gates, idempotency keys, or match-state updates.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      disabled: true,
      reason:
        "Legacy send-hot-sheet-alert is retired. Use send-new-match-notification or process-hot-sheet.",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

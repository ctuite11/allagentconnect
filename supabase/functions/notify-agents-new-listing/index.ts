/**
 * HARD-DISABLED 2026-08-01.
 *
 * This function broadcast listing alerts to every verified agent, bypassing
 * Hot Sheets. It caused the 2026-07-30 mass-send incident. All logic has been
 * removed; the queue additionally refuses `agent-new-listing-alert` jobs and
 * any `agent-new-listing:*` idempotency key at insert, claim, and send time.
 *
 * Agent listing alerts are owned exclusively by the Hot Sheet pipeline
 * (`send-new-match-notification`).
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      disabled: true,
      reason:
        "Permanently disabled. Agent listing alerts are owned by the Hot Sheet pipeline (send-new-match-notification).",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

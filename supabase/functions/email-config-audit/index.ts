import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Read-only audit. Returns ONLY the domain portion of each sender-related
// secret (never the full address). Used to reconcile prod env with repo.
function maskDomain(value: string | undefined): string {
  if (!value) return "(unset)";
  // Extract @domain from "Name <local@domain>" or "local@domain"
  const match = value.match(/@([A-Za-z0-9.\-]+)/);
  if (!match) return "(no-@-found)";
  return `***@${match[1]}`;
}

serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const report = {
    TRANSACTIONAL_FROM: maskDomain(Deno.env.get("TRANSACTIONAL_FROM")),
    TRANSACTIONAL_FROM_EMAIL: maskDomain(Deno.env.get("TRANSACTIONAL_FROM_EMAIL")),
    BULK_FROM: maskDomain(Deno.env.get("BULK_FROM")),
    RESEND_FROM: maskDomain(Deno.env.get("RESEND_FROM")),
    RESEND_FROM_EMAIL: maskDomain(Deno.env.get("RESEND_FROM_EMAIL")),
    RESEND_FROM_NAME_set: Boolean(Deno.env.get("RESEND_FROM_NAME")),
    RESEND_REPLY_TO: maskDomain(Deno.env.get("RESEND_REPLY_TO")),
    BULK_EMAIL_PAUSED: Deno.env.get("BULK_EMAIL_PAUSED") ?? "(unset)",
  };
  return new Response(JSON.stringify(report, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
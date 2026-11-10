import "../_shared/migrationRuntime.ts";
// @auth-classification: user-jwt
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { verifiedPrivacyClient } from "../_shared/privacyAuth.ts";
import { assertMigrationDeliveryAllowed } from "../_shared/migrationSafety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: corsHeaders });
  try {
    const caller = await verifiedPrivacyClient(req);
    if (!caller) return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: corsHeaders });
    assertMigrationDeliveryAllowed();
    const raw = await req.text();
    if (raw.length > 8192) return new Response(JSON.stringify({ error: "Invalid share request" }), { status: 400, headers: corsHeaders });
    const { listingIds, recipientEmail, recipientName = "" } = JSON.parse(raw);
    if (!Array.isArray(listingIds) || listingIds.length < 1 || listingIds.length > 50 ||
      listingIds.some(id => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) ||
      typeof recipientEmail !== "string" || recipientEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail) ||
      typeof recipientName !== "string" || recipientName.length > 100) {
      return new Response(JSON.stringify({ error: "Valid listing IDs and recipient are required" }), { status: 400, headers: corsHeaders });
    }
    // Reuse the existing share workflow: it resolves current property data,
    // records seller-approved expiring links, rate-limits and rechecks delivery.
    // Client-supplied property HTML, sender identity and page links are ignored.
    const { data, error } = await caller.client.functions.invoke("send-bulk-listing-share", {
      body: { listingIds: [...new Set(listingIds)], recipientEmail: recipientEmail.trim(), recipientName: recipientName.trim() },
    });
    if (error || data?.success !== true) return new Response(JSON.stringify({ error: "Could not authorize or queue this share" }), { status: 400, headers: corsHeaders });
    return new Response(JSON.stringify(data), { headers: corsHeaders });
  } catch (error) {
    const paused = (error as { code?: string }).code === "MIGRATION_OUTBOUND_BLOCKED";
    return new Response(JSON.stringify({ error: paused ? "Delivery is paused" : "Could not queue this share" }), { status: paused ? 503 : 400, headers: corsHeaders });
  }
});

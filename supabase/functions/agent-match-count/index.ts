import "../_shared/migrationRuntime.ts";
// @auth-classification: public-read
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Content-Type": "application/json", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

// Public seller-intake aggregate only. Never returns identities, criteria or
// network rows, and never grants the underlying network RPC to anonymous users.
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 2048) return reply({ error: "invalid_request" }, 400);
    const p = JSON.parse(raw);
    if (typeof p.p_city !== "string" || p.p_city.trim().length < 1 || p.p_city.length > 100
      || typeof p.p_state !== "string" || !/^[A-Z]{2}$/.test(p.p_state)
      || !["Single Family", "condo", "Townhouse", "Multi Family", "Land"].includes(p.p_property_type)
      || ![p.p_price, p.p_bedrooms, p.p_bathrooms].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0)
      || p.p_price > 1e10 || p.p_bedrooms > 100 || p.p_bathrooms > 100) return reply({ error: "invalid_request" }, 400);
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // The final proxy-appended address prevents a caller-provided first entry
    // from bypassing the per-IP cap. A global cap also bounds spoofed/absent IPs.
    const ip = req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
    const ipHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    for (const [key, seconds, limit] of [["global", 60, 120], [ipHash, 300, 20]] as const) {
      const { data, error } = await client.rpc("rate_limit_consume", {
        p_key: `privacy:agent-match-count:${key}`, p_window_seconds: seconds, p_limit: limit,
      });
      if (error) return reply({ error: "temporarily_unavailable" }, 503);
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.allowed !== true) return reply({ error: "too_many_requests" }, 429);
    }
    const { data, error } = await client.rpc("count_matching_agents", {
      p_city: p.p_city.trim(), p_state: p.p_state, p_property_type: p.p_property_type,
      p_price: p.p_price, p_bedrooms: p.p_bedrooms, p_bathrooms: p.p_bathrooms,
    });
    if (error || !Number.isSafeInteger(data) || data < 0) return reply({ error: "temporarily_unavailable" }, 503);
    return reply({ count: data });
  } catch { return reply({ error: "invalid_request" }, 400); }
});

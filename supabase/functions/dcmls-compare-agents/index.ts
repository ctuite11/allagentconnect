import "../_shared/migrationRuntime.ts";
// @auth-classification: public-read
// Public results are limited to agents with an authorized DCMLS publication.
import { verifiedPrivacyClient } from "../_shared/privacyAuth.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { DCMLS_SETTINGS_COLUMNS, eligibleForCompare, type DcmlsSettingsRow } from "../_shared/dcmlsIncentives.ts";

const Body = z.object({
  type: z.enum(["buyer", "seller"]),
  zip: z.string().regex(/^\d{5}$/).optional().nullable(),
  listing_id: z.string().uuid().optional().nullable(),
  exclude_agent_id: z.string().uuid().optional().nullable(),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const networkViewer = await verifiedPrivacyClient(req);
  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!parsed.success) return json({ error: "Please enter a 5-digit ZIP code." }, 400);
  const { type, exclude_agent_id } = parsed.data;
  let zip = parsed.data.zip ?? null;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let publicAgents: Set<string> | null = null;
  if (!networkViewer) {
    const ip = req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
    const key = Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2,"0")).join("");
    for (const limitKey of ["global", key]) {
      const { data: rate, error } = await admin.rpc("rate_limit_consume", {
        p_key: `privacy:dcmls-compare:${limitKey}`, p_window_seconds: 60, p_limit: limitKey === "global" ? 120 : 20,
      });
      if (error || (Array.isArray(rate) ? rate[0] : rate)?.allowed !== true) return json({ error: "Please try again later." }, 429);
    }
    const { data: publications, error } = await admin.from("dcmls_listings_public").select("agent_id");
    if (error) return json({ error: "Temporarily unavailable" }, 503);
    publicAgents = new Set((publications ?? []).map(row => row.agent_id));
  }
  // A valid, non-draft source listing's ZIP always wins over a client-supplied ZIP.
  if (parsed.data.listing_id) {
    const { data: l } = await admin
      .from(networkViewer ? "listings" : "dcmls_listings_public").select("zip_code, status").eq("id", parsed.data.listing_id).maybeSingle();
    if (!l) return json({ error: "Listing unavailable" }, 404);
    const z5 = String(l?.zip_code ?? "").slice(0, 5);
    if (l && l.status !== "draft" && /^\d{5}$/.test(z5)) zip = z5;
  }
  if (!zip) return json({ error: "Please enter a 5-digit ZIP code.", agents: [] }, 400);
  const zipCol = type === "buyer" ? "dcmls_buyer_lead_zips" : "dcmls_seller_lead_zips";
  const { data, error } = await admin
    .from("agent_settings")
    .select(DCMLS_SETTINGS_COLUMNS)
    .eq("agent_status", "verified")
    .eq("hide_from_directory", false)
    .eq("dcmls_participation", true)
    .contains(zipCol, [zip]);
  if (error) {
    console.error("[dcmls-compare-agents]", error.message);
    return json({ agents: [] });
  }
  const ids = shuffle(
    ((data ?? []) as DcmlsSettingsRow[])
      .filter((s) => s.user_id !== exclude_agent_id && (!publicAgents || publicAgents.has(s.user_id)) && eligibleForCompare(s, type, zip))
      .map((s) => s.user_id),
  ).slice(0, 3);
  if (!ids.length) return json({ agents: [], zip });

  const { data: profiles } = await admin
    .from("agent_profiles")
    .select("id, aac_id, first_name, last_name, headshot_url, company, office_name, office_city, office_state")
    .in("id", ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const agents = ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((p) => ({
      id: p!.id,
      aac_id: p!.aac_id,
      name: [p!.first_name, p!.last_name].filter(Boolean).join(" "),
      headshot_url: p!.headshot_url,
      brokerage: p!.company || p!.office_name || null,
      service_area: [p!.office_city, p!.office_state].filter(Boolean).join(", ") || null,
    }));
  return json({ agents, zip });
});

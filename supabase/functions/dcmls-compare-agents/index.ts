// @auth-classification: public
// Up to 3 other eligible DCMLS agents for a ZIP, in random order (no ranking). Public card fields only.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { DCMLS_SETTINGS_COLUMNS, eligibleForCompare, type DcmlsSettingsRow } from "../_shared/dcmlsIncentives.ts";

const Body = z.object({
  type: z.enum(["buyer", "seller"]),
  zip: z.string().regex(/^\d{5}$/),
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
  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!parsed.success) return json({ error: "Please enter a 5-digit ZIP code." }, 400);
  const { type, zip, exclude_agent_id } = parsed.data;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const zipCol = type === "buyer" ? "dcmls_buyer_lead_zips" : "dcmls_seller_lead_zips";
  const { data, error } = await admin
    .from("agent_settings")
    .select(DCMLS_SETTINGS_COLUMNS)
    .eq("dcmls_participation", true)
    .contains(zipCol, [zip]);
  if (error) {
    console.error("[dcmls-compare-agents]", error.message);
    return json({ agents: [] });
  }
  const ids = shuffle(
    ((data ?? []) as DcmlsSettingsRow[])
      .filter((s) => s.user_id !== exclude_agent_id && eligibleForCompare(s, type, zip))
      .map((s) => s.user_id),
  ).slice(0, 3);
  if (!ids.length) return json({ agents: [] });

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
  return json({ agents });
});

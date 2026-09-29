// @auth-classification: public
// Returns only { buyer: boolean, seller: boolean } for an agent. Never returns incentive details.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { availability, DCMLS_SETTINGS_COLUMNS, type DcmlsSettingsRow } from "../_shared/dcmlsIncentives.ts";

const Body = z.object({ agent_id: z.string().uuid() });

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!parsed.success) return json({ error: "Invalid agent" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin
    .from("agent_settings")
    .select(DCMLS_SETTINGS_COLUMNS)
    .eq("user_id", parsed.data.agent_id)
    .maybeSingle();
  if (error) {
    console.error("[dcmls-incentive-availability]", error.message);
    return json({ buyer: false, seller: false });
  }
  return json(availability(data as DcmlsSettingsRow | null));
});

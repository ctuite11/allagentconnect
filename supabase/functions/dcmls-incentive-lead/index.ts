// @auth-classification: public-read
// Saves a consumer's incentive-details request (the source of truth), snapshots the offer,
// and creates an in-app agent notification. Never returns incentive details to the consumer.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { availability, DCMLS_SETTINGS_COLUMNS, snapshot, type DcmlsSettingsRow } from "../_shared/dcmlsIncentives.ts";

const Body = z.object({
  agent_id: z.string().uuid(),
  type: z.enum(["buyer", "seller"]),
  name: z.string().trim().min(1, "Please enter your name.").max(100),
  email: z.string().trim().email("Please enter a valid email.").max(255),
  zip: z.string().regex(/^\d{5}$/).optional().nullable(),
  listing_id: z.string().uuid().optional().nullable(),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function allowed(admin: any, key: string, windowSeconds: number, limit: number) {
  const { data, error } = await admin.rpc("rate_limit_consume", {
    p_key: key, p_window_seconds: windowSeconds, p_limit: limit,
  });
  if (error) return true; // fail open on limiter outage
  return Boolean(data?.allowed);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return json({ error: first ?? "Please check your name and email." }, 400);
  }
  const b = parsed.data;
  const email = b.email.toLowerCase();

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "";
  const okEmail = await allowed(admin, `route:dcmls-incentive-lead|email:${email}`, 3600, 10);
  const okIp = ip ? await allowed(admin, `route:dcmls-incentive-lead|ip:${ip}`, 3600, 30) : true;
  if (!okEmail || !okIp) return json({ error: "Too many requests. Please try again later." }, 429);

  const { data: s } = await admin.from("agent_settings").select(DCMLS_SETTINGS_COLUMNS).eq("user_id", b.agent_id).maybeSingle();
  const settings = s as DcmlsSettingsRow | null;
  if (!settings || !availability(settings)[b.type]) {
    return json({ error: "This agent isn't currently offering these incentives." }, 400);
  }

  let zip = b.zip ?? null;
  let listingId: string | null = null;
  if (b.listing_id) {
    const { data: l } = await admin.from("listings").select("id, zip_code").eq("id", b.listing_id).neq("status", "draft").maybeSingle();
    if (l) {
      listingId = l.id;
      const z5 = String(l.zip_code ?? "").slice(0, 5);
      if (/^\d{5}$/.test(z5)) zip = z5;
    }
  }

  const { data: lead, error: leadErr } = await admin
    .from("dcmls_incentive_leads")
    .insert({
      agent_user_id: b.agent_id,
      incentive_type: b.type,
      consumer_name: b.name,
      consumer_email: email,
      source_zip: zip,
      source_listing_id: listingId,
      incentive_snapshot: snapshot(settings, b.type),
    })
    .select("id")
    .single();
  if (leadErr || !lead) {
    console.error("[dcmls-incentive-lead] insert failed", leadErr?.message);
    return json({ error: "We couldn't send your request. Please try again." }, 500);
  }

  const label = b.type === "buyer" ? "Buyer" : "Seller";
  const { error: nErr } = await admin.from("agent_notifications").insert({
    agent_id: b.agent_id,
    type: "dcmls_incentive_lead",
    title: `New ${label.toLowerCase()} incentive request`,
    body: `${b.name} asked for your ${label.toLowerCase()} incentive details.`,
    metadata: { lead_id: lead.id, route: `/agent/dcmls/leads/${lead.id}` },
  });
  if (nErr) console.error("[dcmls-incentive-lead] notification failed", nErr.message);

  return json({ ok: true });
});

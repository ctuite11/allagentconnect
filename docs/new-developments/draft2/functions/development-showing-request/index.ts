// @auth-classification: user-jwt
/**
 * development-showing-request (DRAFT 2 — NOT DEPLOYED).
 *
 * Identical shape to development-lead-submit; tier-1 routing is filtered by
 * `receives_showing_requests`, and the body carries preferred_date / preferred_time.
 * Canonical order (guardrail G3), keys per user per development (guardrail G2),
 * disabled accounts rejected before insert (guardrail G1).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { verifyTurnstileToken, turnstileFailureResponse } from "../_shared/verifyTurnstile.ts";
import { enforceSubmissionRateLimits, build429 } from "../_shared/developmentRateLimit.ts";
import { notifySubmission } from "../_shared/developmentNotify.ts";

const ROUTE = "development-showing-request";

const BodySchema = z.object({
  development_id: z.string().uuid(),
  unit_id: z.string().uuid().optional().nullable(),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  preferred_time: z.string().max(120).optional().nullable(),
  message: z.string().max(4000).optional().nullable(),
  turnstileToken: z.string().min(1),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await anonClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user?.id) return json({ error: "Unauthorized" }, 401);

  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const body = parsed.data;

  const turnstile = await verifyTurnstileToken(body.turnstileToken, req);
  if (!turnstile.ok) return turnstileFailureResponse(corsHeaders);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const limit = await enforceSubmissionRateLimits(
    admin, ROUTE, body.development_id, user.id, clientIp(req),
  );
  if (!limit.allowed) return build429(limit.resetAt, corsHeaders);

  const { data: eligible, error: eligibleError } = await admin.rpc("is_eligible_agent", {
    _user_id: user.id,
  });
  if (eligibleError) {
    console.error(`[${ROUTE}] eligibility check failed:`, eligibleError.message);
    return json({ error: "Unable to verify your account" }, 500);
  }
  if (eligible !== true) return json({ error: "Your AAC agent account is not eligible" }, 403);

  const { data: development, error: developmentError } = await admin
    .from("developments")
    .select("id, account_id, name, slug, publish_status, development_accounts!inner(is_active)")
    .eq("id", body.development_id)
    .maybeSingle();
  if (developmentError) {
    console.error(`[${ROUTE}] development lookup failed:`, developmentError.message);
    return json({ error: "Unable to load this development" }, 500);
  }
  if (
    !development ||
    development.publish_status !== "published" ||
    (development as any).development_accounts?.is_active !== true
  ) {
    return json({ error: "This development is not accepting showing requests" }, 403);
  }

  let unitLabel: string | null = null;
  if (body.unit_id) {
    const { data: unit } = await admin
      .from("development_units")
      .select("id, unit_number, development_id")
      .eq("id", body.unit_id)
      .maybeSingle();
    if (!unit || unit.development_id !== development.id) {
      return json({ error: "Unit does not belong to this development" }, 400);
    }
    unitLabel = unit.unit_number ?? null;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", user.id)
    .maybeSingle();
  const { data: settings } = await admin
    .from("agent_settings")
    .select("brokerage_name, phone")
    .eq("user_id", user.id)
    .maybeSingle();

  const requesterName = (profile?.full_name as string | undefined)?.trim() || user.email || "AAC agent";
  const requesterEmail = ((profile?.email as string | undefined) || user.email || "").trim().toLowerCase();
  const requesterPhone = ((settings?.phone as string | undefined) || (profile?.phone as string | undefined) || null);
  if (!requesterEmail) return json({ error: "Your account has no email on file" }, 400);

  const { data: showing, error: insertError } = await admin
    .from("development_showing_requests")
    .insert({
      development_id: development.id,
      account_id: development.account_id,
      unit_id: body.unit_id ?? null,
      agent_user_id: user.id,
      requester_name: requesterName,
      requester_email: requesterEmail,
      requester_phone: requesterPhone,
      preferred_date: body.preferred_date ?? null,
      preferred_time: body.preferred_time ?? null,
      message: body.message ?? null,
    })
    .select("id, created_at")
    .single();

  if (insertError || !showing) {
    console.error(`[${ROUTE}] insert failed:`, insertError?.message);
    return json({ error: "Unable to submit your showing request" }, 500);
  }

  let notified = false;
  try {
    const result = await notifySubmission(
      admin,
      "showing",
      showing.id,
      {
        developmentName: development.name,
        developmentSlug: development.slug,
        unitLabel,
        agentName: requesterName,
        agentEmail: requesterEmail,
        agentPhone: requesterPhone,
        agentBrokerage: (settings?.brokerage_name as string | undefined) ?? null,
        message: body.message ?? null,
        preferredDate: body.preferred_date ?? null,
        preferredTime: body.preferred_time ?? null,
        submittedAt: new Date(showing.created_at).toUTCString(),
      },
      development.id,
      development.account_id,
      requesterEmail,
    );
    notified = result.notified;
  } catch (err) {
    console.error(`[${ROUTE}] notification error:`, err instanceof Error ? err.message : String(err));
  }

  return json({ success: true, showingRequestId: showing.id, notified });
});

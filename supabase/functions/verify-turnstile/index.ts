import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  verifyTurnstileToken,
  TURNSTILE_GENERIC_ERROR,
} from "../_shared/verifyTurnstile.ts";

/**
 * Generic Turnstile verification endpoint.
 *
 * POST { token: string, action?: string } -> 200 { ok: true } | 403 { error }
 *
 * Used by direct supabase.auth.signUp flows (e.g. BuyerAuth) that need to
 * gate signup on a valid Turnstile token before calling Supabase auth.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { token?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: TURNSTILE_GENERIC_ERROR }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = await verifyTurnstileToken(body?.token, req);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: TURNSTILE_GENERIC_ERROR }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
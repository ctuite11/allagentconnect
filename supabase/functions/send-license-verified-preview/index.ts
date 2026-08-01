// Admin-only preview of the EXISTING License Verified email.
//
// Guarantees:
//  - Renders buildLicenseVerifiedEmailHtml() exactly as it stands. No template edits.
//  - Sends ONLY to the calling admin's own auth email.
//  - CTA is inert ("#") — no activation token is issued or redeemed.
//  - Never touches email_jobs / the queue / streams / pause flags. Direct Resend call.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildLicenseVerifiedEmailHtml } from "../_shared/buildLicenseVerifiedEmailHtml.ts";
import { buildTransactionalFrom } from "../_shared/transactionalSender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!supabaseUrl || !anonKey) throw new Error("Server misconfigured");
    if (!resendApiKey) throw new Error("Server misconfigured: missing RESEND_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[send-license-verified-preview] missing bearer token");
      return json({ success: false, error: "Not authenticated: missing bearer token" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const claims = claimsData?.claims as { sub?: string; email?: string } | undefined;
    if (claimsError || !claims?.sub) {
      console.error("[send-license-verified-preview] invalid token:", claimsError?.message ?? "no claims");
      return json({ success: false, error: "Not authenticated: invalid session" }, 401);
    }

    // Recipient must be the caller's own verified auth email.
    let email = typeof claims.email === "string" ? claims.email : null;
    if (!email) {
      const { data: { user } } = await userClient.auth.getUser();
      email = user?.email ?? null;
    }
    if (!email) {
      console.error("[send-license-verified-preview] no email on authenticated user");
      return json({ success: false, error: "Your account has no email address" }, 400);
    }

    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      _user_id: claims.sub,
      _role: "admin",
    });
    if (roleError) {
      console.error("[send-license-verified-preview] has_role failed:", roleError.message);
      return json({ success: false, error: `Role check failed: ${roleError.message}` }, 403);
    }
    if (isAdmin !== true) {
      console.error("[send-license-verified-preview] non-admin caller:", claims.sub);
      return json({ success: false, error: "Admin access required" }, 403);
    }

    // Recipient is always the caller. No arbitrary `to` is accepted.
    const to = email;

    const html = buildLicenseVerifiedEmailHtml({
      ctaUrl: "#",
      ctaLabel: "Activate My Account",
      ctaNote: "Preview copy — this button is inactive and issues no activation link.",
      agentName: null,
      footerAgent: null,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: buildTransactionalFrom(),
        to: [to],
        subject: "[Preview] Your license has been verified — All Agent Connect",
        html,
        reply_to: "hello@allagentconnect.com",
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("[send-license-verified-preview] Resend error:", res.status, err);
      return json({ success: false, error: `Resend ${res.status}` }, 502);
    }

    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    console.log(`[send-license-verified-preview] sent to ${to} id=${(data as { id?: string }).id ?? "n/a"}`);
    return json({ success: true, to, id: (data as { id?: string }).id ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-license-verified-preview] error:", message);
    return json({ success: false, error: message }, 500);
  }
});

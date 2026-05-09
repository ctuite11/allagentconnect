import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { b64urlDecode, verifyClick } from "../_shared/tracking.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

const FALLBACK_URL = "https://allagentconnect.com";

function redirect(target: string) {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: target, "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("j") || "";
    const r = url.searchParams.get("r") || "";
    const u = url.searchParams.get("u") || "";
    const t = url.searchParams.get("t") || "";
    if (!jobId || !r || !u || !t) return redirect(FALLBACK_URL);

    let recipientEmail = "";
    try { recipientEmail = b64urlDecode(r); } catch { return redirect(FALLBACK_URL); }

    // Validate the target URL is http(s) — never redirect to javascript:, data:, etc.
    let target: URL;
    try { target = new URL(u); } catch { return redirect(FALLBACK_URL); }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return redirect(FALLBACK_URL);
    }

    const ok = await verifyClick({ jobId, recipientEmail, category: "" }, u, t);
    if (!ok) return redirect(target.toString());

    // Fire-and-forget click insert — don't block the redirect.
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const ua = req.headers.get("user-agent") || null;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    supa.from("email_job_clicks").insert({
      job_id: jobId,
      recipient_email: recipientEmail,
      url: u,
      user_agent: ua,
      ip_address: ip,
    }).then(({ error }) => {
      if (error) console.error("[track-email-click] insert", error);
    });

    return redirect(target.toString());
  } catch (e) {
    console.error("[track-email-click] error", e);
    return redirect(FALLBACK_URL);
  }
});

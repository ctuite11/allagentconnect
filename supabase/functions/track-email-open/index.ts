import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { b64urlDecode, verifyOpen } from "../_shared/tracking.ts";

// 1x1 transparent GIF
const PIXEL = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (c) => c.charCodeAt(0),
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

function pixelResponse() {
  return new Response(PIXEL, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Content-Length": String(PIXEL.byteLength),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Always return the pixel, even on errors — never break the email rendering.
  try {
    const url = new URL(req.url);
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const ua = req.headers.get("user-agent") || null;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    // Legacy bulk-email pixel: ?id=<emailSendId> → insert into email_opens.
    const legacyId = url.searchParams.get("id");
    if (legacyId) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recent } = await supa
        .from("email_opens")
        .select("id")
        .eq("email_send_id", legacyId)
        .gte("opened_at", oneHourAgo)
        .limit(1);
      if (!recent || recent.length === 0) {
        await supa.from("email_opens").insert({
          email_send_id: legacyId,
          user_agent: ua,
          ip_address: ip,
        });
      }
      return pixelResponse();
    }

    const jobId = url.searchParams.get("j") || "";
    const r = url.searchParams.get("r") || "";
    const t = url.searchParams.get("t") || "";
    if (!jobId || !r || !t) return pixelResponse();

    let recipientEmail = "";
    try { recipientEmail = b64urlDecode(r); } catch { return pixelResponse(); }

    const ok = await verifyOpen({ jobId, recipientEmail, category: "" }, t);
    if (!ok) return pixelResponse();

    // De-dupe: skip if an open was recorded in the past hour.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await supa
      .from("email_job_opens")
      .select("id")
      .eq("job_id", jobId)
      .ilike("recipient_email", recipientEmail)
      .gte("opened_at", oneHourAgo)
      .limit(1);

    if (!recent || recent.length === 0) {
      await supa.from("email_job_opens").insert({
        job_id: jobId,
        recipient_email: recipientEmail,
        user_agent: ua,
        ip_address: ip,
      });
    }
  } catch (e) {
    console.error("[track-email-open] error", e);
  }

  return pixelResponse();
});

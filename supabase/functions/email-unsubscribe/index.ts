import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { b64urlDecode, verifyUnsub } from "../_shared/tracking.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

// Streams that can be unsubscribed from. Subscription-style categories plus
// the legacy `listing_shares` value (kept so previously-issued links keep
// working) and the catch-all `all`.
const VALID_CATEGORIES = new Set([
  "hot_sheet_alerts",
  "marketing",
  "account_reminders",
  "comms_broadcast",
  "comms_digest",
  "member_updates",
  "development_notifications",
  "listing_broadcast",
  "listing_shares",
  "all",
]);

function htmlPage(title: string, body: string, status = 200) {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif;background:#0F172A;color:#fff;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;color:#0f172a;max-width:480px;width:100%;padding:32px 28px;border-radius:14px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.25)}
h1{font-size:20px;margin:0 0 10px;color:#0E56F5}
p{font-size:14px;line-height:1.55;color:#475569;margin:0}
.ok{color:#22C55E}</style></head><body><div class="card">${body}</div></body></html>`,
    { status, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function processUnsub(email: string, category: string, source: string): Promise<boolean> {
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error } = await supa
    .from("email_unsubscribes")
    .upsert(
      { email, category, source },
      { onConflict: "email_lower,category", ignoreDuplicates: true },
    );
  if (error) {
    console.error("[email-unsubscribe] upsert error", error);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const e = url.searchParams.get("e") || "";
  const c = url.searchParams.get("c") || "";
  const t = url.searchParams.get("t") || "";

  if (!e || !c || !t || !VALID_CATEGORIES.has(c)) {
    return htmlPage("Invalid link", "<h1>Invalid unsubscribe link</h1><p>This link is malformed or expired. Please contact chris@allagentconnect.com.</p>", 400);
  }

  let email = "";
  try { email = b64urlDecode(e); } catch {
    return htmlPage("Invalid link", "<h1>Invalid unsubscribe link</h1><p>This link is malformed.</p>", 400);
  }

  const ok = await verifyUnsub(email, c, t);
  if (!ok) {
    return htmlPage("Invalid link", "<h1>Invalid unsubscribe link</h1><p>This link could not be verified.</p>", 400);
  }

  // POST = one-click unsubscribe (RFC 8058) — process immediately.
  if (req.method === "POST") {
    const success = await processUnsub(email, c, req.method === "POST" ? "one_click" : "preference_page");
    return new Response(success ? "OK" : "ERROR", {
      status: success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }

  // GET = browser-facing confirmation page; auto-process on load.
  const success = await processUnsub(email, c, "preference_page");
  const label =
    c === "listing_shares" ? "listing share emails" :
    c === "hot_sheet_alerts" ? "hot sheet alert emails" :
    c === "marketing" ? "marketing emails" :
    c === "account_reminders" ? "account reminder emails" :
    c === "comms_broadcast" || c === "comms_digest" ? "Communications Center emails" :
    c === "member_updates" ? "member update emails" :
    c === "development_notifications" ? "new development update emails" :
    c === "listing_broadcast" ? "listing notification emails" :
    "all marketing emails from All Agent Connect";

  if (!success) {
    return htmlPage("Error", "<h1>Something went wrong</h1><p>We couldn't process your request. Please email chris@allagentconnect.com.</p>", 500);
  }

  return htmlPage(
    "Unsubscribed",
    `<h1 class="ok">You're unsubscribed</h1><p><strong>${email}</strong> will no longer receive ${label}.</p><p style="margin-top:14px;font-size:12px;color:#94a3b8">Account, security, and other essential messages will still be delivered.</p><p style="margin-top:14px;font-size:12px"><a href="https://allagentconnect.com/communications?prefs=1" style="color:#0E56F5;text-decoration:underline;">Manage email preferences</a></p>`,
  );
});

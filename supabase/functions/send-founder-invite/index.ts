import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { buildUnsubUrl } from "../_shared/tracking.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FounderInviteRequest {
  recipientEmail: string;
  recipientName?: string;
}

const AAC_LOGO_URL = `${supabaseUrl}/storage/v1/object/public/brand-assets/aac-logo-green-black-v4.png`;

/**
 * Founding Partner invitation body — duplicated from send-bulk-email so this
 * 1:1 admin-only send path stays independent of the bulk pause gate.
 * Keep visually in sync with `buildFoundingPartnerBody` over there.
 */
function buildFoundingPartnerBody(): string {
  const benefits = [
    { title: "Pre-market & off-market inventory", desc: "Discover pre-market and off-market opportunities before they reach the public market." },
    { title: "Buyer need broadcasting", desc: "Put your buyer needs in front of listing agents before inventory reaches the market." },
    { title: "Success Hub command center", desc: "Buyers, listings, hot sheets, referrals, and live market activity in one command center." },
    { title: "Hot Sheets & saved searches", desc: "Real-time alerts for new listings, price drops, status changes, and back-on-market — shareable with buyers in one tap." },
    { title: "Branded buyer dashboard", desc: "Your clients get a dedicated portal under your name: favorites, new matches, messaging, and hot sheet alerts." },
    { title: "Verified agent referral network", desc: "Build trusted relationships with vetted agents across Massachusetts before public launch. Send referrals, share opportunities, and grow your network with agents who are helping shape the platform." },
  ];
  const benefitHtml = benefits.map((b) => `
    <tr><td style="padding:24px 0 0;">
      <h2 style="margin:0 0 10px;font-size:15px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#0f172a;line-height:1.3;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${b.title}</h2>
      <div style="width:32px;height:2px;background:#22C55E;margin:0 0 12px;border-radius:1px;"></div>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#475569;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${b.desc}</p>
    </td></tr>`).join("");
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;">
      <tr><td align="center" style="background-color:#0B0D12;border-radius:12px 12px 0 0;padding:22px 32px 22px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="border-collapse:collapse;margin:0 auto;">
          <tr>
            <td valign="middle" style="padding-right:12px;">
              <img src="${supabaseUrl}/storage/v1/object/public/brand-assets/aac-monogram-green.svg" width="36" height="36" alt="" style="display:block;border:0;outline:none;" />
            </td>
            <td valign="middle" style="line-height:1.1;">
              <p style="margin:0;font-size:18px;font-weight:600;letter-spacing:-0.01em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
              <p style="margin:4px 0 0;font-size:12px;font-weight:300;letter-spacing:0.05em;color:#a3a3a3;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Founding Partner</p>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:56px 0 0;">
        <h1 style="margin:0 0 28px;font-size:26px;font-weight:700;line-height:1.2;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Why pay to join a network when you can help launch one?</h1>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="border-left:3px solid #22C55E;padding:4px 0 4px 14px;">
              <p style="margin:0 0 10px;font-size:16px;line-height:1.55;color:#0f172a;font-style:italic;font-family:Georgia,'Times New Roman',serif;">&ldquo;I built AAC to become something special, and I hope you&rsquo;ll join me as a Founding Partner.&rdquo;</p>
              <p style="margin:0;font-size:13px;color:#0f172a;font-weight:600;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Chris Tuite</p>
              <p style="margin:0;font-size:12px;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Founder, All Agent Connect</p>
            </td>
          </tr>
        </table>
      </td></tr>
      ${benefitHtml}
      <tr><td align="center" style="padding:28px 0 0;">
        <a href="https://allagentconnect.com/auth?mode=register" style="display:inline-block;padding:14px 32px;background:#0E56F5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Founding Partners &rarr;</a>
      </td></tr>
      <tr><td style="padding:36px 0 0;">
        <p style="margin:0 0 16px;font-size:14px;color:#0f172a;line-height:1.6;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">As a Founding Partner, you&rsquo;ll get an early look at what we&rsquo;ve built with All Agent Connect, a preview of the upcoming launch of Direct Connect MLS and Stealth Seller, and a direct line to share where you believe the industry is headed. Most importantly, I&rsquo;d like your candid feedback&mdash;what works, what doesn&rsquo;t, and what you&rsquo;d like to see next.</p>
        <p style="margin:0 0 16px;font-size:14px;color:#0f172a;line-height:1.6;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">The agents helping shape AAC today will have a unique opportunity to help guide its growth tomorrow.</p>
        <p style="margin:0 0 4px;font-size:14px;color:#0f172a;font-weight:600;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Chris Tuite</p>
        <p style="margin:0;font-size:13px;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Founder, All Agent Connect<br/>617-877-0519 &middot; chris@allagentconnect.com</p>
      </td></tr>
      <tr><td style="padding:56px 0 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="background-color:#0B0D12;padding:32px 32px 30px;">
          <img src="${supabaseUrl}/storage/v1/object/public/brand-assets/aac-monogram-green.svg" width="32" height="32" alt="" style="display:block;margin:0 auto 10px;border:0;outline:none;" />
          <p style="margin:0;font-size:15px;font-weight:600;letter-spacing:-0.01em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
          <div style="width:36px;height:2px;background-color:#22C55E;margin:10px auto 12px;border-radius:1px;"></div>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:32px 0 0;">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">You&rsquo;re receiving this because you were personally selected for the Founding Partner program.</p>
      </td></tr>
    </table>`;
}

const htmlShell = (body: string) => `
  <!DOCTYPE html>
  <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
    <div class="content">${body}</div>
  </body></html>`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: userError } = await userClient.auth.getUser(jwt);
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: caller.id, _role: "admin",
    });
    if (isAdmin !== true) {
      return new Response(JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body: FounderInviteRequest = await req.json();
    const recipientEmail = (body.recipientEmail || "").trim().toLowerCase();
    const recipientName = (body.recipientName || "").trim();
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return new Response(JSON.stringify({ error: "Valid recipient email required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const unsubUrl = await buildUnsubUrl(recipientEmail, "marketing");
    const footer = `
      <p style="margin:24px 0 0;font-size:12px;color:#64748b;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
        Don't want these emails?
        <a href="${unsubUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
      </p>`;
    const html = htmlShell(buildFoundingPartnerBody()).replace("</body>", `${footer}</body>`);

    const subject = "An invitation to become an All Agent Connect Founding Partner";
    const senderFrom = "All Agent Connect <hello@notify.allagentconnect.com>";
    const senderReplyTo = "chris@allagentconnect.com";

    const { error: insertError } = await supabaseAdmin
      .from("email_jobs")
      .insert({
        payload: {
          provider: "resend",
          template: "founder-invite-1to1",
          to: recipientEmail,
          subject,
          html,
          from: senderFrom,
          reply_to: senderReplyTo,
          category: "marketing",
          variables: {
            recipientName,
            sentBy: caller.email,
            sentByUserId: caller.id,
            mode: "founder-invite-1to1",
          },
        },
      });

    if (insertError) {
      console.error("[send-founder-invite] enqueue failed:", insertError);
      return new Response(JSON.stringify({ error: "Failed to queue email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[send-founder-invite] queued for ${recipientEmail} by ${caller.email}`);
    return new Response(JSON.stringify({ success: true, queued: 1, recipient: recipientEmail }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[send-founder-invite] error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

serve(handler);
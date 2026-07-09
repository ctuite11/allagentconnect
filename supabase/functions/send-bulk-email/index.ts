import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { buildUnsubUrl } from "../_shared/tracking.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BulkEmailRequest {
  recipients: Array<{ email: string; name: string }>;
  subject: string;
  message: string;
  agentId: string;
  agentEmail?: string;
  sendAsGroup?: boolean;
  template?: string;
  /**
   * Diagnostic mode — bypasses the BULK_OUTREACH_PAUSED gate for a single
   * stripped-down one-recipient test. Sends minimal HTML (plain copy + a
   * single direct AAC link + visible unsubscribe). Used to isolate whether
   * Gmail spam placement is driven by template content or by stream
   * reputation. Never expose to clients without server-side checks: we
   * still enforce recipients.length === 1 and ignore the `template` field.
   */
  diagnostic?: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: string;
  current_count: number;
}

async function checkRateLimit(
  key: string,
  windowSeconds: number,
  limit: number
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('rate_limit_consume', {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });

  if (error) {
    console.error("[rate-limit] RPC error:", error);
    return { allowed: true, remaining: limit, reset_at: new Date().toISOString(), current_count: 0 };
  }

  // Handle array or single object return from RPC
  const row = Array.isArray(data) ? data[0] : data;
  return row as RateLimitResult;
}

function build429Response(resetAt: string): Response {
  const resetDate = new Date(resetAt);
  const retryAfter = Math.max(1, Math.ceil((resetDate.getTime() - Date.now()) / 1000));
  
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.floor(resetDate.getTime() / 1000)),
    },
  });
}

const STORAGE_BASE = `${supabaseUrl}/storage/v1/object/public/email-attachments/early-access-v1`;
const STORAGE_BASE_V2 = `${supabaseUrl}/storage/v1/object/public/email-attachments/early-access-v2`;
const IMG_VERSION_V2 = "v9";
const AAC_LOGO_URL = `https://allagentconnect.com/email/aac-monogram-green-128.png`;

const FUNCTIONS_HOST = supabaseUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
// Hard pause gate: bulk outreach is paused unless BULK_EMAIL_PAUSED is explicitly "false".
// Default (unset or any other value) = PAUSED. To unpause, set BULK_EMAIL_PAUSED=false.
const BULK_OUTREACH_PAUSED = (Deno.env.get("BULK_EMAIL_PAUSED") ?? "true").toLowerCase() !== "false";

/**
 * Wrap external http(s) hrefs in the html through the click redirector,
 * keyed by the per-recipient emailSendId. Skips mailto:, tel:, anchors,
 * and our own tracking endpoints.
 */
function wrapClickTracking(html: string, emailSendId: string): string {
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (match, url) => {
    if (FUNCTIONS_HOST && url.includes(FUNCTIONS_HOST)) return match;
    const wrapped = `${supabaseUrl}/functions/v1/track-email-click?id=${encodeURIComponent(emailSendId)}&u=${encodeURIComponent(url)}`;
    return `href="${wrapped}"`;
  });
}

function buildEarlyAccessUpdateBody(): string {
  const sections = [
    {
      img: `${STORAGE_BASE}/01-home.png`,
      title: "The new front door for elite real estate.",
      desc: "All Agent Connect is the private network where vetted agents share off-market opportunities, refer clients, and close faster — before listings ever touch the public market.",
      scenario: "Imagine an off-market $12.4M oceanfront estate in Watch Hill quietly surfacing to 240 vetted agents — before it ever hits Zillow.",
    },
    {
      img: `${STORAGE_BASE}/02-success-hub.png`,
      title: "Your Success Hub — every deal in one view.",
      desc: "Pipeline, buyer activity, listing performance, and live market signals on a single command center designed for top producers.",
      scenario: "Track 18 active buyers, 6 live listings, and a $42M pipeline — without juggling a single spreadsheet.",
    },
    {
      img: `${STORAGE_BASE}/03-comms.png`,
      title: "Communications Center — clients and colleagues, one inbox.",
      desc: "Email, message, and collaborate without leaving AAC. Every conversation tied to the right listing, buyer, or referral.",
      scenario: "A referral from a Greenwich agent, a question from your Nantucket buyer, and a co-broke thread on a Beacon Hill townhouse — all in one place.",
    },
    {
      img: `${STORAGE_BASE}/04-results.png`,
      title: "Results that move — MLS-grade search, AAC speed.",
      desc: "Find the right home or comp in seconds with rich filters, radius search, and live off-market inventory only AAC agents see.",
      scenario: "Pull every 4-bed waterfront under $5M within 10 miles of Newport — including the three off-market listings the public will never see.",
    },
    {
      img: `${STORAGE_BASE}/05-network.png`,
      title: "The Agent Referral Network — your trusted bench.",
      desc: "Discover and refer to top agents in any market. Every profile is verified, protected from cold scraping, and ready to send a deal your way.",
      scenario: "Send your relocating Boston client to a verified top producer in Aspen — and earn a referral fee on a $6.8M closing.",
    },
  ];

  const sectionHtml = sections.map((s, i) => `
    <tr><td style="padding:${i === 0 ? "8px" : "32px"} 0 0;">
      <img src="${s.img}" alt="${s.title}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:12px;" />
      <h2 style="margin:20px 0 8px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.25;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${s.title}</h2>
      <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${s.desc}</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#64748b;font-style:italic;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${s.scenario}</p>
    </td></tr>`).join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;">
      <tr><td align="center" style="padding:0 0 24px;">
        <img src="${AAC_LOGO_URL}" alt="All Agent Connect" height="36" style="display:block;height:36px;width:auto;border:0;outline:none;" />
      </td></tr>
      <tr><td style="padding:0 0 8px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#0E56F5;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Early Access Update</p>
        <h1 style="margin:0 0 10px;font-size:28px;font-weight:800;line-height:1.15;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">A first look inside All Agent Connect.</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Five new ways AAC is changing how top agents work together. Scenarios below are illustrative only.</p>
      </td></tr>
      ${sectionHtml}
      <tr><td align="center" style="padding:36px 0 8px;">
        <a href="https://allagentconnect.com/agent-dashboard" style="display:inline-block;padding:14px 28px;background:#0E56F5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Open your Success Hub</a>
      </td></tr>
      <tr><td style="padding:24px 0 0;">
        <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">You're receiving this because you registered for early access at allagentconnect.com.</p>
      </td></tr>
    </table>`;
}

function buildEarlyAccessUpdateV2Body(): string {
  const heroImg = `${STORAGE_BASE_V2}/01-home.png?v=${IMG_VERSION_V2}`;

  const rows: Array<{ img: string; title: string; desc: string; bullets: string[] }> = [
    {
      img: `${STORAGE_BASE_V2}/02-success-hub.png?v=${IMG_VERSION_V2}`,
      title: "Success Hub",
      desc: "One centralized place for buyers, listings, hot sheets, conversations, favorites, and referrals.",
      bullets: ["Buyer management", "Hot sheets & saved searches", "Listing visibility", "Internal collaboration", "Real-time activity", "Referral opportunities"],
    },
    {
      img: `${STORAGE_BASE_V2}/03-results.png?v=${IMG_VERSION_V2}`,
      title: "Search Results",
      desc: "Real-time market visibility. Search listings, map inventory, save hot sheets, and share opportunities instantly.",
      bullets: ["Interactive map search", "Real-time listing updates", "Save as hot sheet", "Share directly with agents"],
    },
    {
      img: `${STORAGE_BASE_V2}/04-comms.png?v=${IMG_VERSION_V2}`,
      title: "Communications Center",
      desc: "Straight to your email. Internal direct messaging built for active real estate collaboration.",
      bullets: ["Buyer needs", "Off-market opportunities", "Rental requests", "Referral discussions", "Sales intel"],
    },
    {
      img: `${STORAGE_BASE_V2}/06-hot-sheets.png?v=${IMG_VERSION_V2}`,
      title: "Hot Sheets",
      desc: "Track listings that matter most with real-time alerts based on saved search criteria — coming soon, new, price drops, back on market, and private inventory.",
      bullets: ["Saved search alerts", "Coming-soon & new listings", "Price drops & status changes", "Share with buyers in one tap"],
    },
    {
      img: `${STORAGE_BASE_V2}/07-buyers.png?v=${IMG_VERSION_V2}`,
      title: "Your Buyers",
      desc: "A dedicated buyer portal that keeps clients engaged — favorites, new matches, unread messages, and hot sheet alerts all in one place.",
      bullets: ["Buyer dashboard & favorites", "New match notifications", "Direct messaging with you", "Branded under your name"],
    },
    {
      img: `${STORAGE_BASE_V2}/05-network.png?v=${IMG_VERSION_V2}`,
      title: "Verified Agent Network",
      desc: "Relationships still matter. AAC helps agents connect directly with trusted professionals across markets and specialties.",
      bullets: ["Search by name or market", "View agent specialties", "Build trusted relationships", "Grow your network"],
    },
  ];

  const rowHtml = rows.map((r) => `
    <tr><td style="padding:32px 20px 0;">
      <img src="${r.img}" alt="${r.title}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border-radius:10px;border:1px solid #94a3b8;" />
      <h2 style="margin:16px 0 6px;font-size:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0f172a;line-height:1.3;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${r.title}</h2>
      <div style="width:24px;height:2px;background:#22C55E;margin:0 0 10px;border-radius:1px;"></div>
      <p style="margin:0 0 10px;font-size:13px;line-height:1.55;color:#475569;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${r.desc}</p>
      ${r.bullets.map(b => `<p style="margin:0 0 3px;font-size:12px;line-height:1.4;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><span style="color:#22C55E;font-weight:700;">✓</span> ${b}</p>`).join("")}
    </td></tr>`).join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;">
      <tr><td align="center" style="padding:0 20px 24px;">
        <img src="${AAC_LOGO_URL}" alt="All Agent Connect" height="36" style="display:block;height:36px;width:auto;border:0;outline:none;" />
      </td></tr>
      <tr><td align="center" style="padding:0 20px 16px;text-align:center;">
        <h1 style="margin:0 0 10px;font-size:26px;font-weight:700;line-height:1.2;color:#0f172a;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">The private listing network.</h1>
        <p style="margin:0 auto;max-width:480px;font-size:14px;line-height:1.6;color:#475569;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Share coming-soon listings, off-market inventory, and active buyer demand with verified agents before it goes public.</p>
      </td></tr>
      <tr><td align="center" style="padding:4px 20px 8px;">
        <a href="https://allagentconnect.com/auth?mode=register" style="display:inline-block;padding:12px 24px;background:#0E56F5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Register for Early Access &rarr;</a>
      </td></tr>
      <tr><td style="padding:8px 20px 0;">
        <img src="${heroImg}" alt="All Agent Connect homepage" width="560" style="display:block;width:100%;max-width:560px;height:auto;border-radius:12px;border:1px solid #94a3b8;" />
      </td></tr>
      <tr><td align="center" style="padding:20px 20px 0;">
        <p style="margin:0 0 6px;font-size:15px;font-weight:700;letter-spacing:0.02em;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Elite connections. Proven results.</p>
        <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">The private network for matching buyer needs with off-market inventory.</p>
        <p style="margin:0;font-size:13px;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Exclusive, top-tier networking designed for your success.</p>
      </td></tr>
      ${rowHtml}
      <tr><td align="center" style="padding:40px 20px 0;">
        <a href="https://allagentconnect.com/auth?mode=register" style="display:inline-block;padding:14px 28px;background:#0E56F5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Register for Early Access &rarr;</a>
      </td></tr>
      <tr><td style="padding:36px 20px 0;border-top:1px solid #e2e8f0;margin-top:32px;">
        <p style="margin:24px 0 4px;font-size:14px;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">More to come soon.</p>
        <p style="margin:0 0 4px;font-size:14px;color:#0f172a;font-weight:600;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Chris Tuite</p>
        <p style="margin:0;font-size:13px;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Founder, All Agent Connect<br/>617-877-0519 · chris@allagentconnect.com</p>
      </td></tr>
      <tr><td style="padding:24px 20px 0;">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">You're receiving this because you registered for early access at allagentconnect.com.</p>
      </td></tr>
    </table>`;
}

function buildFoundingPartnerBody(): string {
  const benefits: Array<{ title: string; desc: string }> = [
    {
      title: "Pre-market & off-market inventory",
      desc: "Discover pre-market and off-market opportunities before they reach the public market.",
    },
    {
      title: "Buyer need broadcasting",
      desc: "Put your buyer needs in front of listing agents before inventory reaches the market.",
    },
    {
      title: "Success Hub command center",
      desc: "Buyers, listings, hot sheets, referrals, and live market activity in one command center.",
    },
    {
      title: "Hot Sheets & saved searches",
      desc: "Real-time alerts for new listings, price drops, status changes, and back-on-market — shareable with buyers in one tap.",
    },
    {
      title: "Branded buyer dashboard",
      desc: "Your clients get a dedicated portal under your name: favorites, new matches, messaging, and hot sheet alerts.",
    },
    {
      title: "Verified agent referral network",
      desc: "Build trusted relationships with vetted agents across Massachusetts before public launch. Send referrals, share opportunities, and grow your network with agents who are helping shape the platform.",
    },
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
              <img src="https://allagentconnect.com/email/aac-monogram-green-128.png" width="36" height="36" alt="All Agent Connect" style="display:block;border:0;outline:none;text-decoration:none;" />
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
        <p style="margin:0;font-size:13px;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Founder, All Agent Connect<br/>617-877-0519 · chris@allagentconnect.com</p>
      </td></tr>
      <tr><td style="padding:56px 0 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="background-color:#0B0D12;padding:32px 32px 30px;">
          <img src="https://allagentconnect.com/email/aac-monogram-green-128.png" width="32" height="32" alt="All Agent Connect" style="display:block;margin:0 auto 10px;border:0;outline:none;text-decoration:none;" />
          <p style="margin:0;font-size:15px;font-weight:600;letter-spacing:-0.01em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
          <div style="width:36px;height:2px;background-color:#22C55E;margin:10px auto 12px;border-radius:1px;"></div>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:32px 0 0;">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">You&rsquo;re receiving this because you were personally selected for the Founding Partner program.</p>
      </td></tr>
    </table>`;
}

function buildPrivateListingNetworkBody(): string {
  const heroImg = `${STORAGE_BASE_V2}/01-home.png?v=${IMG_VERSION_V2}`;
  const ctaUrl = "https://allagentconnect.com/agent-dashboard";
  const ctaLabel = "Join the Private Listing Network";

  const ctaButton = (label: string) => `
    <tr><td align="center" style="padding:24px 0 0;">
      <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;background:#0E56F5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${label} &rarr;</a>
    </td></tr>`;

  const rows: Array<{ img: string; title: string; desc: string; bullets: string[]; cta: string }> = [
    {
      img: `${STORAGE_BASE_V2}/02-success-hub.png?v=${IMG_VERSION_V2}`,
      title: "Success Hub",
      desc: "Your private command center for buyers, listings, hot sheets, and referrals — every opportunity in one place.",
      bullets: ["Buyer management", "Hot sheets & saved searches", "Listing visibility", "Real-time activity"],
      cta: "Open your Success Hub",
    },
    {
      img: `${STORAGE_BASE_V2}/03-results.png?v=${IMG_VERSION_V2}`,
      title: "Pre-Market Inventory",
      desc: "Search coming-soon and off-market listings only verified agents can see — before they ever hit the public market.",
      bullets: ["Interactive map search", "Real-time off-market updates", "Save as hot sheet", "Share with verified agents"],
      cta: "Browse the private network",
    },
    {
      img: `${STORAGE_BASE_V2}/04-comms.png?v=${IMG_VERSION_V2}`,
      title: "Communications Center",
      desc: "Share buyer needs, off-market opportunities, and referrals directly with the agents who can close them.",
      bullets: ["Buyer needs", "Off-market opportunities", "Referral discussions", "Sales intel"],
      cta: "Start a conversation",
    },
    {
      img: `${STORAGE_BASE_V2}/05-network.png?v=${IMG_VERSION_V2}`,
      title: "Verified Agent Network",
      desc: "Connect with vetted top producers across every market. Every profile verified, every relationship protected.",
      bullets: ["Search by name or market", "View agent specialties", "Build trusted relationships", "Grow your network"],
      cta: "Explore the network",
    },
  ];

  const rowHtml = rows.map((r) => `
    <tr><td style="padding:32px 0 0;">
      <img src="${r.img}" alt="${r.title}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:10px;border:1px solid #94a3b8;" />
      <h2 style="margin:16px 0 10px;font-size:16px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#0f172a;line-height:1.3;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${r.title}</h2>
      <div style="width:32px;height:2px;background:#22C55E;margin:0 0 12px;border-radius:1px;"></div>
      <p style="margin:0 0 12px;font-size:13px;line-height:1.55;color:#475569;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${r.desc}</p>
      ${r.bullets.map(b => `<p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><span style="color:#22C55E;font-weight:700;">&#10003;</span> ${b}</p>`).join("")}
      <p style="margin:14px 0 0;font-size:13px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><a href="${ctaUrl}" style="color:#0E56F5;font-weight:600;text-decoration:none;">${r.cta} &rarr;</a></p>
    </td></tr>`).join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;">
      <tr><td align="center" style="padding:0 0 24px;">
        <img src="${AAC_LOGO_URL}" alt="All Agent Connect" height="36" style="display:block;height:36px;width:auto;border:0;outline:none;" />
      </td></tr>
      <tr><td style="padding:0 0 16px;">
        <h1 style="margin:0 0 10px;font-size:26px;font-weight:700;line-height:1.2;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">The private listing network where agents share pre-market intelligence.</h1>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Share coming-soon listings, off-market inventory, and active buyer demand with verified agents &mdash; before it goes public.</p>
      </td></tr>
      <tr><td style="padding:8px 0 0;">
        <img src="${heroImg}" alt="All Agent Connect &mdash; the private listing network" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:12px;border:1px solid #94a3b8;" />
      </td></tr>
      ${ctaButton(ctaLabel)}
      <tr><td align="center" style="padding:20px 0 0;">
        <p style="margin:0 0 6px;font-size:15px;font-weight:700;letter-spacing:0.02em;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Elite connections. Proven results.</p>
        <p style="margin:0;font-size:13px;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Built for the agents shaping their market before the market sees it.</p>
      </td></tr>
      ${rowHtml}
      <tr><td style="padding:36px 0 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7FBF4;border:1px solid #22C55E;border-radius:10px;">
          <tr><td align="center" style="padding:22px 24px;">
            <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Free for verified agents.</p>
            <p style="margin:0;font-size:13px;color:#475569;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Join the private network of top producers sharing pre-market inventory today.</p>
          </td></tr>
        </table>
      </td></tr>
      ${ctaButton(ctaLabel)}
      <tr><td align="center" style="padding:12px 0 0;">
        <a href="mailto:chris@allagentconnect.com?subject=Private%20Listing%20Network" style="font-size:13px;color:#0E56F5;text-decoration:underline;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Or reply directly to Chris with questions</a>
      </td></tr>
      <tr><td style="padding:36px 0 0;border-top:1px solid #e2e8f0;">
        <p style="margin:24px 0 4px;font-size:14px;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">See you inside.</p>
        <p style="margin:0 0 4px;font-size:14px;color:#0f172a;font-weight:600;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Chris Tuite</p>
        <p style="margin:0;font-size:13px;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Founder, All Agent Connect<br/>617-877-0519 · chris@allagentconnect.com</p>
      </td></tr>
      <tr><td style="padding:24px 0 0;">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">You&rsquo;re receiving this because you&rsquo;re a verified agent in the All Agent Connect network.</p>
      </td></tr>
    </table>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: BulkEmailRequest = await req.json();
    const isDiagnostic = body.diagnostic === true && Array.isArray(body.recipients) && body.recipients.length === 1;
    const isProfileReminder = body.template === "profile-reminder";

    if (BULK_OUTREACH_PAUSED && !isDiagnostic && !isProfileReminder) {
      return new Response(
        JSON.stringify({
          error: "Bulk outreach is temporarily paused to protect email deliverability.",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { recipients, subject, message, agentId, agentEmail, sendAsGroup = false, template } = body;

    const isTemplated =
      !isDiagnostic && (
      template === "early-access-update-v1" ||
      template === "early-access-update-v2" ||
      template === "founding-partner-invitation" ||
      template === "private-listing-network");

    console.log(`[send-bulk-email] Enqueuing bulk email to ${recipients.length} recipients`);

    if (!recipients || recipients.length === 0) {
      throw new Error("No recipients provided");
    }

    if (!subject) {
      throw new Error("Subject is required");
    }
    if (!isTemplated && !message) {
      throw new Error("Message is required");
    }

    if (!agentId) {
      throw new Error("Agent ID is required");
    }

    // Cap recipients to prevent abuse
    if (recipients.length > 1000) {
      throw new Error("Maximum 1000 recipients allowed per bulk email");
    }

    // Database-backed rate limiting: 2 bulk email campaigns per minute per user
    const rateLimitKey = `route:send-bulk-email|user:${agentId}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, 60, 2);
    
    if (!rateLimitResult.allowed) {
      console.log(`[rate-limit] Blocked user: ${agentId}, count: ${rateLimitResult.current_count}`);
      return build429Response(rateLimitResult.reset_at);
    }

    // Create email campaign record for tracking
    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .insert({
        agent_id: agentId,
        subject,
        message,
        recipient_count: recipients.length,
      })
      .select()
      .single();

    if (campaignError) {
      console.error("[send-bulk-email] Error creating campaign:", campaignError);
      throw new Error("Failed to create campaign");
    }

    console.log("[send-bulk-email] Created campaign:", campaign.id);

    // Deliverability decision (locked):
    // Always send bulk/outreach emails as the brand identity to avoid
    // display-name spoofing heuristics in Gmail/Outlook. Agent's real
    // email is preserved as Reply-To so replies route correctly.
    // DO NOT reintroduce dynamic display-name overrides on this shared
    // mailbox — it damaged sender reputation. Per-agent identity for
    // outreach should move to a dedicated `outreach.allagentconnect.com`
    // sender, not be spoofed on the transactional mailbox.
    // Deliverability fix: send bulk from the same subdomain that is
    // currently inboxing on transactional streams.
    const senderFrom = "All Agent Connect <hello@allagentconnect.com>";
    let senderReplyTo = agentEmail || "hello@allagentconnect.com";
    try {
      const { data: sender } = await supabase
        .from("agent_profiles")
        .select("email")
        .eq("id", agentId)
        .maybeSingle();
      if (sender?.email) senderReplyTo = sender.email;
    } catch (e) {
      console.error("[send-bulk-email] Sender lookup failed, using default Reply-To:", e);
    }
    console.log("[send-bulk-email] Sender:", senderFrom, "Reply-To:", senderReplyTo);

    // Preserve user-inserted HTML (images, links). Otherwise escape and convert newlines.
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const renderedBody = template === "private-listing-network"
      ? buildPrivateListingNetworkBody()
      : template === "founding-partner-invitation"
        ? buildFoundingPartnerBody()
        : template === "early-access-update-v2"
          ? buildEarlyAccessUpdateV2Body()
          : template === "early-access-update-v1"
            ? buildEarlyAccessUpdateBody()
            : (/<[a-z][\s\S]*>/i.test(message) ? message : escapeHtml(message).replace(/\n/g, "<br>"));

    // Diagnostic: absolute minimum HTML — no <style>, no wrapper class, no images,
    // single direct AAC link, visible unsubscribe appended later.
    const diagnosticHtml = (recipientName: string, unsubUrl: string) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222;">
<p>Hi ${escapeHtml(recipientName)},</p>
<p>${escapeHtml(message || "This is a diagnostic message from All Agent Connect.")}</p>
<p>Visit <a href="https://allagentconnect.com">https://allagentconnect.com</a>.</p>
<p>Chris</p>
<p style="font-size:11px;color:#666;margin-top:24px;">Don't want these emails? <a href="${unsubUrl}" style="color:#666;">Unsubscribe</a></p>
</body></html>`;

    // Standard bulk template
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .content img { max-width: 100%; height: auto; }
            .content a { color: #0E56F5; }
          </style>
        </head>
        <body>
          <div class="content">
            {{GREETING}}
            <div>${renderedBody}</div>
          </div>
        </body>
      </html>
    `;

    // For group sends (small groups), create a single job with all recipients
    if (sendAsGroup && recipients.length < 5) {
      console.log("[send-bulk-email] Enqueuing as group email");

      // Create email send record for tracking
      const { data: emailSend } = await supabase
        .from("email_sends")
        .insert({
          campaign_id: campaign.id,
          recipient_email: recipients[0].email,
          recipient_name: "Group Email",
        })
        .select()
        .single();

      // Deliverability pass: no open pixel, no click wrappers. Direct URLs only.
      const groupUnsubUrl = await buildUnsubUrl(recipients[0].email, "marketing");
      const unsubFooter = `
        <p style="margin:24px 0 0;font-size:12px;color:#64748b;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
          Don't want these emails?
          <a href="${groupUnsubUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
        </p>`;
      const groupHtml = htmlTemplate
        .replace("{{GREETING}}", "")
        .replace("</body>", `${unsubFooter}</body>`);

      // Enqueue single group job
      const { error: insertError } = await supabase
        .from("email_jobs")
        .insert({
          payload: {
            provider: "resend",
            template: "bulk-email-group",
            to: recipients.map(r => r.email).join(","), // Worker will split this
            subject: subject,
            html: groupHtml,
            from: senderFrom,
            reply_to: senderReplyTo,
            category: "marketing",
            variables: {
              campaignId: campaign.id,
              isGroup: true,
              recipients: recipients,
            },
          },
        });

      if (insertError) {
        console.error("[send-bulk-email] Failed to enqueue group job:", insertError);
        throw new Error("Failed to queue email for sending");
      }

      return new Response(
        JSON.stringify({
          success: true,
          queued: 1,
          total: recipients.length,
          mode: "group",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // For individual sends, create one job per recipient
    const emailJobs = await Promise.all(
      recipients.map(async (recipient) => {
        // Create email send record for tracking
        const { data: emailSend } = await supabase
          .from("email_sends")
          .insert({
            campaign_id: campaign.id,
            recipient_email: recipient.email,
            recipient_name: recipient.name,
          })
          .select()
          .single();

        const trackingPixelUrl = emailSend 
          ? `${supabaseUrl}/functions/v1/track-email-open?id=${emailSend.id}`
          : "";

        // Deliverability pass: no open pixel, no click wrappers. Direct URLs only.
        const unsubUrl = await buildUnsubUrl(recipient.email, "marketing");
        const unsubFooter = `
          <p style="margin:24px 0 0;font-size:12px;color:#64748b;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
            Don't want these emails?
            <a href="${unsubUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
          </p>`;
        const personalizedHtml = isDiagnostic
          ? diagnosticHtml(recipient.name, unsubUrl)
          : htmlTemplate
              .replace("{{GREETING}}", isTemplated ? "" : `<p>Hello ${recipient.name},</p>`)
              .replace("</body>", `${unsubFooter}</body>`);

        return {
          payload: {
            provider: "resend",
            template: "bulk-email",
            to: recipient.email,
            subject: subject,
            html: personalizedHtml,
            from: senderFrom,
            reply_to: senderReplyTo,
            category: "marketing",
            variables: {
              recipientName: recipient.name,
              campaignId: campaign.id,
              emailSendId: emailSend?.id,
            },
          },
        };
      })
    );

    // Insert all jobs into the queue
    const { error: insertError } = await supabase
      .from("email_jobs")
      .insert(emailJobs);

    if (insertError) {
      console.error("[send-bulk-email] Failed to enqueue jobs:", insertError);
      throw new Error("Failed to queue emails for sending");
    }

    console.log(`[send-bulk-email] Successfully enqueued ${emailJobs.length} jobs`);

    return new Response(
      JSON.stringify({
        success: true,
        queued: emailJobs.length,
        total: recipients.length,
        campaignId: campaign.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("[send-bulk-email] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
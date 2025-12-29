// supabase edge function: send-auth-email
// Purpose: Handle Supabase Auth "Send Email Hook" and send emails via Resend
// Requirements:
// - SEND_EMAIL_HOOK_SECRET (from Supabase hook UI)
// - RESEND_API_KEY
// - RESEND_FROM_EMAIL (hello@mail.allagentconnect.com)
// - RESEND_REPLY_TO (hello@allagentconnect.com)

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
};

function mustGetEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function baseEmailHtml(opts: { title: string; bodyHtml: string; ctaLabel?: string; ctaUrl?: string }) {
  const { title, bodyHtml, ctaLabel, ctaUrl } = opts;

  const buttonHtml =
    ctaLabel && ctaUrl
      ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px auto;">
        <tr>
          <td style="border-radius:6px;background:#18181b;">
            <a href="${escapeHtml(ctaUrl)}" target="_blank" style="display:inline-block;padding:14px 36px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              ${escapeHtml(ctaLabel)}
            </a>
          </td>
        </tr>
      </table>
    `
      : "";

  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>AllAgentConnect</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f8fafc;">
        <tr>
          <td align="center" style="padding:48px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px;background-color:#ffffff;border-radius:8px;border:1px solid #e2e8f0;">
              <!-- Header -->
              <tr>
                <td style="padding:32px 32px 24px;border-bottom:1px solid #e2e8f0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-size:20px;font-weight:700;color:#18181b;letter-spacing:-0.025em;">
                        All<span style="color:#64748b;">Agent</span>Connect
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:32px;">
                  <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#18181b;line-height:1.3;">
                    ${escapeHtml(title)}
                  </h1>
                  <div style="font-size:15px;line-height:1.7;color:#475569;">
                    ${bodyHtml}
                  </div>
                  ${buttonHtml}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;">
                  <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">
                    © ${new Date().getFullYear()} AllAgentConnect
                  </p>
                  <p style="margin:0;font-size:12px;color:#cbd5e1;">
                    mail.allagentconnect.com
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

function buildEmailForType(params: {
  type: string;
  email: string;
  actionUrl?: string;
  otp?: string;
}): { subject: string; html: string; text: string } {
  const { type, actionUrl, otp } = params;

  const t = (type || "").toLowerCase();

  if (t.includes("recovery") || t.includes("reset")) {
    const subject = "Reset your password";
    const title = "Reset your password";
    const bodyHtml = `
      <p style="margin:0 0 16px;">Click below to set a new password for your account.</p>
      <p style="margin:0;color:#64748b;font-size:14px;">This link expires in 24 hours. If you didn't request this, you can safely ignore this email.</p>
    `;
    const html = baseEmailHtml({
      title,
      bodyHtml,
      ctaLabel: "Reset Password",
      ctaUrl: actionUrl,
    });
    const text = `Reset your password: ${actionUrl ?? ""}\n\nThis link expires in 24 hours. If you didn't request this, ignore this email.`;
    return { subject, html, text };
  }

  if (t.includes("signup") || t.includes("confirm")) {
    const subject = "Confirm your email for AllAgentConnect";
    const title = "Confirm your email";
    const bodyHtml = `
      <p>To finish signing up for AllAgentConnect, please confirm your email address.</p>
      <p>This helps us keep the platform trusted and agent-only.</p>
    `;
    const html = baseEmailHtml({
      title,
      bodyHtml,
      ctaLabel: "Confirm email",
      ctaUrl: actionUrl,
    });
    const text = `Confirm your email: ${actionUrl ?? ""}`;
    return { subject, html, text };
  }

  if (t.includes("magic")) {
    const subject = "Your AllAgentConnect sign-in link";
    const title = "Sign in to AllAgentConnect";
    const bodyHtml = `
      <p>Use the button below to sign in. This link may expire for security.</p>
    `;
    const html = baseEmailHtml({
      title,
      bodyHtml,
      ctaLabel: "Sign in",
      ctaUrl: actionUrl,
    });
    const text = `Sign in: ${actionUrl ?? ""}`;
    return { subject, html, text };
  }

  if (t.includes("email_change")) {
    const subject = "Confirm your new email for AllAgentConnect";
    const title = "Confirm your new email";
    const bodyHtml = `
      <p>Use the button below to confirm your new email address.</p>
    `;
    const html = baseEmailHtml({
      title,
      bodyHtml,
      ctaLabel: "Confirm new email",
      ctaUrl: actionUrl,
    });
    const text = `Confirm new email: ${actionUrl ?? ""}`;
    return { subject, html, text };
  }

  // Fallback
  const subject = "AllAgentConnect email";
  const title = "Action required";
  const bodyHtml = `
    <p>Please use the link below to continue.</p>
    ${otp ? `<p style="font-size:18px;font-weight:600;">One-time code: ${escapeHtml(otp)}</p>` : ""}
  `;
  const html = baseEmailHtml({
    title,
    bodyHtml,
    ctaLabel: actionUrl ? "Continue" : undefined,
    ctaUrl: actionUrl,
  });
  const text = `Continue: ${actionUrl ?? ""}${otp ? `\nOne-time code: ${otp}` : ""}`;
  return { subject, html, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const hookSecret = mustGetEnv("SEND_EMAIL_HOOK_SECRET");
    const resendApiKey = mustGetEnv("RESEND_API_KEY");
    const resendFromEmail = mustGetEnv("RESEND_FROM_EMAIL");
    const resendReplyTo = mustGetEnv("RESEND_REPLY_TO");

    const rawBody = await req.text();
    const headersObj = Object.fromEntries(req.headers.entries());

    // Verify signature from Supabase Auth Hook using Standard Webhooks
    const wh = new Webhook(hookSecret);
    const verified = wh.verify(rawBody, headersObj) as any;

    // Payload format can differ slightly depending on Supabase version/config.
    // We defensively extract what we need.
    const email = verified?.user?.email || verified?.email || verified?.recipient;
    const type =
      verified?.email_data?.template?.type ||
      verified?.email_data?.type ||
      verified?.type ||
      verified?.template ||
      "unknown";

    const actionUrl =
      verified?.email_data?.action_link ||
      verified?.email_data?.action_url ||
      verified?.email_data?.redirect_to ||
      verified?.action_link ||
      verified?.action_url ||
      verified?.url;

    const otp =
      verified?.email_data?.otp ||
      verified?.email_data?.token ||
      verified?.otp ||
      verified?.token;

    if (!email) {
      console.error("send-auth-email: Missing recipient email in verified payload", verified);
      return new Response(JSON.stringify({ error: "Missing recipient email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("send-auth-email hook invoked:", {
      type,
      email,
      hasActionUrl: !!actionUrl,
    });

    const resend = new Resend(resendApiKey);

    const { subject, html, text } = buildEmailForType({
      type,
      email,
      actionUrl,
      otp,
    });

    const from = `AllAgentConnect <${resendFromEmail}>`;

    const sendRes = await resend.emails.send({
      from,
      to: email,
      reply_to: resendReplyTo,
      subject,
      html,
      text,
    });

    console.log("send-auth-email: Resend response", sendRes);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("send-auth-email error:", err?.message || err, err?.stack);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

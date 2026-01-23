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

// Locked AAC transactional email template
function buildLockedEmailHtml(opts: { title: string; bodyText: string; ctaLabel?: string; ctaUrl?: string }): string {
  const { title, bodyText, ctaLabel, ctaUrl } = opts;

  const buttonHtml = ctaLabel && ctaUrl
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center" style="padding:8px 0 24px;">
            <a href="${escapeHtml(ctaUrl)}" target="_blank" style="display:inline-block;padding:14px 28px;background-color:#0F172A;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(ctaLabel)}</a>
          </td>
        </tr>
      </table>`
    : "";

  const fallbackHtml = ctaUrl
    ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
        If the button doesn't work, copy and paste this URL into your browser:
      </p>
      <div style="background-color:#F8FAFC;padding:12px;border-radius:6px;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#475569;word-break:break-all;font-family:monospace;">${escapeHtml(ctaUrl)}</p>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:48px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;">
          <!-- Header: Plain text only -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;">
              <p style="margin:0;font-size:20px;font-weight:600;color:#0F172A;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">AllAgentConnect</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:0 40px 32px;">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F172A;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(title)}</h2>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
                ${escapeHtml(bodyText)}
              </p>
              ${buttonHtml}
              ${fallbackHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;line-height:1.5;color:#64748B;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">AllAgentConnect</p>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#64748B;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">hello@allagentconnect.com</p>
              <p style="margin:0;font-size:11px;line-height:1.5;color:#94a3b8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
                <a href="mailto:hello@allagentconnect.com?subject=Remove%20My%20Account&body=Please%20remove%20my%20account%20from%20AllAgentConnect." style="color:#94a3b8;text-decoration:underline;">Click here</a> to request account removal.
              </p>
            </td>
          </tr>
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
    const html = buildLockedEmailHtml({
      title: "Reset your password",
      bodyText: "We received a request to reset your password. Click below to choose a new one. This link expires in 1 hour. If you didn't request this, you can safely ignore this email.",
      ctaLabel: "Reset Password",
      ctaUrl: actionUrl,
    });
    const text = `Reset your password: ${actionUrl ?? ""}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`;
    return { subject, html, text };
  }

  if (t.includes("signup") || t.includes("confirm")) {
    const subject = "Confirm your email for AllAgentConnect";
    const html = buildLockedEmailHtml({
      title: "Confirm your email",
      bodyText: "To finish signing up for AllAgentConnect, please confirm your email address. This helps us keep the platform trusted and agent-only.",
      ctaLabel: "Confirm Email",
      ctaUrl: actionUrl,
    });
    const text = `Confirm your email: ${actionUrl ?? ""}`;
    return { subject, html, text };
  }

  if (t.includes("magic")) {
    const subject = "Your AllAgentConnect sign-in link";
    const html = buildLockedEmailHtml({
      title: "Sign in to AllAgentConnect",
      bodyText: "Use the button below to sign in. This link may expire for security.",
      ctaLabel: "Sign In",
      ctaUrl: actionUrl,
    });
    const text = `Sign in: ${actionUrl ?? ""}`;
    return { subject, html, text };
  }

  if (t.includes("email_change")) {
    const subject = "Confirm your new email for AllAgentConnect";
    const html = buildLockedEmailHtml({
      title: "Confirm your new email",
      bodyText: "Use the button below to confirm your new email address.",
      ctaLabel: "Confirm New Email",
      ctaUrl: actionUrl,
    });
    const text = `Confirm new email: ${actionUrl ?? ""}`;
    return { subject, html, text };
  }

  // Fallback
  const subject = "AllAgentConnect";
  const bodyText = otp
    ? `Please use the link below to continue. Your one-time code is: ${otp}`
    : "Please use the link below to continue.";
  const html = buildLockedEmailHtml({
    title: "Action required",
    bodyText,
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

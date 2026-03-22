/* ------------------------------------------------------------------ */
/*  Unified AAC email template — single source of truth               */
/*  All edge-function emails route through buildAacEmail()            */
/* ------------------------------------------------------------------ */

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

interface AacEmailOptions {
  headline: string;
  /** Already-assembled HTML body content (paragraphs, tables, etc.) */
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Hidden preheader text shown in inbox preview */
  preheader?: string;
}

// Bulletproof HTML/CSS lettermark — renders in all email clients
const LOGO_LETTERMARK = `<table role="presentation" cellspacing="0" cellpadding="0"><tr><td align="center">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" style="width:48px;height:48px;" arcsize="50%" fill="true" stroke="false"><v:fill color="#0E56F5"/><v:textbox inset="0,0,0,0" style="mso-fit-shape-to-text:false;"><center style="font-size:18px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;">AAC</center></v:textbox></v:roundrect><![endif]-->
<!--[if !mso]><!-->
<div style="width:48px;height:48px;border-radius:50%;background-color:#0E56F5;display:inline-block;vertical-align:middle;text-align:center;line-height:48px;font-size:18px;font-weight:700;color:#ffffff;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.5px;">AAC</div>
<!--<![endif]-->
</td></tr></table>`;

export function buildAacEmail(opts: AacEmailOptions): string {
  const { headline, body, ctaLabel, ctaUrl, preheader } = opts;

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>`
    : "";

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr><td align="center" style="padding:28px 0 0;">
            <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 28px;background-color:#0E56F5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(ctaLabel)}</a>
          </td></tr>
        </table>`
      : "";

  const fallbackHtml = ctaUrl
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr><td style="padding:16px 0 0;">
          <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">If the button doesn&rsquo;t work, copy this link:</p>
          <div style="background-color:#f8fafc;padding:10px 12px;border-radius:6px;">
            <p style="margin:0;font-size:11px;color:#475569;word-break:break-all;font-family:'SF Mono',Monaco,'Courier New',monospace;">${escapeHtml(ctaUrl)}</p>
          </div>
        </td></tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(headline)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">

        <!-- Logo + Wordmark -->
        <tr><td align="center" style="padding:32px 40px 20px;">
          ${LOGO_LETTERMARK}
          <p style="margin:12px 0 0;font-size:20px;font-weight:600;letter-spacing:-0.02em;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
            <span style="color:#0E56F5;">All Agent </span><span style="color:#94A3B8;">Connect</span>
          </p>
          <div style="width:48px;height:2px;background-color:#0E56F5;margin:14px auto 0;border-radius:1px;"></div>
        </td></tr>

        <!-- Content -->
        <tr><td style="padding:8px 40px 32px;">
          <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(headline)}</h2>
          <div style="font-size:15px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
            ${body}
          </div>
          ${ctaHtml}
          ${fallbackHtml}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
          <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
            <a href="mailto:hello@allagentconnect.com" style="color:#94a3b8;text-decoration:none;">hello@allagentconnect.com</a>
          </p>
          <p style="margin:0;font-size:11px;color:#94a3b8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
            <a href="mailto:hello@allagentconnect.com?subject=Remove%20My%20Account&body=Please%20remove%20my%20account." style="color:#94a3b8;text-decoration:underline;">Remove my account</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

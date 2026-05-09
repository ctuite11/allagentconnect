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
  /** Optional tracking + unsubscribe footer (marketing emails only) */
  tracking?: {
    pixelUrl?: string;
    /** Wrapped redirector URL — replaces ctaUrl when provided */
    wrappedCtaUrl?: string;
    unsubscribeUrl?: string;
    recipientEmail?: string;
    categoryLabel?: string;
  };
}

export function buildAacEmail(opts: AacEmailOptions): string {
  const { headline, body, ctaLabel, preheader, tracking } = opts;
  const ctaUrl = tracking?.wrappedCtaUrl || opts.ctaUrl;

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>`
    : "";

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr><td align="center" style="padding:28px 0 0;">
            <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 28px;background-color:#50c878;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(ctaLabel)}</a>
          </td></tr>
        </table>`
      : "";

  const fallbackHtml = ctaUrl
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr><td style="padding:16px 0 0;">
          <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">If the button doesn&rsquo;t work, copy this link:</p>
          <div style="background-color:#ffffff;border:1px solid #e5e7eb;padding:10px 12px;border-radius:6px;">
            <p style="margin:0;font-size:11px;color:#475569;word-break:break-all;font-family:'SF Mono',Monaco,'Courier New',monospace;">${escapeHtml(ctaUrl)}</p>
          </div>
        </td></tr>
      </table>`
    : "";

  const pixelHtml = tracking?.pixelUrl
    ? `<img src="${tracking.pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;outline:none;" />`
    : "";

  const unsubHtml = tracking?.unsubscribeUrl
    ? `<p style="margin:10px 0 0;font-size:11px;color:rgba(255,255,255,0.45);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
         ${tracking.recipientEmail ? `Sent to <span style="color:rgba(255,255,255,0.6);">${escapeHtml(tracking.recipientEmail)}</span>. ` : ""}
         <a href="${tracking.unsubscribeUrl}" style="color:rgba(255,255,255,0.6);text-decoration:underline;">Unsubscribe${tracking.categoryLabel ? ` from ${escapeHtml(tracking.categoryLabel)}` : ""}</a>
       </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(headline)}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">

        <!-- Dark navy branded header -->
        <tr><td align="center" style="background-color:#111317;border-radius:12px 12px 0 0;padding:32px 40px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0"><tr><td align="center">
            <!--[if mso]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" style="width:40px;height:40px;" fill="false" stroke="false"><v:textbox inset="0,0,0,0" style="mso-fit-shape-to-text:false;"><center style="font-size:16px;font-weight:700;color:#50c878;font-family:Arial,sans-serif;">✦</center></v:textbox></v:rect><![endif]-->
            <!--[if !mso]><!-->
            <img src="https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/brand-assets/aac-monogram-green.svg" width="40" height="40" alt="All Agent Connect" style="display:block;border:0;outline:none;text-decoration:none;" />
            <!--<![endif]-->
          </td></tr></table>
          <p style="margin:12px 0 0;font-size:18px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
          <div style="width:48px;height:2px;background-color:#50c878;margin:16px auto 0;border-radius:1px;"></div>
          <div style="height:24px;"></div>
        </td></tr>

        <!-- White content body -->
        <tr><td style="background-color:#ffffff;border:1px solid #d1d5db;border-top:none;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <!-- Content -->
            <tr><td style="padding:28px 40px 32px;">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(headline)}</h2>
              <div style="font-size:15px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
                ${body}
              </div>
              ${ctaHtml}
              ${fallbackHtml}
            </td></tr>
          </table>
        </td></tr>

        <!-- Dark footer -->
        <tr><td align="center" style="background-color:#111317;border-top:2px solid #50c878;border-radius:0 0 12px 12px;padding:24px 40px 20px;text-align:center;">
          <img src="https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/brand-assets/aac-monogram-green.svg" width="24" height="24" alt="" style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;" />
          <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.6);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
          <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.45);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
            <a href="mailto:hello@allagentconnect.com" style="color:rgba(255,255,255,0.45);text-decoration:none;">hello@allagentconnect.com</a>
          </p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
            <a href="mailto:hello@allagentconnect.com?subject=Remove%20My%20Account&body=Please%20remove%20my%20account." style="color:rgba(255,255,255,0.35);text-decoration:underline;">Remove my account</a>
          </p>
          ${unsubHtml}
        </td></tr>

      </table>
    </td></tr>
  </table>
  ${pixelHtml}
</body>
</html>`;
}

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
  /** When true, omit the shell <h2> and default content padding for edge-to-edge layouts. */
  hideHeadline?: boolean;
  /** Browser tab title; defaults to `headline` when omitted. */
  documentTitle?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Hidden preheader text shown in inbox preview */
  preheader?: string;
  /**
   * Optional HTML placed directly below the headline.
   * Used by Communications Center broadcast/digest emails only.
   */
  noticeBelowHeadline?: string;
  /**
   * Optional smaller note above the dark brand footer.
   * Used by Communications Center broadcast/digest emails only.
   */
  contentFooterNote?: string;
  /** Optional tracking (marketing emails only) */
  tracking?: {
    pixelUrl?: string;
    /** Wrapped redirector URL — replaces ctaUrl when provided */
    wrappedCtaUrl?: string;
    recipientEmail?: string;
    categoryLabel?: string;
  };
  /**
   * @deprecated No-op. The old "Remove my account" footer link has been
   * removed from every template; opt-out links are injected at send time and
   * only for subscription-style mail. Kept so existing callers keep compiling.
   */
  hideRemoveAccountLink?: boolean;
}

export function buildAacEmail(opts: AacEmailOptions): string {
  const {
    headline,
    body,
    ctaLabel,
    preheader,
    tracking,
    hideHeadline,
    noticeBelowHeadline,
    contentFooterNote,
  } = opts;
  const documentTitle = opts.documentTitle ?? headline;
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

  // Raw URL fallback intentionally removed (Jun 2026): displaying the full
  // destination URL — especially long ones with tokens — looks phishing-like
  // and was flagged as a likely contributor to Gmail spam classification.
  // The CTA button below is the only link rendered to recipients.
  const fallbackHtml = "";

  const pixelHtml = tracking?.pixelUrl
    ? `<img src="${tracking.pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;outline:none;" />`
    : "";

  const contentPadding = hideHeadline ? "0" : "28px 40px 32px";
  const headlineHtml = hideHeadline
    ? ""
    : `<h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(headline)}</h2>`;
  const bodyWrapperOpen = hideHeadline
    ? `<div>`
    : `<div style="font-size:15px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">`;


  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(documentTitle)}</title>
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
            <img src="https://allagentconnect.com/email/aac-monogram-green-128.png" width="40" height="40" alt="All Agent Connect" style="display:block;border:0;outline:none;text-decoration:none;" />
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
            <tr><td style="padding:${contentPadding};">
              ${headlineHtml}
              ${noticeBelowHeadline || ""}
              ${bodyWrapperOpen}
                ${body}
              </div>
              ${ctaHtml}
              ${contentFooterNote || ""}
              ${fallbackHtml}
            </td></tr>
          </table>
        </td></tr>

        <!-- Dark footer -->
        <tr><td align="center" style="background-color:#111317;border-top:2px solid #50c878;border-radius:0 0 12px 12px;padding:24px 40px 20px;text-align:center;">
          <img src="https://allagentconnect.com/email/aac-monogram-green-128.png" width="24" height="24" alt="All Agent Connect" style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;" />
          <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.6);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
          <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.45);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
            <a href="mailto:chris@allagentconnect.com" style="color:rgba(255,255,255,0.45);text-decoration:none;">chris@allagentconnect.com</a>
          </p>
          <!--AAC_FOOTER_UNSUB_ANCHOR-->
        </td></tr>

      </table>
    </td></tr>
  </table>
  ${pixelHtml}
</body>
</html>`;
}

const BUYER_PORTAL_BENEFITS = [
  "View curated listings",
  "Save favorite homes",
  "Receive new listings that match your search",
  "Private communication with your agent",
] as const;

interface BuyerPortalEmailOptions {
  headline: string;
  /** Plain-text body paragraph (escaped and wrapped in a single <p>) */
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  preheader?: string;
  /** When false, omit the standard buyer benefit bullets */
  showBenefits?: boolean;
}

/** Buyer Portal emails — white layout with green (#16A34A) accents, matching invite signup. */
export function buildBuyerPortalEmail(opts: BuyerPortalEmailOptions): string {
  const { headline, body, ctaLabel, ctaUrl, preheader, showBenefits = true } = opts;

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>`
    : "";

  const benefitsHtml = showBenefits
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0 0;">
        ${BUYER_PORTAL_BENEFITS.map(
          (label) => `<tr><td style="padding:0 0 10px;">
            <table role="presentation" cellspacing="0" cellpadding="0"><tr>
              <td valign="top" style="padding:0 10px 0 0;font-size:15px;line-height:1.4;color:#16A34A;">&#8226;</td>
              <td style="font-size:14px;line-height:1.5;color:#3f3f46;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(label)}</td>
            </tr></table>
          </td></tr>`,
        ).join("")}
      </table>`
    : "";

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr><td align="center" style="padding:28px 0 0;">
            <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 28px;background-color:#16A34A;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(ctaLabel)}</a>
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
<body style="margin:0;padding:0;background-color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">

        <!-- Buyer Portal header -->
        <tr><td style="padding:28px 40px 24px;border-bottom:1px solid #f4f4f5;background-color:#ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0"><tr>
            <td valign="middle" style="padding:0 12px 0 0;">
              <img src="https://allagentconnect.com/email/aac-monogram-green-128.png" width="36" height="36" alt="All Agent Connect" style="display:block;border:0;outline:none;text-decoration:none;" />
            </td>
            <td valign="middle">
              <p style="margin:0;font-size:15px;font-weight:700;letter-spacing:-0.01em;color:#18181b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
              <p style="margin:2px 0 0;font-size:11px;font-weight:500;letter-spacing:0.02em;color:#71717a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Buyer Portal</p>
            </td>
          </tr></table>
        </td></tr>

        <!-- Content -->
        <tr><td style="padding:28px 40px 32px;background-color:#ffffff;">
          <h1 style="margin:0 0 16px;font-size:28px;font-weight:600;letter-spacing:-0.02em;line-height:1.15;color:#18181b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(headline)}</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#71717a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(body)}</p>
          ${benefitsHtml}
          ${ctaHtml}
        </td></tr>

        <!-- Light footer -->
        <tr><td align="center" style="padding:20px 40px 24px;border-top:1px solid #f4f4f5;background-color:#fafafa;">
          <img src="https://allagentconnect.com/email/aac-monogram-green-128.png" width="20" height="20" alt="" style="display:block;margin:0 auto 8px;border:0;outline:none;text-decoration:none;" />
          <p style="margin:0;font-size:12px;color:#a1a1aa;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect &middot; Buyer Portal</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

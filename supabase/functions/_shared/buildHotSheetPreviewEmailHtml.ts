/* ------------------------------------------------------------------ */
/*  One-time Hot Sheet preview — blurred document + frosted overlay     */
/* ------------------------------------------------------------------ */

import { buildAacEmail } from "./aacEmailTemplate.ts";

export const HOT_SHEET_PREVIEW_BLAST_SUBJECT =
  "You're missing important opportunities";

export const HOT_SHEET_PREVIEW_CTA_URL = "https://allagentconnect.com/agent-dashboard";

const BLURRED_HOTSHEET_IMAGE_URL =
  "https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/brand-assets/email%2Fblurred-hotsheet-v1.jpg";

const AAC_GREEN = "#50C878";
const CHARCOAL = "#111317";

const FONT_SANS =
  "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const HERO_HEADLINE = "You're missing important opportunities.";

const BODY_INTRO =
  "Your All Agent Connect Profile and Communications Center preferences haven't been completed.";

const BODY_UNLOCK =
  "Complete your Profile to become eligible for buyer and seller leads, and set your Communications Center preferences so AAC can deliver matching listings, buyer demand, referrals, broker opens, and network activity tailored to your markets.";

const CTA_LABEL = "Complete My Profile & Preferences";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Bulletproof "blurred Hot Sheet + centered overlay" email body.
 *
 * Strategy:
 *   1. A pre-rendered, pre-blurred Hot Sheet screenshot is hosted in storage.
 *   2. We paint that image as the <td> background using both `background=""`
 *      (Outlook / Yahoo / older clients) and CSS `background-image` (Gmail,
 *      Apple Mail, iOS). VML fills the same cell for Outlook desktop.
 *   3. A centered dark overlay card sits inside the same cell — email clients
 *      composite it directly on top of the background image.
 *
 * No CSS filters, no negative margins, no absolute positioning. This is the
 * only pattern that renders identically across Gmail, Outlook, Apple Mail.
 */
function renderBlurredDocumentSection(ctaUrl: string): string {
  const safeCta = escapeHtml(ctaUrl);
  const bg = BLURRED_HOTSHEET_IMAGE_URL;
  const BG_HEIGHT = 820;

  return `
    <!--[if mso]>
    <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:${BG_HEIGHT}px;">
      <v:fill type="frame" src="${bg}" color="#111317" />
      <v:textbox inset="0,0,0,0"><![endif]-->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
      <tr>
        <td
          align="center"
          valign="middle"
          height="${BG_HEIGHT}"
          background="${bg}"
          bgcolor="#111317"
          style="height:${BG_HEIGHT}px;background-color:#111317;background-image:url('${bg}');background-repeat:no-repeat;background-position:center top;background-size:cover;padding:48px 28px;"
        >
          <!-- Centered premium dark/frosted overlay card -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:440px;width:100%;border-collapse:separate;">
            <tr>
              <td align="center" style="padding:44px 36px 40px;background-color:rgba(17,19,23,0.86);border:1px solid rgba(255,255,255,0.16);">
                <!--[if mso]>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="#111317" style="background:#111317;"><tr><td style="padding:0;">
                <![endif]-->
                <h1 style="margin:0 0 24px;font-family:${FONT_SANS};font-size:24px;font-weight:600;line-height:1.25;letter-spacing:-0.02em;color:#ffffff;">
                  ${escapeHtml(HERO_HEADLINE)}
                </h1>
                <p style="margin:0 0 20px;font-family:${FONT_SANS};font-size:14px;line-height:1.7;color:rgba(255,255,255,0.88);text-align:left;">
                  ${escapeHtml(BODY_INTRO)}
                </p>
                <p style="margin:0 0 32px;font-family:${FONT_SANS};font-size:14px;line-height:1.7;color:rgba(255,255,255,0.82);text-align:left;">
                  ${escapeHtml(BODY_UNLOCK)}
                </p>
                <a href="${safeCta}" target="_blank" style="display:inline-block;padding:16px 32px;background-color:${AAC_GREEN};color:#ffffff;text-decoration:none;font-family:${FONT_SANS};font-size:15px;font-weight:600;letter-spacing:0.01em;border-radius:2px;">
                  ${escapeHtml(CTA_LABEL)}
                </a>
                <!--[if mso]></td></tr></table><![endif]-->
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <!--[if mso]></v:textbox></v:rect><![endif]-->`;
}

export interface HotSheetPreviewEmailOptions {
  userName: string;
  listing?: Record<string, unknown>;
  baseUrl?: string;
  ctaUrl?: string;
}

/** Full AAC-shell HTML for the one-time Hot Sheet preview activation email. */
export function buildHotSheetPreviewEmailHtml(opts: HotSheetPreviewEmailOptions): string {
  const ctaUrl = opts.ctaUrl || HOT_SHEET_PREVIEW_CTA_URL;

  return buildAacEmail({
    headline: HERO_HEADLINE,
    hideHeadline: true,
    documentTitle: HOT_SHEET_PREVIEW_BLAST_SUBJECT,
    preheader: "You're missing important opportunities — complete your Profile and Communications Center preferences.",
    body: `
      <!-- aac-hotsheet-preview:document-v3-bulletproof -->
      ${renderBlurredDocumentSection(ctaUrl)}`,
  });
}

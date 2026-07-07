/* ------------------------------------------------------------------ */
/*  One-time Hot Sheet preview — fictional luxury listing + unlock copy   */
/* ------------------------------------------------------------------ */

import { buildAacEmail } from "./aacEmailTemplate.ts";
import { LISTING_OG_PLACEHOLDER } from "./listingPhotoUrl.ts";

export const HOT_SHEET_PREVIEW_BLAST_SUBJECT =
  "You're missing important opportunities";

export const HOT_SHEET_PREVIEW_CTA_URL = "https://allagentconnect.com/agent-dashboard";

/** Verify deployed bundle — not a real listing. */
export const HOT_SHEET_PREVIEW_BUILD_MARKER = "aac-hotsheet-preview:listing-v3";

const AAC_GREEN = "#50C878";
const CHARCOAL = "#111317";
const BORDER = "#e8e8e8";
const TEXT_PRIMARY = "#111317";
const TEXT_SECONDARY = "#64748b";

const FONT_SANS =
  "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Demo-only luxury preview — never a real active listing. */
const DEMO_PHOTO_URL = LISTING_OG_PLACEHOLDER;

const HEADLINE = "You're missing important opportunities.";

const BODY_COPY =
  "Your Profile and Communications Center preferences are incomplete. " +
  "Complete them to unlock buyer and seller leads, matching listings, referrals, broker opens, and network activity tailored to your markets.";

const CTA_LABEL = "Complete My Profile & Preferences";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Hot Sheet–style listing card with fictional, clearly demo content. */
function renderFictionalListingCard(): string {
  const photo = escapeHtml(DEMO_PHOTO_URL);

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid ${BORDER};border-radius:4px;overflow:hidden;background:#ffffff;">
      <tr>
        <td style="padding:10px 16px;background:#fafafa;border-bottom:1px solid ${BORDER};font-family:${FONT_SANS};">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${TEXT_SECONDARY};">
                Example Hot Sheet Preview
              </td>
              <td align="right">
                <span style="display:inline-block;padding:4px 10px;background:rgba(80,200,120,0.12);color:${AAC_GREEN};font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;border-radius:999px;">
                  Private Preview
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0;line-height:0;font-size:0;">
          <img src="${photo}" alt="" width="520" height="220" style="display:block;width:100%;height:220px;object-fit:cover;border:0;outline:none;" />
        </td>
      </tr>
      <tr>
        <td style="padding:20px 18px 22px;font-family:${FONT_SANS};">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${TEXT_SECONDARY};">
            Luxury Single Family
          </p>
          <p style="margin:0 0 10px;font-size:24px;font-weight:700;color:${TEXT_PRIMARY};line-height:1.1;filter:blur(5px);-webkit-filter:blur(5px);user-select:none;">
            $4,850,000
          </p>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.45;color:#404040;filter:blur(4px);-webkit-filter:blur(4px);user-select:none;">
            Private Estate &middot; Beacon Hill Area, Boston, MA
          </p>
          <p style="margin:0;font-size:13px;color:${TEXT_SECONDARY};letter-spacing:0.02em;">
            5 bd &nbsp;&middot;&nbsp; 5.5 ba &nbsp;&middot;&nbsp; 6,200 sqft
          </p>
          <p style="margin:14px 0 0;font-size:11px;line-height:1.5;color:#94a3b8;font-style:italic;">
            Illustrative preview only — not an available property.
          </p>
        </td>
      </tr>
    </table>`;
}

function renderMessageAndCta(ctaUrl: string): string {
  const safeCta = escapeHtml(ctaUrl);

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:36px 0 0;">
      <tr>
        <td style="padding:0;font-family:${FONT_SANS};">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;line-height:1.3;letter-spacing:-0.02em;color:${TEXT_PRIMARY};">
            ${escapeHtml(HEADLINE)}
          </h1>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:${TEXT_SECONDARY};">
            ${escapeHtml(BODY_COPY)}
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
            <tr>
              <td align="center">
                <a href="${safeCta}" target="_blank" style="display:inline-block;padding:15px 32px;background-color:${AAC_GREEN};color:#ffffff;text-decoration:none;font-family:${FONT_SANS};font-size:15px;font-weight:600;letter-spacing:0.01em;border-radius:4px;">
                  ${escapeHtml(CTA_LABEL)}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

export interface HotSheetPreviewEmailOptions {
  userName: string;
  /** Ignored — preview uses fictional demo listing content only. */
  listing: Record<string, unknown>;
  baseUrl?: string;
  ctaUrl?: string;
}

/** Full AAC-shell HTML for the one-time Hot Sheet preview activation email. */
export function buildHotSheetPreviewEmailHtml(opts: HotSheetPreviewEmailOptions): string {
  const ctaUrl = opts.ctaUrl || HOT_SHEET_PREVIEW_CTA_URL;

  return buildAacEmail({
    headline: HEADLINE,
    hideHeadline: true,
    documentTitle: HOT_SHEET_PREVIEW_BLAST_SUBJECT,
    preheader: "Complete your Profile and Communications Center preferences to unlock personalized Hot Sheets.",
    body: `
      <!-- ${HOT_SHEET_PREVIEW_BUILD_MARKER} -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="padding:32px 40px 40px;font-family:${FONT_SANS};">
            ${renderFictionalListingCard()}
            ${renderMessageAndCta(ctaUrl)}
          </td>
        </tr>
      </table>`,
  });
}

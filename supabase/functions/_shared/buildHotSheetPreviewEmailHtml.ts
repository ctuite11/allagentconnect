/* ------------------------------------------------------------------ */
/*  One-time Hot Sheet preview — blurred document + frosted overlay     */
/* ------------------------------------------------------------------ */

import { buildAacEmail } from "./aacEmailTemplate.ts";
import {
  LISTING_OG_PLACEHOLDER,
  resolveEmailPhotoUrl,
  toOgImageUrl,
} from "./listingPhotoUrl.ts";

export const HOT_SHEET_PREVIEW_BLAST_SUBJECT =
  "You're missing important opportunities";

export const HOT_SHEET_PREVIEW_CTA_URL = "https://allagentconnect.com/agent-dashboard";

const AAC_GREEN = "#50C878";
const CHARCOAL = "#111317";
const BORDER = "#e8e8e8";

const FONT_SANS =
  "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const HERO_HEADLINE = "You're missing important opportunities.";

const BODY_INTRO =
  "Your personalized Hot Sheets are locked because your Profile and Communications Center preferences haven't been completed.";

const BODY_UNLOCK =
  "Complete your setup to unlock buyer and seller leads, matching listings, referrals, broker opens, and network activity tailored to your markets.";

const PROFILE_FRAMING =
  "Your Profile helps other agents and buyers understand who you are and where you work.";

const COMMS_FRAMING =
  "Your Communications Center preferences tell AAC which markets, listings, buyers, and referrals to send you.";

const CTA_LABEL = "Complete My Profile & Preferences";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizePhotosArray(photos: unknown): unknown[] {
  if (photos == null) return [];
  if (Array.isArray(photos)) return photos;
  if (typeof photos === "string") {
    const trimmed = photos.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        return Array.isArray(parsed) ? parsed : [trimmed];
      } catch {
        return [trimmed];
      }
    }
    return [trimmed];
  }
  return [];
}

function resolveListingPhotoUrl(listing: Record<string, unknown>): string {
  const photos = normalizePhotosArray(listing.photos);
  const pickIndex = photos.length >= 2 ? 1 : 0;
  const picked = photos.length > 0 ? [photos[pickIndex]] : listing.photos;
  const direct = resolveEmailPhotoUrl(picked);
  if (direct) {
    if (direct.includes("/storage/v1/object/public/")) {
      return toOgImageUrl(direct);
    }
    return direct;
  }
  return LISTING_OG_PLACEHOLDER;
}

/** Obfuscated placeholder bar — unreadable detail. */
function redactBar(width = "72%"): string {
  return `<span style="display:inline-block;width:${width};height:10px;background:#d4d4d4;border-radius:1px;vertical-align:middle;">&nbsp;</span>`;
}

function sectionLabel(title: string): string {
  return `
    <p style="margin:0 0 14px;font-family:${FONT_SANS};font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${CHARCOAL};">
      ${escapeHtml(title)}
    </p>`;
}

/**
 * Mock Hot Sheet document — structurally real, details intentionally unreadable.
 * Rendered sharp then blurred as a single layer behind the frosted overlay.
 */
function renderHotSheetDocumentMock(photoUrl: string): string {
  const safePhoto = escapeHtml(photoUrl);

  const listingBlock = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid ${BORDER};background:#ffffff;">
      <tr>
        <td style="padding:0;line-height:0;font-size:0;">
          <img src="${safePhoto}" alt="" width="520" height="160" style="display:block;width:100%;height:160px;object-fit:cover;border:0;outline:none;" />
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px 18px;font-family:${FONT_SANS};">
          <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:${CHARCOAL};line-height:1;">${redactBar("38%")}</p>
          <p style="margin:0 0 6px;font-size:13px;color:#525252;line-height:1.4;">${redactBar("85%")}</p>
          <p style="margin:0 0 14px;font-size:12px;color:#737373;">${redactBar("55%")}</p>
          <p style="margin:0;font-size:12px;color:#737373;letter-spacing:0.04em;">${redactBar("42%")}</p>
        </td>
      </tr>
    </table>`;

  const demandRow = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 10px;border:1px solid ${BORDER};background:#fafafa;">
      <tr>
        <td style="padding:14px 16px;font-family:${FONT_SANS};">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${CHARCOAL};">${redactBar("48%")}</p>
          <p style="margin:0;font-size:11px;color:#737373;">${redactBar("64%")}</p>
        </td>
      </tr>
    </table>`;

  const networkRow = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 10px;border:1px solid ${BORDER};background:#ffffff;">
      <tr>
        <td style="padding:14px 16px;font-family:${FONT_SANS};">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${CHARCOAL};">${redactBar("52%")}</p>
          <p style="margin:0;font-size:11px;color:#737373;">${redactBar("70%")}</p>
        </td>
      </tr>
    </table>`;

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;">
      <tr>
        <td style="padding:28px 24px 32px;font-family:${FONT_SANS};">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
            <tr>
              <td style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${CHARCOAL};">
                Personalized Hot Sheet
              </td>
              <td align="right" style="font-size:11px;color:#737373;letter-spacing:0.04em;">
                ${redactBar("28%")}
              </td>
            </tr>
          </table>

          ${sectionLabel("Matching Listings")}
          ${listingBlock}

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0;">
            <tr><td>
              ${sectionLabel("Buyer Demand")}
              ${demandRow}
              ${demandRow}
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0;">
            <tr><td>
              ${sectionLabel("Network Activity")}
              ${networkRow}
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0;">
            <tr><td>
              ${sectionLabel("Referrals & Broker Opens")}
              ${networkRow}
            </td></tr>
          </table>
        </td>
      </tr>
    </table>`;
}

/**
 * Full-bleed blurred Hot Sheet document with frosted access overlay.
 * Header/footer remain in the AAC shell; this is the entire body.
 */
function renderBlurredDocumentSection(photoUrl: string, ctaUrl: string): string {
  const safeCta = escapeHtml(ctaUrl);
  const documentHtml = renderHotSheetDocumentMock(photoUrl);

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 -40px;width:calc(100% + 80px);max-width:600px;border-collapse:collapse;">
      <tr>
        <td style="padding:0;position:relative;background:${CHARCOAL};overflow:hidden;">
          <!-- Blurred Hot Sheet document layer -->
          <div style="max-height:820px;overflow:hidden;line-height:0;font-size:0;background:#f5f5f5;">
            <div style="filter:blur(7px);-webkit-filter:blur(7px);opacity:0.92;transform:scale(1.02);">
              ${documentHtml}
            </div>
          </div>
          <!-- Dim layer — details unreadable, document shape visible -->
          <div style="height:820px;margin-top:-820px;background:rgba(17,19,23,0.58);line-height:0;font-size:0;">&nbsp;</div>
          <!-- Frosted overlay -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:-820px;min-height:820px;">
            <tr>
              <td align="center" valign="middle" style="padding:40px 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:440px;width:100%;border-collapse:separate;">
                  <tr>
                    <td align="center" style="padding:44px 36px 40px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.24);">
                      <p style="margin:0 0 20px;font-family:${FONT_SANS};font-size:10px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:${AAC_GREEN};">
                        Hot Sheet Preview
                      </p>
                      <h1 style="margin:0 0 24px;font-family:${FONT_SANS};font-size:24px;font-weight:600;line-height:1.25;letter-spacing:-0.02em;color:#ffffff;">
                        ${escapeHtml(HERO_HEADLINE)}
                      </h1>
                      <p style="margin:0 0 16px;font-family:${FONT_SANS};font-size:14px;line-height:1.7;color:rgba(255,255,255,0.88);text-align:left;">
                        ${escapeHtml(BODY_INTRO)}
                      </p>
                      <p style="margin:0 0 20px;font-family:${FONT_SANS};font-size:14px;line-height:1.7;color:rgba(255,255,255,0.82);text-align:left;">
                        ${escapeHtml(BODY_UNLOCK)}
                      </p>
                      <p style="margin:0 0 10px;font-family:${FONT_SANS};font-size:13px;line-height:1.65;color:rgba(255,255,255,0.72);text-align:left;">
                        ${escapeHtml(PROFILE_FRAMING)}
                      </p>
                      <p style="margin:0 0 32px;font-family:${FONT_SANS};font-size:13px;line-height:1.65;color:rgba(255,255,255,0.72);text-align:left;">
                        ${escapeHtml(COMMS_FRAMING)}
                      </p>
                      <a href="${safeCta}" target="_blank" style="display:inline-block;padding:16px 32px;background-color:${AAC_GREEN};color:#ffffff;text-decoration:none;font-family:${FONT_SANS};font-size:15px;font-weight:600;letter-spacing:0.01em;border-radius:2px;">
                        ${escapeHtml(CTA_LABEL)}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

export interface HotSheetPreviewEmailOptions {
  userName: string;
  listing: Record<string, unknown>;
  baseUrl?: string;
  ctaUrl?: string;
}

/** Full AAC-shell HTML for the one-time Hot Sheet preview activation email. */
export function buildHotSheetPreviewEmailHtml(opts: HotSheetPreviewEmailOptions): string {
  const ctaUrl = opts.ctaUrl || HOT_SHEET_PREVIEW_CTA_URL;
  const photoUrl = resolveListingPhotoUrl(opts.listing);

  return buildAacEmail({
    headline: HERO_HEADLINE,
    hideHeadline: true,
    documentTitle: HOT_SHEET_PREVIEW_BLAST_SUBJECT,
    preheader: "Complete your Profile and Communications Center preferences to unlock personalized Hot Sheets.",
    body: `
      <!-- aac-hotsheet-preview:document-v2 -->
      ${renderBlurredDocumentSection(photoUrl, ctaUrl)}`,
  });
}

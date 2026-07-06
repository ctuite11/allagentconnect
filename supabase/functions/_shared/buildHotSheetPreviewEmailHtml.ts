/* ------------------------------------------------------------------ */
/*  One-time Hot Sheet preview — confidential member document layout    */
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
const TEXT_PRIMARY = "#111317";
const TEXT_SECONDARY = "#64748b";
const BORDER = "#e8e8e8";

const FONT_SANS =
  "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const FONT_SERIF = "Georgia,'Times New Roman',Times,serif";

const HERO_HEADLINE = "You're missing important opportunities.";

const BODY_COPY =
  "Your personalized Hot Sheets are currently locked because your Profile and Communications Center preferences haven't been completed. " +
  "Complete them once and All Agent Connect will begin delivering personalized Hot Sheets tailored to your markets.";

const CTA_LABEL = "Activate My Hot Sheets";

const PREMIUM_CARDS = [
  {
    title: "Matching Listings",
    description: "Receive listings tailored to your buyers.",
  },
  {
    title: "Buyer Demand",
    description: "Know who is actively searching in your markets.",
  },
  {
    title: "Trusted Referrals",
    description: "Connect with verified AAC members across the network.",
  },
] as const;

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

/** Prefer a strong cover photo — second image when multiple exist. */
function resolveHeroPhotoUrl(listing: Record<string, unknown>): string {
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

/**
 * Full-width luxury listing hero — partially concealed, not obliterated.
 * Solid dark overlay (~68%) + centered frosted panel. No blur. No gradients.
 */
function renderHeroSection(photoUrl: string): string {
  const safeUrl = escapeHtml(photoUrl);

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 -40px;width:calc(100% + 80px);max-width:600px;border-collapse:collapse;">
      <tr>
        <td style="padding:0;height:480px;overflow:hidden;background:${CHARCOAL};vertical-align:middle;">
          <!-- Listing photography — sharp, recognizable, partially hidden by overlay -->
          <div style="height:480px;overflow:hidden;line-height:0;font-size:0;background:${CHARCOAL};">
            <img src="${safeUrl}" alt="" width="600" height="480" style="display:block;width:100%;max-width:600px;height:480px;object-fit:cover;border:0;outline:none;" />
          </div>
          <!-- Solid darken (~68%) — no gradient -->
          <div style="height:480px;margin-top:-480px;background:rgba(17,19,23,0.68);line-height:0;font-size:0;">&nbsp;</div>
          <!-- Frosted access panel -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:-480px;height:480px;">
            <tr>
              <td align="center" valign="middle" style="padding:32px 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:420px;width:100%;border-collapse:separate;">
                  <tr>
                    <td align="center" style="padding:40px 36px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.22);border-radius:2px;">
                      <p style="margin:0 0 10px;font-family:${FONT_SANS};font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${AAC_GREEN};">
                        Hot Sheet Preview
                      </p>
                      <p style="margin:0 0 24px;font-family:${FONT_SANS};font-size:10px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.55);">
                        Access Restricted
                      </p>
                      <h1 style="margin:0;font-family:${FONT_SERIF};font-size:26px;font-weight:400;line-height:1.25;letter-spacing:-0.01em;color:#ffffff;">
                        ${escapeHtml(HERO_HEADLINE)}
                      </h1>
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

function renderBodyParagraph(): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:48px 0 0;">
      <tr>
        <td style="padding:0 4px;font-family:${FONT_SANS};font-size:15px;line-height:1.75;color:${TEXT_SECONDARY};">
          ${escapeHtml(BODY_COPY)}
        </td>
      </tr>
    </table>`;
}

/** Three stacked premium cards — typography only, no icons. */
function renderPremiumCards(): string {
  const cards = PREMIUM_CARDS.map(
    ({ title, description }) => `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px;border-collapse:separate;">
        <tr>
          <td style="padding:32px 36px;border:1px solid ${BORDER};background:#ffffff;">
            <p style="margin:0 0 10px;font-family:${FONT_SANS};font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${TEXT_PRIMARY};">
              ${escapeHtml(title)}
            </p>
            <p style="margin:0;font-family:${FONT_SANS};font-size:15px;line-height:1.6;color:${TEXT_SECONDARY};">
              ${escapeHtml(description)}
            </p>
          </td>
        </tr>
      </table>`,
  ).join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:48px 0 0;">
      <tr>
        <td style="padding:0;">
          ${cards}
        </td>
      </tr>
    </table>`;
}

function renderCtaBlock(ctaUrl: string): string {
  const safeUrl = escapeHtml(ctaUrl);
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:48px 0 8px;">
      <tr>
        <td align="center" style="padding:0;">
          <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:17px 40px;background-color:${AAC_GREEN};color:#ffffff;text-decoration:none;font-family:${FONT_SANS};font-size:15px;font-weight:600;letter-spacing:0.01em;border-radius:2px;">
            ${escapeHtml(CTA_LABEL)}
          </a>
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
  const heroPhoto = resolveHeroPhotoUrl(opts.listing);

  return buildAacEmail({
    headline: HERO_HEADLINE,
    hideHeadline: true,
    documentTitle: HOT_SHEET_PREVIEW_BLAST_SUBJECT,
    preheader: "Member-only Hot Sheet preview. Complete your Profile and Communications Center preferences to unlock access.",
    body: `
      <!-- aac-hotsheet-preview:confidential-v1 -->
      ${renderHeroSection(heroPhoto)}
      ${renderBodyParagraph()}
      ${renderPremiumCards()}
      ${renderCtaBlock(ctaUrl)}`,
  });
}

/* ------------------------------------------------------------------ */
/*  One-time Hot Sheet preview blast — simple transactional AAC email    */
/* ------------------------------------------------------------------ */

import { buildAacEmail } from "./aacEmailTemplate.ts";

export const HOT_SHEET_PREVIEW_BLAST_SUBJECT =
  "You're missing important opportunities";

export const HOT_SHEET_PREVIEW_CTA_URL = "https://allagentconnect.com/agent-dashboard";

/** Verify deployed bundle — simple transactional layout only. */
export const HOT_SHEET_PREVIEW_BUILD_MARKER = "aac-hotsheet-preview:simple-v1";

const HEADLINE = "You're missing important opportunities.";

const BODY_HTML = `
  <p style="margin:0 0 16px;">Your Profile and Communications Center preferences are incomplete.</p>
  <p style="margin:0;">Complete them to become eligible for buyer and seller leads, matching listings, referrals, broker opens, and network activity tailored to your markets.</p>`;

const CTA_LABEL = "Complete My Profile & Preferences";

export interface HotSheetPreviewEmailOptions {
  userName: string;
  listing: Record<string, unknown>;
  baseUrl?: string;
  ctaUrl?: string;
}

/** Standard AAC-shell HTML — no listing image, cards, or custom layout. */
export function buildHotSheetPreviewEmailHtml(opts: HotSheetPreviewEmailOptions): string {
  const ctaUrl = opts.ctaUrl || HOT_SHEET_PREVIEW_CTA_URL;

  return buildAacEmail({
    headline: HEADLINE,
    documentTitle: HOT_SHEET_PREVIEW_BLAST_SUBJECT,
    preheader:
      "Complete your Profile and Communications Center preferences to unlock Hot Sheets.",
    body: `<!-- ${HOT_SHEET_PREVIEW_BUILD_MARKER} -->${BODY_HTML}`,
    ctaLabel: CTA_LABEL,
    ctaUrl,
  });
}

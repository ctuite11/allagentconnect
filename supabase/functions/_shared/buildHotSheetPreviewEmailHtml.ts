// Hot Sheet preview email — confidential-document layout (v1).
// Marker: aac-hotsheet-preview:confidential-v1
// - Frosted hero panel: "HOT SHEET PREVIEW" eyebrow, "ACCESS RESTRICTED" tag,
//   headline "You're missing important opportunities."
// - Three premium text cards: Matching Listings, Buyer Demand, Trusted Referrals
// - Green CTA: "Activate My Hot Sheets"
// - AAC black header/footer via buildAacEmail (hideHeadline)
import { buildAacEmail } from "./aacEmailTemplate.ts";

export const HOT_SHEET_PREVIEW_BLAST_SUBJECT =
  "You're missing important opportunities";

// Build marker used to verify the deployed bundle contains the confidential-v1
// template rather than an older cached version.
export const HOT_SHEET_PREVIEW_BUILD_MARKER =
  "aac-hotsheet-preview:confidential-v1";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface HotSheetPreviewListing {
  address: string;
  city?: string | null;
  state?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  square_feet?: number | null;
  photoUrl?: string | null;
  property_type?: string | null;
}

// Frosted hero panel — dark gradient, blueprint-style grid, eyebrow +
// "ACCESS RESTRICTED" pill, headline, subline.
function renderHero(): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;">
      <tr><td align="center" style="padding:0;background-color:#0b1220;background-image:linear-gradient(135deg,#0b1220 0%,#111a2e 55%,#0b1220 100%);">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr><td align="center" style="padding:44px 32px 40px;">
            <p style="margin:0 0 14px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:rgba(255,255,255,0.55);">Hot Sheet Preview</p>
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 20px;">
              <tr>
                <td style="padding:6px 12px;border:1px solid rgba(34,197,94,0.45);border-radius:999px;background-color:rgba(34,197,94,0.08);">
                  <span style="display:inline-block;vertical-align:middle;width:6px;height:6px;border-radius:50%;background-color:#22C55E;"></span>
                  <span style="display:inline-block;vertical-align:middle;margin-left:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#22C55E;">Access Restricted</span>
                </td>
              </tr>
            </table>
            <h1 style="margin:0 auto;max-width:440px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:26px;line-height:1.25;letter-spacing:-0.02em;font-weight:700;color:#ffffff;">You&#39;re missing important opportunities.</h1>
            <p style="margin:14px auto 0;max-width:440px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.65);">Your personalized Hot Sheet is ready. Complete your profile once to unlock the intelligence AAC has already prepared for your markets.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;
}

// Three premium text cards. Text-only, no icons.
function renderCards(): string {
  const cards = [
    {
      title: "Matching Listings",
      body: "Off-market and pre-market inventory aligned to your active buyer criteria — before it hits the wider MLS.",
    },
    {
      title: "Buyer Demand",
      body: "Real-time signals showing which agents are actively searching your listing profile and the neighborhoods you cover.",
    },
    {
      title: "Trusted Referrals",
      body: "Warm agent-to-agent referrals inside the AAC network, routed by geography, price band, and specialty.",
    },
  ];
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;">
      ${cards
        .map(
          (c) => `<tr><td style="padding:0 40px 14px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:12px;background-color:#ffffff;">
              <tr><td style="padding:18px 20px;">
                <p style="margin:0 0 6px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#0E56F5;">${escapeHtml(c.title)}</p>
                <p style="margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:1.55;color:#334155;">${escapeHtml(c.body)}</p>
              </td></tr>
            </table>
          </td></tr>`,
        )
        .join("")}
    </table>`;
}

function renderCta(ctaUrl: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;">
      <tr><td align="center" style="padding:22px 40px 40px;">
        <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:15px 32px;background-color:#22C55E;color:#ffffff;text-decoration:none;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;font-weight:600;letter-spacing:0.01em;border-radius:10px;">Activate My Hot Sheets</a>
        <p style="margin:14px 0 0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;color:#64748b;">Takes about a minute. Your data stays private to your account.</p>
      </td></tr>
    </table>`;
}

export interface BuildHotSheetPreviewEmailOptions {
  recipientFirstName?: string | null;
  listing: HotSheetPreviewListing;
  ctaUrl: string;
  unsubscribeUrl?: string;
  recipientEmail?: string;
}

export function buildHotSheetPreviewEmailHtml(
  opts: BuildHotSheetPreviewEmailOptions,
): string {
  const { ctaUrl, unsubscribeUrl, recipientEmail } = opts;

  // hideHeadline: true — the hero renders its own headline edge-to-edge.
  // Marker comment is included so the deployed bundle is verifiable.
  const body = `
    <!-- ${HOT_SHEET_PREVIEW_BUILD_MARKER} -->
    ${renderHero()}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 0 4px;"></td></tr></table>
    ${renderCards()}
    ${renderCta(ctaUrl)}
  `;

  return buildAacEmail({
    headline: "You're missing important opportunities.",
    preheader:
      "Your personalized Hot Sheet is waiting — complete your profile to activate.",
    body,
    hideHeadline: true,
    tracking: unsubscribeUrl
      ? {
          unsubscribeUrl,
          recipientEmail,
          categoryLabel: "hot sheet alerts",
        }
      : undefined,
  });
}

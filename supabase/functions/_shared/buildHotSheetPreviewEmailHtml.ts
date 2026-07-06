// Blurred Hot Sheet preview email body — reuses the unified AAC shell.
// Palette: AAC green (#22C55E), charcoal (#111827), neutral grays, white.
// No blue accents anywhere in this template.
import { buildAacEmail } from "./aacEmailTemplate.ts";

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

// "123 Main Street" -> "1•• • • • Street"
function maskAddress(street: string): string {
  const parts = (street || "").trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "• • • Street";
  const first = parts[0];
  const firstMasked = first.length > 1
    ? first[0] + "•".repeat(Math.max(1, first.length - 1))
    : first;
  const last = parts.length > 1 ? parts[parts.length - 1] : "Street";
  return `${firstMasked} • • • ${last}`;
}

function maskCity(city?: string | null, state?: string | null): string {
  const c = (city || "").trim();
  if (!c) return "•••";
  const head = c.slice(0, 1);
  const cityMasked = `${head}${"•".repeat(Math.max(3, c.length - 1))}`;
  return state ? `${cityMasked}, ${state}` : cityMasked;
}

function renderPreviewCard(listing: HotSheetPreviewListing): string {
  const streetMasked = maskAddress(listing.address || "");
  const cityMasked = maskCity(listing.city, listing.state);
  const priceMasked = "$•,•••,•••";
  const sqftMasked = "•,••• sqft";
  const beds = listing.bedrooms != null ? String(listing.bedrooms) : "•";
  const baths = listing.bathrooms != null ? String(listing.bathrooms) : "•";

  const photoUrl = listing.photoUrl || "";
  const photoBlock = photoUrl
    ? `<img src="${escapeHtml(photoUrl)}" width="600" alt="" style="display:block;width:100%;height:auto;max-height:320px;object-fit:cover;filter:blur(28px) saturate(0.85);transform:scale(1.2);opacity:0.7;border:0;outline:none;" />`
    : `<div style="background:linear-gradient(135deg,#1f2937 0%,#374151 100%);height:220px;"></div>`;

  // Frosted overlay label — neutral (charcoal on frosted white), green pill.
  const overlay = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:-64px 0 0;">
      <tr><td align="center" style="padding:0 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" style="max-width:340px;width:100%;background-color:rgba(255,255,255,0.92);border:1px solid rgba(17,24,39,0.08);border-radius:999px;">
          <tr><td align="center" style="padding:10px 22px;">
            <span style="display:inline-block;vertical-align:middle;width:8px;height:8px;background-color:#22C55E;border-radius:999px;margin-right:8px;"></span>
            <span style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#111827;">Hot Sheet Preview</span>
          </td></tr>
        </table>
      </td></tr>
    </table>`;

  const facts = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 0;">
      <tr><td style="padding:18px 22px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:15px;font-weight:600;color:#111827;letter-spacing:-0.01em;">${escapeHtml(streetMasked)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${escapeHtml(cityMasked)}</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:14px 0 0;">
          <tr>
            <td style="font-size:18px;font-weight:700;color:#111827;letter-spacing:-0.01em;">${escapeHtml(priceMasked)}</td>
            <td align="right" style="font-size:13px;color:#374151;">
              <span style="color:#111827;font-weight:600;">${escapeHtml(beds)}</span> bd
              <span style="color:#d1d5db;padding:0 6px;">·</span>
              <span style="color:#111827;font-weight:600;">${escapeHtml(baths)}</span> ba
              <span style="color:#d1d5db;padding:0 6px;">·</span>
              <span style="color:#6b7280;">${escapeHtml(sqftMasked)}</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>`;

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 0;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:0;background-color:#111827;line-height:0;">
        ${photoBlock}
      </td></tr>
      <tr><td style="padding:0;">
        ${overlay}
        ${facts}
      </td></tr>
    </table>
  `;
}

function renderValueBullets(): string {
  const items = [
    "Matching listings",
    "Buyer demand",
    "Referrals",
    "Broker opens",
    "Network activity",
  ];
  const rows = items
    .map(
      (label) => `
        <tr><td style="padding:6px 0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;color:#111827;line-height:1.5;">
          <span style="display:inline-block;vertical-align:middle;width:6px;height:6px;background-color:#22C55E;border-radius:999px;margin-right:10px;"></span>
          ${escapeHtml(label)}
        </td></tr>`,
    )
    .join("");
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0 0;">
      ${rows}
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
  const { listing, ctaUrl, unsubscribeUrl, recipientEmail } = opts;

  const body = `
    <p style="margin:0 0 14px;">
      You're receiving a preview because your profile or market preferences
      haven't been completed.
    </p>
    <p style="margin:0 0 18px;">
      Complete them once, and All Agent Connect will automatically begin
      delivering personalized Hot Sheets with listings, buyer demand,
      referrals, broker opens, and other network activity tailored to your
      markets.
    </p>
    ${renderPreviewCard(listing)}
    ${renderValueBullets()}
  `;

  return buildAacEmail({
    headline: "Your personalized Hot Sheet is waiting.",
    preheader: "Your personalized Hot Sheet is waiting",
    body,
    ctaLabel: "Unlock My Hot Sheets",
    ctaUrl,
    tracking: unsubscribeUrl
      ? {
          unsubscribeUrl,
          recipientEmail,
          categoryLabel: "hot sheet alerts",
        }
      : undefined,
  });
}
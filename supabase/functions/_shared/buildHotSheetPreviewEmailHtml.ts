// Blurred Hot Sheet preview email body — reuses the unified AAC shell.
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

function maskAddress(street: string): string {
  const parts = (street || "").trim().split(/\s+/);
  if (parts.length < 2) return "▪▪▪▪▪";
  const middle = parts.slice(1, -1).join(" ") || parts[1];
  const masked = middle.length > 1
    ? middle[0] + "▪".repeat(Math.max(3, middle.length - 1))
    : "▪▪▪";
  return `${parts[0]} ${masked} ${parts[parts.length - 1]}`;
}

function maskPrice(price?: number | null): string {
  if (!price || !Number.isFinite(price)) return "$•,•••,•••";
  const digits = Math.round(price).toString().length;
  if (digits >= 7) return "$•,•••,•••";
  if (digits >= 4) return "$•••,•••";
  return "$•••";
}

function maskSqft(sqft?: number | null): string {
  if (!sqft || !Number.isFinite(sqft)) return "•,•••";
  const digits = Math.round(sqft).toString().length;
  if (digits >= 4) return "•,•••";
  return "•••";
}

function renderPreviewCard(listing: HotSheetPreviewListing): string {
  const streetMasked = maskAddress(listing.address || "");
  const cityState = [listing.city, listing.state].filter(Boolean).join(", ");
  const priceMasked = maskPrice(listing.price);
  const beds = listing.bedrooms != null ? String(listing.bedrooms) : "•";
  const baths = listing.bathrooms != null ? String(listing.bathrooms) : "•";
  const sqftMasked = maskSqft(listing.square_feet);
  const propertyType = listing.property_type
    ? escapeHtml(String(listing.property_type).replace(/_/g, " "))
    : "Home";

  const photoUrl = listing.photoUrl || "";

  const photoBlock = photoUrl
    ? `<div style="position:relative;overflow:hidden;border-radius:12px 12px 0 0;background-color:#0f172a;line-height:0;">
         <img src="${escapeHtml(photoUrl)}" width="600" alt="" style="display:block;width:100%;height:auto;max-height:320px;object-fit:cover;filter:blur(18px);transform:scale(1.15);opacity:0.85;border:0;outline:none;" />
       </div>`
    : `<div style="background:linear-gradient(135deg,#111317 0%,#1f2937 100%);height:220px;border-radius:12px 12px 0 0;"></div>`;

  const overlay = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:-72px 0 0;">
      <tr><td align="center" style="padding:0 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" style="max-width:420px;width:100%;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 8px 24px rgba(15,23,42,0.18);">
          <tr><td align="center" style="padding:20px 24px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#0E56F5;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Preview • Locked</p>
            <p style="margin:8px 0 0;font-size:15px;line-height:1.5;color:#0f172a;font-weight:600;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">New ${propertyType} matching your area</p>
            <p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:#475569;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Complete your profile to unlock full details.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;

  const facts = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 0;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;">
      <tr><td style="padding:18px 22px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
        <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">${escapeHtml(streetMasked)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;">${escapeHtml(cityState || "•••")}</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:14px 0 0;border-top:1px solid #e2e8f0;">
          <tr>
            <td style="padding-top:12px;font-size:20px;font-weight:700;color:#0E56F5;letter-spacing:-0.01em;">${escapeHtml(priceMasked)}</td>
            <td align="right" style="padding-top:12px;font-size:13px;color:#334155;">
              <span style="color:#0f172a;font-weight:600;">${escapeHtml(beds)}</span> bd
              <span style="color:#cbd5e1;padding:0 6px;">·</span>
              <span style="color:#0f172a;font-weight:600;">${escapeHtml(baths)}</span> ba
              <span style="color:#cbd5e1;padding:0 6px;">·</span>
              <span style="color:#0f172a;font-weight:600;">${escapeHtml(sqftMasked)}</span> sqft
            </td>
          </tr>
        </table>
      </td></tr>
    </table>`;

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:0;">
        ${photoBlock}
        ${overlay}
      </td></tr>
    </table>
    ${facts}
  `;
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
  const { recipientFirstName, listing, ctaUrl, unsubscribeUrl, recipientEmail } = opts;
  const greetingName = (recipientFirstName || "").trim();
  const greeting = greetingName
    ? `<p style="margin:0 0 12px;">Hi ${escapeHtml(greetingName)},</p>`
    : "";

  const intro = `${greeting}
    <p style="margin:0 0 18px;">
      A new listing just hit the market in one of your service areas — but your
      personalized Hot Sheet is still locked. Finish your profile and market
      preferences and we'll deliver the full details in your next Hot Sheet.
    </p>`;

  const closing = `
    <p style="margin:22px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
      Your Hot Sheet gets sharper the moment your profile is complete: matched
      listings, buyer coverage, and personalized branding all switch on
      automatically.
    </p>`;

  const body = `${intro}${renderPreviewCard(listing)}${closing}`;

  return buildAacEmail({
    headline: "Your personalized Hot Sheet is waiting.",
    preheader:
      "A preview of your personalized Hot Sheet — complete your profile to unlock it",
    body,
    ctaLabel: "Complete My Profile",
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
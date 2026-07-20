import { getListingPublicUrl, getPublicOrigin } from "@/lib/getPublicUrl";
import { buildPersonalListingShareEmailSubject } from "@/lib/listingEmailSubject";
import { listingCardStreetHeading, type ListingAddressUnitSource } from "@/lib/utils";
import { renderEmailListingCard, type EmailListingCardListing } from "@/lib/renderEmailListingCard";
import { resolveEmailPhotoUrl } from "@/lib/emailImageUrl";

export { buildPersonalListingShareEmailSubject } from "@/lib/listingEmailSubject";

export type ListingShareEmailListing = {
  id: string;
  address: string;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  unit_number?: string | null;
  condo_details?: unknown;
  price?: number | null;
  price_range_min?: number | null;
  price_range_max?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  square_feet?: number | null;
  property_type?: string | null;
  photos?: unknown;
  status?: string | null;
  listing_number?: string | null;
  year_built?: number | null;
  garage_spaces?: number | null;
  lot_size?: number | null;
  property_styles?: unknown;
  list_office?: string | null;
  brokerage_name?: string | null;
  listing_brokerage?: string | null;
  agent_name?: string | null;
  listing_agent_name?: string | null;
  description?: string | null;
};

/** Street + unit for email card address lines (keeps unit injection in sync with in-app cards). */
export function formatListingShareEmailStreetLine(
  listing: Pick<
    ListingShareEmailListing,
    "address" | "city" | "state" | "zip_code" | "unit_number" | "condo_details"
  >,
): string {
  const row: ListingAddressUnitSource = {
    address: listing.address || "",
    city: listing.city || "",
    state: listing.state || "",
    zip_code: listing.zip_code || "",
    unit_number: listing.unit_number,
    condo_details: listing.condo_details,
  };
  return listingCardStreetHeading(row) || listing.address || "Address unavailable";
}

const AAC_MONOGRAM_LOGO_URL =
  "https://allagentconnect.com/email/aac-monogram-green-128.png";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPrice(price?: number | null): string {
  if (price == null || !Number.isFinite(price) || price <= 0) return "";
  return `$${Math.round(price).toLocaleString()}`;
}

function formatListingSharePrice(listing: {
  price?: number | null;
  price_range_min?: number | null;
  price_range_max?: number | null;
}): string {
  const price = formatPrice(listing.price);
  if (price) return price;
  const min = typeof listing.price_range_min === "number" ? listing.price_range_min : Number(listing.price_range_min);
  const max = typeof listing.price_range_max === "number" ? listing.price_range_max : Number(listing.price_range_max);
  if (Number.isFinite(min) && min > 0 && Number.isFinite(max) && max > 0) {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return `$${Math.round(lo).toLocaleString()} – $${Math.round(hi).toLocaleString()}`;
  }
  // Legacy invalid rows only — not valid business pricing.
  return "Price upon request";
}

function buildListingShareEmailCard(listing: ListingShareEmailListing): string {
  const photoUrl = resolveEmailPhotoUrl(listing.photos ?? []);
  return renderEmailListingCard(
    { ...(listing as EmailListingCardListing), photoUrl },
    { listingUrl: getListingPublicUrl(listing.id) },
  );
}

function buildPersonalMessageBlock(userMessage: string): string {
  const trimmed = userMessage.trim();
  if (!trimmed) return "";
  const safe = escapeHtml(trimmed).replace(/\n/g, "<br>");
  return [
    `<div style="margin:0 0 20px;padding:14px 16px;background:#f8fafc;border-left:3px solid #0E56F5;border-radius:6px;">`,
    `<p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#0E56F5;text-transform:uppercase;letter-spacing:0.04em;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Personal Message</p>`,
    `<p style="margin:0;font-size:14px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${safe}</p>`,
    `</div>`,
  ].join("");
}

/** HTML body for personal hot sheet → listing share emails (send-bulk-email). */
export function buildHotSheetShareEmailHtml(params: {
  userMessage: string;
  listings: ListingShareEmailListing[];
  agentFirstName: string;
}): string {
  const { userMessage, listings, agentFirstName } = params;
  const listingCount = listings.length;
  const introHeadline = buildPersonalListingShareEmailSubject(
    agentFirstName,
    listingCount,
    listingCount === 1 ? listings[0] : null,
  );
  const safeIntroHeadline = escapeHtml(introHeadline);

  const listingCardsHtml = listings.map(buildListingShareEmailCard).join("");
  const personalMessageBlock = buildPersonalMessageBlock(userMessage);

  const plainTextFallback = listings
    .map((listing) => {
      const listingUrl = getListingPublicUrl(listing.id);
      const price = formatListingSharePrice(listing);
      const street = formatListingShareEmailStreetLine(listing);
      const cityStateZip = `${listing.city || ""}, ${listing.state || ""} ${listing.zip_code || ""}`
        .trim()
        .replace(/^,\s*|,\s*$/g, "");
      const address = [street, cityStateZip].filter(Boolean).join(", ");
      return `- ${address} - ${price} - ${listingUrl}`;
    })
    .join("\n");

  const headerNavy = "#111317";
  const headerGreen = "#50c878";
  const footerNavy = "#0A1A2F";
  const footerGreen = "#059669";
  const headerLogoUrl = AAC_MONOGRAM_LOGO_URL;
  const footerLogoUrl = `${getPublicOrigin()}/favicons/aac/favicon-32x32.png`;

  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;padding:0;background-color:#ffffff;">`,
    `<tr><td align="center" style="padding:24px 12px 32px;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">`,
    `<tr><td align="center" style="background-color:${headerNavy};border-radius:12px 12px 0 0;padding:32px 28px 0;">`,
    `<img src="${escapeHtml(headerLogoUrl)}" width="40" height="40" alt="All Agent Connect" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />`,
    `<p style="margin:12px 0 0;font-size:18px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;">All Agent Connect</p>`,
    `<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">${safeIntroHeadline}</p>`,
    `<div style="width:48px;height:2px;background-color:${headerGreen};margin:16px auto 0;border-radius:1px;"></div>`,
    `<div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>`,
    `</td></tr>`,
    `<tr><td style="background-color:#ffffff;border:1px solid #d1d5db;border-top:none;">`,
    `<div style="padding:28px 32px 24px;">`,
    `<h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${safeIntroHeadline}</h2>`,
    personalMessageBlock,
    `<div style="margin-top:${personalMessageBlock ? "4px" : "0"};">${listingCardsHtml}</div>`,
    `<p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#64748b;">`,
    `If a listing is no longer available, your agent can share updated options.`,
    `</p>`,
    `</div>`,
    `</td></tr>`,
    `<tr><td align="center" style="background-color:${footerNavy};border-top:2px solid ${footerGreen};border-radius:0 0 12px 12px;padding:22px 28px 20px;">`,
    `<img src="${escapeHtml(footerLogoUrl)}" width="24" height="24" alt="" style="display:block;margin:0 auto 10px;border:0;outline:none;" />`,
    `<p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.6);">All Agent Connect</p>`,
    `<p style="margin:0 0 6px;font-size:12px;">`,
    `<a href="mailto:hello@allagentconnect.com" style="color:rgba(255,255,255,0.45);text-decoration:none;">hello@allagentconnect.com</a>`,
    `</p>`,
    `</td></tr>`,
    `</table>`,
    `<!-- plain-text-fallback: ${escapeHtml(plainTextFallback)} -->`,
    `</td></tr>`,
    `</table>`,
  ].join("");
}

/**
 * Shared email-safe listing card renderers.
 *
 * Two canonical email cards, both mirroring the in-app SearchListingCard DNA
 * (status banner · hero photo · price + ID · property type · green-pin
 * address · beds/baths/sqft · brokerage + agent footer):
 *
 *   renderSearchStyleListingEmailCard — full-size card used by listing
 *     shares, price-change alerts, inquiry emails.
 *   renderCompactListingEmailCard — condensed AAC card (shorter hero,
 *     tighter padding) used by message notification emails where multiple
 *     listings stack.
 *   renderHotSheetMatchListingEmailCard — compact card with buyer-facing
 *     consumer-property links for Hot Sheet match / subscriber emails.
 *
 * Pure email-safe HTML: nested <table>s, inline styles, no flex/grid.
 */

import {
  formatListingShareEmailFullAddress,
  formatListingShareEmailStreetLine,
} from "./listingShareEmailAddress.ts";
import { resolveEmailPhotoUrl, rewriteEmailImageUrl } from "./listingPhotoUrl.ts";

const AAC_PRIMARY_BLUE = "#0E56F5";
const AAC_EMERALD = "#22C55E";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPrice(price: unknown): string {
  const num = typeof price === "number" ? price : Number(price);
  if (!Number.isFinite(num) || num <= 0) return "";
  return `$${Math.round(num).toLocaleString()}`;
}

function formatListingEmailPrice(listing: any): string {
  const price = formatPrice(listing?.price);
  if (price) return price;
  const min = Number(listing?.price_range_min);
  const max = Number(listing?.price_range_max);
  if (Number.isFinite(min) && min > 0 && Number.isFinite(max) && max > 0) {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return `$${Math.round(lo).toLocaleString()} – $${Math.round(hi).toLocaleString()}`;
  }
  // Legacy invalid rows only — not valid business pricing.
  return "Price upon request";
}

function resolvePhotoUrl(photos: unknown): string {
  return resolveEmailPhotoUrl(photos);
}

function humanize(s: unknown): string {
  return String(s ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function statusPill(status: unknown): string {
  const raw = String(status ?? "").toLowerCase().trim();
  if (!raw) return "";
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    active: { bg: "#dcfce7", fg: "#166534", label: "Active" },
    active_under_contract: { bg: "#fef3c7", fg: "#92400e", label: "Under Contract" },
    under_contract: { bg: "#fef3c7", fg: "#92400e", label: "Under Contract" },
    pending: { bg: "#fef3c7", fg: "#92400e", label: "Pending" },
    coming_soon: { bg: "#dbeafe", fg: "#1e40af", label: "Coming Soon" },
    sold: { bg: "#e5e7eb", fg: "#374151", label: "Sold" },
    closed: { bg: "#e5e7eb", fg: "#374151", label: "Closed" },
    withdrawn: { bg: "#e5e7eb", fg: "#374151", label: "Withdrawn" },
    expired: { bg: "#e5e7eb", fg: "#374151", label: "Expired" },
  };
  const s = map[raw] || { bg: "#e5e7eb", fg: "#374151", label: humanize(raw) };
  return `<span style="display:inline-block;background:${s.bg};color:${s.fg};font-size:11px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;padding:3px 8px;border-radius:999px;line-height:1;">${escapeHtml(s.label)}</span>`;
}

function pickListingIdLabel(listing: any): string {
  const num = listing.listing_number || listing.mls_number;
  if (num) return `#${String(num).trim()}`;
  if (listing.id) return `#${String(listing.id).slice(0, 8).toUpperCase()}`;
  return "";
}

function pickPropertyStyle(listing: any): string {
  const styles = listing.property_styles;
  if (Array.isArray(styles) && styles.length > 0) return String(styles[0]);
  if (typeof styles === "string" && styles.trim()) return styles;
  return listing.property_type ? String(listing.property_type) : "";
}

function buildFacts(listing: any): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  const style = pickPropertyStyle(listing);
  if (style) facts.push({ label: "Style", value: humanize(style) });
  const listingType = listing.listing_type || listing.property_type;
  if (listingType) facts.push({ label: "Type", value: humanize(listingType) });
  if (listing.neighborhood) facts.push({ label: "Neighborhood", value: String(listing.neighborhood) });
  if (listing.bedrooms != null) facts.push({ label: "Beds", value: String(listing.bedrooms) });
  if (listing.bathrooms != null) facts.push({ label: "Baths", value: String(listing.bathrooms) });
  const sqft = listing.square_feet ?? listing.squareFeet;
  if (sqft) facts.push({ label: "Living Area", value: `${Number(sqft).toLocaleString()} sqft` });
  if (listing.year_built) facts.push({ label: "Year Built", value: String(listing.year_built) });
  if (listing.garage_spaces) facts.push({ label: "Garage", value: String(listing.garage_spaces) });
  if (listing.lot_size) facts.push({ label: "Lot", value: `${Number(listing.lot_size).toLocaleString()} sqft` });
  return facts;
}

function renderFactsTable(facts: { label: string; value: string }[]): string {
  if (!facts.length) return "";
  const cells = facts.map((f) =>
    `<td style="padding:5px 14px 5px 0;font-size:12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;white-space:nowrap;"><span style="color:#71717a;">${escapeHtml(f.label)}:</span> <span style="color:#0f172a;font-weight:600;">${escapeHtml(f.value)}</span></td>`
  );
  // 2 columns per row for email safety
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push(`<tr>${cells[i] || ""}${cells[i + 1] || `<td></td>`}</tr>`);
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 0;border-top:1px solid #f1f5f9;padding-top:10px;width:100%;">${rows.join("")}</table>`;
}

function renderAttributionFooter(listing: any): string {
  const office = listing.list_office || listing.listing_brokerage || listing.brokerage_name || "";
  const agent = listing.listing_agent_name || listing.agent_name || "";
  if (!office && !agent) return "";
  const left = office
    ? `<span style="color:#71717a;">Listed by:</span> <span style="color:#0f172a;font-weight:600;">${escapeHtml(office)}</span>`
    : "";
  const right = agent
    ? `<span style="color:#71717a;">Agent:</span> <span style="color:#0f172a;font-weight:600;">${escapeHtml(agent)}</span>`
    : "";
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 0;border-top:1px solid #f1f5f9;padding-top:10px;font-size:11px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
      <tr>
        <td align="left" style="color:#71717a;">${left}</td>
        <td align="right" style="color:#71717a;">${right}</td>
      </tr>
    </table>`;
}

export interface RenderListingEmailCardOptions {
  /** Absolute base origin used to build the View Listing URL (e.g. "https://allagentconnect.com"). */
  baseUrl?: string;
  /** Optional explicit per-listing URL override. */
  listingUrl?: string;
  /** CTA label, default "View Listing". */
  ctaLabel?: string;
  /** AAC green accent button (#50c878) instead of primary blue. */
  greenCta?: boolean;
}

function formatPropertyTypeLabel(raw: unknown): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  if (t.includes("_")) return humanize(t.replace(/_/g, " "));
  return t
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function pickBrokerageLabel(listing: any): string {
  for (const key of ["brokerage_name", "listing_brokerage", "list_office"]) {
    const v = listing?.[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function neighborhoodPill(neighborhood: unknown): string {
  const label = String(neighborhood ?? "").trim();
  if (!label) return "";
  return `<span style="display:inline-block;background:#0f172a;color:#ffffff;font-size:12px;font-weight:600;padding:5px 12px;border-radius:999px;line-height:1.2;letter-spacing:0.01em;">${escapeHtml(label)}</span>`;
}

function pickFeaturePill(listing: any): string {
  const candidates = ["waterfront", "view", "pool", "new construction"];
  const feats = listing?.features ?? listing?.tags;
  if (Array.isArray(feats)) {
    for (const f of feats) {
      const s = String(f ?? "").trim();
      if (!s) continue;
      const lc = s.toLowerCase();
      if (candidates.some((c) => lc.includes(c))) return humanize(s);
    }
    if (feats.length > 0 && typeof feats[0] === "string") return humanize(String(feats[0]));
  }
  if (listing?.waterfront) return "Waterfront";
  return "";
}

function renderStatusBanner(status: unknown): string {
  const raw = String(status ?? "").toLowerCase().trim();
  if (!raw) return "";
  const map: Record<string, { bg: string; label: string }> = {
    active: { bg: "#22C55E", label: "Active" },
    coming_soon: { bg: AAC_PRIMARY_BLUE, label: "Coming Soon" },
    active_under_contract: { bg: "#F59E0B", label: "Under Contract" },
    under_contract: { bg: "#F59E0B", label: "Under Contract" },
    pending: { bg: "#F59E0B", label: "Pending" },
    sold: { bg: "#6B7280", label: "Sold" },
    closed: { bg: "#6B7280", label: "Closed" },
    withdrawn: { bg: "#6B7280", label: "Withdrawn" },
    expired: { bg: "#6B7280", label: "Expired" },
  };
  const s = map[raw] || { bg: "#6B7280", label: humanize(raw) };
  return `<tr><td align="center" style="background:${s.bg};color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:10px 12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(s.label)}</td></tr>`;
}

function renderStatsRow(listing: any): string {
  const parts: string[] = [];
  const bedIcon = `<span style="color:${AAC_PRIMARY_BLUE};font-weight:700;font-size:13px;margin-right:4px;">&#9670;</span>`;
  const bathIcon = `<span style="color:${AAC_PRIMARY_BLUE};font-weight:700;font-size:13px;margin-right:4px;">&#9670;</span>`;
  const sqftIcon = `<span style="color:${AAC_PRIMARY_BLUE};font-weight:700;font-size:13px;margin-right:4px;">&#9670;</span>`;
  if (listing.bedrooms != null) parts.push(`${bedIcon}<span style="color:#171717;font-weight:600;">${escapeHtml(String(listing.bedrooms))}</span> <span style="color:${AAC_PRIMARY_BLUE};font-weight:600;">bd</span>`);
  if (listing.bathrooms != null) parts.push(`${bathIcon}<span style="color:#171717;font-weight:600;">${escapeHtml(String(listing.bathrooms))}</span> <span style="color:${AAC_PRIMARY_BLUE};font-weight:600;">ba</span>`);
  const sqft = listing.square_feet ?? listing.squareFeet;
  if (sqft) parts.push(`${sqftIcon}<span style="color:#171717;font-weight:600;">${escapeHtml(Number(sqft).toLocaleString())}</span> <span style="color:${AAC_PRIMARY_BLUE};font-weight:600;">sqft</span>`);
  if (!parts.length) return "";
  const separator = '<span style="color:#d4d4d4;padding:0 10px;">\u00b7</span>';
  return `<p style="margin:10px 0 0;font-size:14px;line-height:1.4;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${parts.join(separator)}</p>`;
}

/** Canonical email listing card mirroring the in-app SearchListingCard. */
export function renderSearchStyleListingEmailCard(
  listing: any,
  opts: RenderListingEmailCardOptions = {},
): string {
  const baseUrl = (opts.baseUrl || "https://allagentconnect.com").replace(/\/$/, "");
  const listingUrl = opts.listingUrl || (listing?.id ? `${baseUrl}/property/${listing.id}` : "");
  const safeUrl = escapeHtml(listingUrl);

  const photoUrl = rewriteEmailImageUrl(listing.photoUrl) || resolvePhotoUrl(listing.photos);
  const price = formatListingEmailPrice(listing);
  const propertyType = formatPropertyTypeLabel(listing.property_type);
  const fullAddress =
    formatListingShareEmailFullAddress(listing) ||
    formatListingShareEmailStreetLine(listing) ||
    String(listing.address || "");
  const brokerage = pickBrokerageLabel(listing);
  const agentName = listing.listing_agent_name || listing.agent_name || "";
  const idLabel = pickListingIdLabel(listing);
  const featurePill = pickFeaturePill(listing);
  const statusBanner = renderStatusBanner(listing.status);
  const statsHtml = renderStatsRow(listing);
  const hoodPill = neighborhoodPill(listing.neighborhood);

  const photoHeight = 300;
  const safeAlt = escapeHtml(fullAddress || "Listing photo");

  const photoCellInner = photoUrl
    ? `<a href="${safeUrl}" style="text-decoration:none;display:block;line-height:0;font-size:0;">
         <img src="${escapeHtml(photoUrl)}" alt="${safeAlt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" />
       </a>`
    : `<div style="width:100%;height:${photoHeight}px;line-height:${photoHeight}px;text-align:center;color:#9ca3af;font-size:13px;font-family:system-ui,-apple-system,sans-serif;background:#f3f4f6;">Photo unavailable</div>`;

  // Feature pill rendered as a second row, right-aligned, sitting just below the photo.
  // Positioning over the image is unreliable across email clients; this keeps it visible and on-brand.
  const featurePillRow = featurePill
    ? `<tr><td align="right" style="padding:8px 14px 0;background:#ffffff;">
         <span style="display:inline-block;background:#ffffff;color:#171717;font-size:12px;font-weight:600;padding:6px 12px;border-radius:999px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.08);">${escapeHtml(featurePill)}</span>
       </td></tr>`
    : "";

  const hoodPillRow = hoodPill
    ? `<tr><td align="left" style="padding:10px 14px 0;background:#ffffff;">${hoodPill}</td></tr>`
    : "";

  const headerRow = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
      <tr>
        <td valign="top" style="padding-right:10px;">
          <div style="font-size:22px;font-weight:700;color:#0f172a;line-height:1.1;">${escapeHtml(price)}</div>
        </td>
        ${idLabel ? `<td valign="top" align="right" style="white-space:nowrap;font-size:13px;font-weight:600;color:${AAC_PRIMARY_BLUE};letter-spacing:0.02em;">ID ${escapeHtml(idLabel)}</td>` : ""}
      </tr>
    </table>`;

  const propertyTypeRow = propertyType
    ? `<div style="margin-top:4px;font-size:14px;font-weight:600;color:#404040;line-height:1.3;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(propertyType)}</div>`
    : "";

  const addressRow = fullAddress
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 0;">
         <tr>
           <td valign="top" style="font-size:14px;line-height:1.4;color:#171717;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(fullAddress)}</td>
         </tr>
       </table>`
    : "";

  const footerRow = (brokerage || agentName)
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0 0;border-top:1px solid #f1f5f9;padding-top:12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
         <tr>
           <td align="left" style="font-size:12px;color:#737373;line-height:1.3;">${escapeHtml(brokerage)}</td>
           <td align="right" style="font-size:12px;color:#171717;font-weight:600;line-height:1.3;white-space:nowrap;">${escapeHtml(agentName)}</td>
         </tr>
       </table>`
    : "";

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#ffffff;box-shadow:0 1px 3px rgba(17,24,39,0.06);">
      ${statusBanner}
      <tr>
        <td style="padding:0;line-height:0;font-size:0;background:#f3f4f6;">
          ${photoCellInner}
        </td>
      </tr>
      ${featurePillRow}
      ${hoodPillRow}
      <tr>
        <td valign="top" style="padding:14px 16px 16px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
          ${headerRow}
          ${propertyTypeRow}
          ${addressRow}
          ${statsHtml}
          ${footerRow}
        </td>
      </tr>
    </table>`;
}

/** @deprecated Use renderSearchStyleListingEmailCard. Kept as an alias so all listing emails share one card. */
export function renderListingEmailCard(
  listing: any,
  opts: RenderListingEmailCardOptions = {},
): string {
  return renderSearchStyleListingEmailCard(listing, opts);
}

/**
 * Compact AAC listing card for Hot Sheet match emails and message
 * notification emails. Shares the same brand DNA as the full card
 * (status banner, green pin, AAC tokens) but uses a shorter hero
 * (170px), tighter padding, and a single-line stats row so multiple
 * listings stack cleanly in one email.
 */
export function renderCompactListingEmailCard(
  listing: any,
  opts: RenderListingEmailCardOptions = {},
): string {
  const baseUrl = (opts.baseUrl || "https://allagentconnect.com").replace(/\/$/, "");
  const listingUrl = opts.listingUrl || (listing?.id ? `${baseUrl}/property/${listing.id}` : "");
  const safeUrl = escapeHtml(listingUrl);

  const photoUrl = rewriteEmailImageUrl(listing.photoUrl) || resolvePhotoUrl(listing.photos);
  const price = formatListingEmailPrice(listing);
  const propertyType = formatPropertyTypeLabel(listing.property_type);
  const fullAddress =
    formatListingShareEmailFullAddress(listing) ||
    formatListingShareEmailStreetLine(listing) ||
    String(listing.address || "");
  const brokerage = pickBrokerageLabel(listing);
  const agentName = listing.listing_agent_name || listing.agent_name || "";
  const idLabel = pickListingIdLabel(listing);
  const statusBanner = renderStatusBanner(listing.status);
  const statsHtml = renderStatsRow(listing);
  const hoodPill = neighborhoodPill(listing.neighborhood);

  const photoHeight = 170;
  const safeAlt = escapeHtml(fullAddress || "Listing photo");

  const photoCellInner = photoUrl
    ? `<a href="${safeUrl}" style="text-decoration:none;display:block;line-height:0;font-size:0;">
         <img src="${escapeHtml(photoUrl)}" alt="${safeAlt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" />
       </a>`
    : `<div style="width:100%;height:${photoHeight}px;line-height:${photoHeight}px;text-align:center;color:#9ca3af;font-size:12px;font-family:system-ui,-apple-system,sans-serif;background:#f3f4f6;">Photo unavailable</div>`;

  const headerRow = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
      <tr>
        <td valign="top" style="padding-right:8px;">
          <div style="font-size:18px;font-weight:700;color:#0f172a;line-height:1.1;">${escapeHtml(price)}</div>
        </td>
        ${idLabel ? `<td valign="top" align="right" style="white-space:nowrap;font-size:12px;font-weight:600;color:${AAC_PRIMARY_BLUE};letter-spacing:0.02em;">ID ${escapeHtml(idLabel)}</td>` : ""}
      </tr>
    </table>`;

  const propertyTypeRow = propertyType
    ? `<div style="margin-top:2px;font-size:12px;font-weight:600;color:#404040;line-height:1.3;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(propertyType)}</div>`
    : "";

  const addressRow = fullAddress
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 0;">
         <tr>
           <td valign="top" style="font-size:13px;line-height:1.4;color:#171717;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(fullAddress)}</td>
         </tr>
       </table>`
    : "";

  const footerRow = (brokerage || agentName)
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:10px 0 0;border-top:1px solid #f1f5f9;padding-top:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
         <tr>
           <td align="left" style="font-size:11px;color:#737373;line-height:1.3;">${escapeHtml(brokerage)}</td>
           <td align="right" style="font-size:11px;color:#171717;font-weight:600;line-height:1.3;white-space:nowrap;">${escapeHtml(agentName)}</td>
         </tr>
       </table>`
    : "";

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 12px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#ffffff;box-shadow:0 1px 3px rgba(17,24,39,0.06);">
      ${statusBanner}
      <tr>
        <td style="padding:0;line-height:0;font-size:0;background:#f3f4f6;">
          ${photoCellInner}
        </td>
      </tr>
      ${hoodPill ? `<tr><td align="left" style="padding:8px 14px 0;background:#ffffff;">${hoodPill}</td></tr>` : ""}
      <tr>
        <td valign="top" style="padding:10px 14px 12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
          ${headerRow}
          ${propertyTypeRow}
          ${addressRow}
          ${statsHtml}
          ${footerRow}
        </td>
      </tr>
    </table>`;
}

/** Compact AAC card for Hot Sheet match / subscriber notification emails (buyer-facing). */
export function renderHotSheetMatchListingEmailCard(
  listing: any,
  opts: { baseUrl: string },
): string {
  const baseUrl = opts.baseUrl.replace(/\/$/, "");
  const id = listing?.id ? String(listing.id) : "";
  return renderCompactListingEmailCard(listing, {
    baseUrl,
    listingUrl: id ? `${baseUrl}/consumer-property/${id}` : "",
    ctaLabel: "View Listing",
    greenCta: true,
  });
}
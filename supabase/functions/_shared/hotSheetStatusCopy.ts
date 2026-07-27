// Shared status-copy map for Hot Sheet status-change emails.
// One authoritative source consumed by both the caller
// (send-new-match-notification) and the renderer (renderEmailTemplate).

export type HotSheetStatusKey =
  | "coming_soon"
  | "on_mls"
  | "back_on_market"
  | "off_market"
  | "pending"
  | "sold"
  | "withdrawn"
  | "expired"
  | "other";

export interface HotSheetStatusCopy {
  key: HotSheetStatusKey;
  label: string;
  headline: string;
  subject: (hotSheetName: string) => string;
  intro: (count: number, hotSheetName: string) => string;
}

/**
 * Normalize any raw listing.status value to a canonical HotSheetStatusKey.
 *   active  -> on_mls
 *   closed  -> sold
 *   missing / unknown -> other
 */
export function normalizeStatusKey(raw: unknown): HotSheetStatusKey {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "other";
  if (v === "active" || v === "on_mls") return "on_mls";
  if (v === "closed" || v === "sold") return "sold";
  if (
    v === "coming_soon" ||
    v === "back_on_market" ||
    v === "off_market" ||
    v === "pending" ||
    v === "withdrawn" ||
    v === "expired"
  ) {
    return v as HotSheetStatusKey;
  }
  return "other";
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

const COPY: Record<HotSheetStatusKey, HotSheetStatusCopy> = {
  coming_soon: {
    key: "coming_soon",
    label: "Coming Soon",
    headline: "Coming Soon update",
    subject: (name) => `Now Coming Soon in ${name}`,
    intro: (n, name) =>
      `${n} ${plural(n, "listing", "listings")} in "${name}" ${plural(n, "is", "are")} now <strong>Coming Soon</strong>.`,
  },
  on_mls: {
    key: "on_mls",
    label: "On MLS",
    headline: "On MLS update",
    subject: (name) => `Now On MLS in ${name}`,
    intro: (n, name) =>
      `${n} ${plural(n, "listing", "listings")} in "${name}" ${plural(n, "is", "are")} now <strong>On MLS</strong>.`,
  },
  back_on_market: {
    key: "back_on_market",
    label: "Back on Market",
    headline: "Back on Market",
    subject: (name) => `Back on Market in ${name}`,
    intro: (n, name) =>
      `${n} ${plural(n, "listing", "listings")} in "${name}" ${plural(n, "is", "are")} <strong>Back on Market</strong>.`,
  },
  off_market: {
    key: "off_market",
    label: "Off Market",
    headline: "Off Market update",
    subject: (name) => `Off Market update in ${name}`,
    intro: (n, name) =>
      `${n} ${plural(n, "listing", "listings")} in "${name}" moved to <strong>Off Market</strong>.`,
  },
  pending: {
    key: "pending",
    label: "Pending",
    headline: "Pending update",
    subject: (name) => `Now Pending in ${name}`,
    intro: (n, name) =>
      `${n} ${plural(n, "listing", "listings")} in "${name}" ${plural(n, "is", "are")} now <strong>Pending</strong>.`,
  },
  sold: {
    key: "sold",
    label: "Sold",
    headline: "Sold update",
    subject: (name) => `Recently Sold in ${name}`,
    intro: (n, name) =>
      `${n} ${plural(n, "listing", "listings")} in "${name}" ${plural(n, "has", "have")} <strong>Sold</strong>.`,
  },
  withdrawn: {
    key: "withdrawn",
    label: "Withdrawn",
    headline: "Withdrawn update",
    subject: (name) => `Withdrawn in ${name}`,
    intro: (n, name) =>
      `${n} ${plural(n, "listing", "listings")} in "${name}" ${plural(n, "was", "were")} <strong>Withdrawn</strong>.`,
  },
  expired: {
    key: "expired",
    label: "Expired",
    headline: "Expired update",
    subject: (name) => `Expired in ${name}`,
    intro: (n, name) =>
      `${n} ${plural(n, "listing", "listings")} in "${name}" ${plural(n, "has", "have")} <strong>Expired</strong>.`,
  },
  other: {
    key: "other",
    label: "Status update",
    headline: "Status update",
    subject: (name) => `Status update in ${name}`,
    intro: (n, name) =>
      `${n} ${plural(n, "listing", "listings")} in "${name}" changed status.`,
  },
};

export function getHotSheetStatusCopy(status: unknown): HotSheetStatusCopy {
  return COPY[normalizeStatusKey(status)];
}
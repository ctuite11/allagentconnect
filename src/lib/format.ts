/**
 * String formatting utilities
 * 
 * Use these helpers for consistent text presentation across the UI.
 * Do NOT use these for domain statuses - use StatusBadge components instead.
 */

/**
 * Converts snake_case strings to Title Case
 * 
 * Example: "single_family" → "Single Family"
 * Example: "multi_family" → "Multi Family"
 * 
 * Use for: property types, general snake_case labels
 * Do NOT use for: listing/agent/hotsheet statuses (use StatusBadge)
 */
export function humanizeSnakeCase(input?: string | null): string {
  if (!input) return "";
  return input
    .split("_")
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Display label for listing `property_type` on cards (e.g. single_family → Single Family). */
export function formatListingPropertyTypeLabel(raw?: string | null): string {
  if (!raw?.trim()) return "";
  const t = raw.trim();
  if (t.includes("_")) return humanizeSnakeCase(t);
  return t
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const HIDDEN_CONSUMER_PROPERTY_TYPES = new Set([
  "other",
  "unknown",
  "na",
  "n_a",
  "unspecified",
  "none",
]);

/** Buyer-facing property type — humanized label, or null when unknown/internal. */
export function formatConsumerPropertyTypeLabel(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (HIDDEN_CONSUMER_PROPERTY_TYPES.has(normalized)) return null;
  const label = formatListingPropertyTypeLabel(raw);
  if (!label || label.toLowerCase() === "other") return null;
  return label;
}

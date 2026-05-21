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

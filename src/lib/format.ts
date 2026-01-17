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

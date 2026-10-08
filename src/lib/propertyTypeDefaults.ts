/**
 * Communications Center property-type default.
 * Unconfigured agents (no saved notification_preferences.property_types, or an
 * empty array from the column default) start with Single Family + Condominium.
 * Saved non-empty choices are always kept as-is.
 */
export const DEFAULT_COMMS_PROPERTY_TYPES = ["single_family", "condo"] as const;

export function resolveCommsPropertyTypes(saved: unknown): string[] {
  const valid = Array.isArray(saved)
    ? saved.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    : [];
  return valid.length > 0 ? valid : [...DEFAULT_COMMS_PROPERTY_TYPES];
}

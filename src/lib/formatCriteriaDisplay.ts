import { getListingStatusLabel } from "@/constants/status";

/**
 * Human-readable token for hot sheet / search criteria (listing statuses, property types, filters stored as snake_case).
 * Delegates to listing status canonical labels when applicable; otherwise Title Case via snake_case humanization.
 */
export function formatCriteriaDisplayLabel(raw: string | null | undefined): string {
  return getListingStatusLabel(raw);
}

/** Join formatted labels preserving caller order (`separator` defaults to comma + space). */
export function formatCriteriaDisplayLabels(
  values: string[] | null | undefined,
  separator = ", ",
): string {
  if (!values?.length) return "";
  return values.map((v) => getListingStatusLabel(v)).filter(Boolean).join(separator);
}

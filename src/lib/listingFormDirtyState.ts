/**
 * Canonical dirty-state tracking for the listing editors.
 *
 * Hydrating an existing listing writes many normalized values back into form
 * state (null -> "", numbers -> strings, arrays re-ordered, ISO dates trimmed).
 * Those writes are NOT user edits, so dirty state must be a comparison against a
 * baseline snapshot taken once hydration settles, never a "form has content" heuristic.
 */

type MediaLike = {
  id?: string;
  url?: string;
  preview?: string;
  uploaded?: boolean;
  documentType?: string;
  customDocumentLabel?: string;
  file?: { name?: string; size?: number };
};

const ISO_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})T[\d:.]+/;

const normalizeValue = (value: unknown): unknown => {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    const isoMatch = trimmed.match(ISO_DATE_PREFIX);
    return isoMatch ? isoMatch[1] : trimmed;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }
  if (Array.isArray(value)) {
    return value
      .map(normalizeValue)
      .filter((item) => item !== "")
      .map((item) => JSON.stringify(item))
      .sort();
  }
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      result[key] = normalizeValue(source[key]);
    }
    return result;
  }
  return String(value);
};

/** Media items hold File objects that don't serialize — reduce them to stable identity strings. */
export const describeMediaCollection = (items: MediaLike[] | undefined | null): string[] => {
  if (!Array.isArray(items)) return [];
  return items.map((item) =>
    [
      item?.url ?? item?.id ?? item?.preview ?? "",
      item?.file?.name ?? "",
      item?.file?.size ?? "",
      item?.documentType ?? "",
      item?.customDocumentLabel ?? "",
    ].join("|"),
  );
};

/** Stable, normalization-insensitive fingerprint of the editor's saveable state. */
export const canonicalizeListingFormState = (parts: Record<string, unknown>): string => {
  const keys = Object.keys(parts).sort();
  return JSON.stringify(keys.map((key) => [key, normalizeValue(parts[key])]));
};

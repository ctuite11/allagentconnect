const OTHER_FEATURE_PREFIX = "__OTHER__:";

/** Strip internal `__OTHER__:` storage prefix; show custom amenity text only. */
export function normalizePropertyFeatureLabel(item: unknown): string | null {
  if (item == null) return null;

  let label: string;
  if (typeof item === "string") {
    label = item;
  } else if (typeof item === "object") {
    const obj = item as Record<string, unknown>;
    label = String(obj.name || obj.label || obj.value || "");
  } else {
    label = String(item);
  }

  label = label.trim();
  if (!label) return null;

  if (label.startsWith(OTHER_FEATURE_PREFIX)) {
    const custom = label.slice(OTHER_FEATURE_PREFIX.length).trim();
    return custom || null;
  }

  if (label === "__OTHER__" || label === "_OTHER_") return null;

  return label;
}

export function formatPropertyFeatureList(arr: unknown[] | null | undefined): string | null {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return null;

  const items = arr
    .map(normalizePropertyFeatureLabel)
    .filter((value): value is string => Boolean(value));

  const unique = [...new Set(items)];
  return unique.length > 0 ? unique.join(", ") : null;
}

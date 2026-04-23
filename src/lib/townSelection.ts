export interface ParsedTownSelection {
  city: string;
  neighborhood: string | null;
}

export function normalizeTownSelections(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const parsed = parseTownSelection(value);
    const normalizedValue = parsed.neighborhood
      ? `${parsed.city}-${parsed.neighborhood}`
      : parsed.city;

    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    normalized.push(normalizedValue);
  }

  return normalized;
}

export function parseTownSelection(value: string): ParsedTownSelection {
  const normalized = value.trim();
  const dashIndex = normalized.indexOf("-");

  if (dashIndex <= 0) {
    return {
      city: normalized,
      neighborhood: null,
    };
  }

  return {
    city: normalized.slice(0, dashIndex).trim(),
    neighborhood: normalized.slice(dashIndex + 1).trim() || null,
  };
}

export function formatTownSelectionLabel(value: string): string {
  const parsed = parseTownSelection(value);
  if (!parsed.neighborhood) {
    return parsed.city;
  }

  return `${parsed.city} · ${parsed.neighborhood}`;
}

export function toggleTownSelection(current: string[], value: string): string[] {
  const dedupedCurrent = normalizeTownSelections(current);
  const parsedValue = parseTownSelection(value);
  const normalizedValue = parsedValue.neighborhood
    ? `${parsedValue.city}-${parsedValue.neighborhood}`
    : parsedValue.city;

  const exists = dedupedCurrent.includes(normalizedValue);
  if (exists) {
    return dedupedCurrent.filter((entry) => entry !== normalizedValue);
  }

  if (!parsedValue.neighborhood) {
    const withoutNeighborhoods = dedupedCurrent.filter((entry) => !entry.startsWith(`${parsedValue.city}-`));
    return normalizeTownSelections([...withoutNeighborhoods, normalizedValue]);
  }

  const withoutParentCity = dedupedCurrent.filter((entry) => entry !== parsedValue.city);
  return normalizeTownSelections([...withoutParentCity, normalizedValue]);
}
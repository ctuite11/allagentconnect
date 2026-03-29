/**
 * Parses selectedTowns entries (which may be plain cities or "City-Neighborhood" pairs)
 * and applies the correct Supabase filter.
 *
 * Plain city:        "Boston"          → city.eq.Boston
 * City+neighborhood: "Boston-Back Bay" → city.eq.Boston AND neighborhood.eq.Back Bay
 *
 * Splits only on the FIRST hyphen so neighborhood names with hyphens are preserved.
 */
/**
 * Escapes special characters for PostgREST ilike patterns.
 * Prevents %, _, and backslash in city/neighborhood names from being
 * interpreted as wildcards.
 */
function escapeIlike(value: string): string {
  // Escape ilike wildcards
  const escaped = value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  // Wrap in double-quotes to protect commas, parentheses, and other
  // PostgREST filter-string delimiters that may appear in place names.
  return `"${escaped}"`;
}

export function applyLocationFilter<T extends { in: Function; or: Function }>(
  query: T,
  selectedTowns: string[],
): T {
  if (selectedTowns.length === 0) return query;

  const plainCities: string[] = [];
  const neighborhoodFilters: { city: string; neighborhood: string }[] = [];

  for (const town of selectedTowns) {
    const dashIndex = town.indexOf("-");
    if (dashIndex === -1) {
      plainCities.push(town);
    } else {
      const city = town.substring(0, dashIndex);
      const neighborhood = town.substring(dashIndex + 1);
      neighborhoodFilters.push({ city, neighborhood });
    }
  }

  // Build an .or() filter string for PostgREST using case-insensitive ilike
  const parts: string[] = [];

  for (const city of plainCities) {
    parts.push(`city.ilike.${escapeIlike(city)}`);
  }

  for (const nf of neighborhoodFilters) {
    parts.push(`and(city.ilike.${escapeIlike(nf.city)},neighborhood.ilike.${escapeIlike(nf.neighborhood)})`);
  }

  return query.or(parts.join(",")) as T;
}

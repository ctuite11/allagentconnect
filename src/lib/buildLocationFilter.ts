/**
 * Parses selectedTowns entries (which may be plain cities or "City-Neighborhood" pairs)
 * and applies the correct Supabase filter.
 *
 * Plain city:        "Boston"          → city.eq.Boston
 * City+neighborhood: "Boston-Back Bay" → city.eq.Boston AND neighborhood.eq.Back Bay
 *
 * Splits only on the FIRST hyphen so neighborhood names with hyphens are preserved.
 */
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

  // Only plain cities — simple .in() filter
  if (neighborhoodFilters.length === 0) {
    return query.in("city", plainCities) as T;
  }

  // Build an .or() filter string for PostgREST
  const parts: string[] = [];

  if (plainCities.length > 0) {
    parts.push(`city.in.(${plainCities.join(",")})`);
  }

  for (const nf of neighborhoodFilters) {
    parts.push(`and(city.eq.${nf.city},neighborhood.eq.${nf.neighborhood})`);
  }

  return query.or(parts.join(",")) as T;
}

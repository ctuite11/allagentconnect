/**
 * Supabase filter: listings whose asking price overlaps the search range.
 *
 * - Fixed price: `price > 0` and value lies in `[smin,smax]` (open bounds omitted).
 * - Full range: `price_range_min` / `price_range_max` overlap via
 *   `Lmin ≤ smax AND Lmax ≥ smin`.
 * - Single endpoint: treated as that value (equal min=max for overlap checks).
 */

type OrCapable<Q> = Q & {
  or: (filter: string, options?: object) => Q;
};

function normBound(v: number | undefined | null): number | null {
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  return Math.floor(Number(v));
}

/**
 * Applies one `.or(...)` group AND-combined with any existing filters.
 * If neither bound is set, returns `query` unchanged.
 */
export function applyListingPriceOverlapFilter<Q extends OrCapable<unknown>>(query: Q, minRaw?: number | null, maxRaw?: number | null): Q {
  const smin = normBound(minRaw ?? undefined);
  const smax = normBound(maxRaw ?? undefined);

  if (smin == null && smax == null) return query;

  const clauses: string[] = [];

  if (smin != null && smax != null) {
    clauses.push(`and(price.gt.0,price.gte.${smin},price.lte.${smax})`);
    clauses.push(
      `and(price_range_min.gt.0,price_range_max.gt.0,price_range_min.lte.${smax},price_range_max.gte.${smin})`,
    );
    clauses.push(`and(price_range_min.gt.0,price_range_max.is.null,price_range_min.gte.${smin},price_range_min.lte.${smax})`);
    clauses.push(`and(price_range_max.gt.0,price_range_min.is.null,price_range_max.gte.${smin},price_range_max.lte.${smax})`);
  } else if (smin != null) {
    clauses.push(`and(price.gt.0,price.gte.${smin})`);
    clauses.push(`and(price_range_min.gt.0,price_range_max.gt.0,price_range_max.gte.${smin})`);
    clauses.push(`and(price_range_min.gt.0,price_range_max.is.null,price_range_min.gte.${smin})`);
    clauses.push(`and(price_range_max.gt.0,price_range_min.is.null,price_range_max.gte.${smin})`);
  } else if (smax != null) {
    clauses.push(`and(price.gt.0,price.lte.${smax})`);
    clauses.push(`and(price_range_min.gt.0,price_range_max.gt.0,price_range_min.lte.${smax})`);
    clauses.push(`and(price_range_min.gt.0,price_range_max.is.null,price_range_min.lte.${smax})`);
    clauses.push(`and(price_range_max.gt.0,price_range_min.is.null,price_range_max.lte.${smax})`);
  }

  if (clauses.length === 0) return query;
  return query.or(clauses.join(",")) as Q;
}

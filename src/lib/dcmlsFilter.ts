/**
 * Shared DCMLS visibility filter.
 * 
 * DCMLS is a public-facing filtered view of the same AAC listings table.
 * A listing is visible on DCMLS only when:
 *   - publish_to_dcmls = true
 *   - dcmls_status = 'published'
 *   - status is a publicly visible status (active, coming_soon, back_on_market, pending, under_contract)
 *
 * Use applyDcmlsFilter on any Supabase query that powers a DCMLS-facing view.
 */

/** Statuses considered publicly visible on DCMLS */
const DCMLS_PUBLIC_STATUSES = [
  'active',
  'coming_soon',
  'back_on_market',
  'pending',
  'under_contract',
];

/**
 * Applies DCMLS visibility filters to a Supabase query.
 * Call this on any query that feeds DCMLS search, map, detail, or featured sections.
 */
export function applyDcmlsFilter<T extends { eq: Function; in: Function }>(
  query: T,
): T {
  return query
    .eq('publish_to_dcmls', true)
    .eq('dcmls_status', 'published')
    .in('status', DCMLS_PUBLIC_STATUSES) as T;
}

/**
 * Client-side filter for listings already fetched.
 * Useful when you have an array and need to remove non-DCMLS rows.
 */
export function isDcmlsVisible(listing: {
  publish_to_dcmls?: boolean;
  dcmls_status?: string;
  status?: string;
}): boolean {
  return (
    listing.publish_to_dcmls === true &&
    listing.dcmls_status === 'published' &&
    DCMLS_PUBLIC_STATUSES.includes(listing.status || '')
  );
}

/**
 * Computes the DCMLS fields to include in a listing save/update payload.
 *
 * @param publishToDcmls - whether the agent checked "Show on DCMLS"
 * @param currentDcmlsPublishedAt - existing dcmls_published_at value (null if never published)
 * @param listing - partial listing for validation (address, price, property_type, photos)
 */
export function buildDcmlsPayload(
  publishToDcmls: boolean,
  currentDcmlsPublishedAt: string | null,
  listing?: { address?: string; price?: number | null; property_type?: string | null },
): {
  publish_to_dcmls: boolean;
  dcmls_status: string;
  dcmls_published_at: string | null;
  dcmls_last_updated_at: string | null;
  dcmls_error: string | null;
} {
  const now = new Date().toISOString();

  if (!publishToDcmls) {
    return {
      publish_to_dcmls: false,
      dcmls_status: 'hidden',
      dcmls_published_at: currentDcmlsPublishedAt, // preserve original publish date
      dcmls_last_updated_at: now,
      dcmls_error: null,
    };
  }

  // Validate minimum fields for public display
  const errors: string[] = [];
  if (!listing?.address || listing.address === 'Draft') errors.push('address');
  if (!listing?.price || listing.price <= 0) errors.push('price');
  if (!listing?.property_type) errors.push('property type');

  if (errors.length > 0) {
    return {
      publish_to_dcmls: true,
      dcmls_status: 'error',
      dcmls_published_at: currentDcmlsPublishedAt,
      dcmls_last_updated_at: now,
      dcmls_error: `Missing required fields for DCMLS: ${errors.join(', ')}`,
    };
  }

  return {
    publish_to_dcmls: true,
    dcmls_status: 'published',
    dcmls_published_at: currentDcmlsPublishedAt || now, // first publish
    dcmls_last_updated_at: now,
    dcmls_error: null,
  };
}

import { useQuery } from "@tanstack/react-query";
import { getListingDetail, RepliersApiError } from "@/lib/repliers";

/**
 * React Query hook for single Repliers listing detail
 * 
 * Server-side cache: ~120 seconds
 * Client-side stale time: 60 seconds
 */
export function useRepliersListing(
  listingId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: ["repliers", "listing", listingId],
    queryFn: () => getListingDetail(listingId!),
    enabled: !!listingId && (options.enabled !== false),
    staleTime: 60 * 1000, // 60 seconds (server caches for 120s)
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors (including 404)
      if (error instanceof RepliersApiError && error.status >= 400 && error.status < 500) {
        return false;
      }
      // Retry once on 5xx errors
      return failureCount < 1;
    },
    ...options,
  });
}

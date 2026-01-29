import { useQuery } from "@tanstack/react-query";
import { searchListings, RepliersListingsParams, RepliersApiError } from "@/lib/repliers";

/**
 * React Query hook for Repliers listings search
 * 
 * Server-side cache: ~60 seconds
 * Client-side stale time: 30 seconds
 */
export function useRepliersListings(
  params: RepliersListingsParams = {},
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: ["repliers", "listings", params],
    queryFn: () => searchListings(params),
    staleTime: 30 * 1000, // 30 seconds (server caches for 60s)
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error instanceof RepliersApiError && error.status >= 400 && error.status < 500) {
        return false;
      }
      // Retry once on 5xx errors
      return failureCount < 1;
    },
    ...options,
  });
}

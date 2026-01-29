import { useQuery } from "@tanstack/react-query";
import { autocomplete, RepliersApiError } from "@/lib/repliers";

/**
 * React Query hook for Repliers location/address autocomplete
 * 
 * Server-side cache: ~300 seconds
 * Client-side stale time: 120 seconds
 * Minimum query length: 2 characters
 */
export function useRepliersAutocomplete(
  query: string,
  options: { enabled?: boolean } = {}
) {
  const trimmedQuery = query?.trim() || "";
  const shouldFetch = trimmedQuery.length >= 2;
  
  return useQuery({
    queryKey: ["repliers", "autocomplete", trimmedQuery],
    queryFn: () => autocomplete(trimmedQuery),
    enabled: shouldFetch && (options.enabled !== false),
    staleTime: 120 * 1000, // 2 minutes (server caches for 5 min)
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error instanceof RepliersApiError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 1;
    },
    ...options,
  });
}

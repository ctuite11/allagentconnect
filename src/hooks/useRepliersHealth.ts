import { useQuery } from "@tanstack/react-query";
import { checkHealth } from "@/lib/repliers";

/**
 * React Query hook for Repliers health check
 * Use for debugging/smoke testing only
 */
export function useRepliersHealth(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["repliers", "health"],
    queryFn: checkHealth,
    staleTime: 60 * 1000, // 1 minute
    retry: false, // Health checks shouldn't retry
    ...options,
  });
}

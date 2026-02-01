import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Module-level cache for feature flags.
 * Persists across component re-renders within the same session.
 * Prevents repeated RPC calls for the same flag.
 */
const flagCache = new Map<string, { value: boolean; fetching: boolean }>();

/**
 * Hook to check if a feature flag is enabled.
 * Uses session-level caching to avoid repeated RPC calls.
 * 
 * @param flagName - The name of the feature flag to check
 * @returns { enabled: boolean, loading: boolean }
 */
export const useFeatureFlag = (flagName: string) => {
  const cached = flagCache.get(flagName);
  
  const [enabled, setEnabled] = useState<boolean>(cached?.value ?? false);
  const [loading, setLoading] = useState<boolean>(!cached || cached.fetching);

  useEffect(() => {
    const checkFlag = async () => {
      // Check cache first
      const cachedValue = flagCache.get(flagName);
      
      if (cachedValue && !cachedValue.fetching) {
        // Already have a cached result
        setEnabled(cachedValue.value);
        setLoading(false);
        return;
      }

      // Mark as fetching to prevent duplicate calls (normalize state before RPC)
      flagCache.set(flagName, { value: cachedValue?.value ?? false, fetching: true });

      try {
        const { data, error } = await supabase.rpc("is_feature_enabled", {
          p_flag_name: flagName,
        });

        if (error) {
          console.error(`[useFeatureFlag] Error checking ${flagName}:`, error);
          flagCache.set(flagName, { value: false, fetching: false });
          setEnabled(false);
        } else {
          const isEnabled = data === true;
          flagCache.set(flagName, { value: isEnabled, fetching: false });
          setEnabled(isEnabled);
        }
      } catch (err) {
        console.error(`[useFeatureFlag] Exception checking ${flagName}:`, err);
        flagCache.set(flagName, { value: false, fetching: false });
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    checkFlag();
  }, [flagName]);

  return { enabled, loading };
};

/**
 * Clear the feature flag cache (useful for testing or session refresh).
 */
export const clearFeatureFlagCache = () => {
  flagCache.clear();
};

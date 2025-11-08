import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to track listing views
 * Automatically records a view when the component mounts
 */
export const useListingView = (listingId: string | undefined) => {
  useEffect(() => {
    if (!listingId) return;

    const trackView = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Get client IP (this is a simplified version, in production you might want a more robust solution)
        const viewerIp = 'unknown';
        
        // Insert view record
        const { error } = await supabase
          .from("listing_views")
          .insert({
            listing_id: listingId,
            viewer_id: user?.id || null,
            viewer_ip: viewerIp
          });

        if (error && error.code !== '23505') { // Ignore duplicate key errors if you want to prevent multiple views
          console.error("Error tracking view:", error);
        }
      } catch (error) {
        console.error("Error tracking view:", error);
      }
    };

    trackView();
  }, [listingId]);
};

import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches listing IDs within a radius from a given origin point.
 * Returns null if no radius filtering should be applied.
 */
export async function getListingIdsWithinRadius(
  originLat: string,
  originLng: string,
  radius: string,
  radiusUnit: "miles" | "km"
): Promise<string[] | null> {
  const lat = parseFloat(originLat);
  const lng = parseFloat(originLng);
  const rad = parseFloat(radius);

  if (!lat || !lng || !rad || rad <= 0) return null;

  // Convert km to miles if needed
  const radiusMiles = radiusUnit === "km" ? rad * 0.621371 : rad;

  const { data, error } = await supabase.rpc("listings_within_radius", {
    origin_lat: lat,
    origin_lng: lng,
    radius_miles: radiusMiles,
  });

  if (error) {
    console.error("Radius filter error:", error);
    return null;
  }

  return (data || []).map((row: { listing_id: string }) => row.listing_id);
}

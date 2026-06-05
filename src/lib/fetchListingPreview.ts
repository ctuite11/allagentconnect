import { supabase } from "@/integrations/supabase/client";
import { resolveFirstListingPhotoUrl } from "@/lib/resolveListingPhotoUrl";
import type { ListingPreview } from "@/components/share/ShareListingsDialog";

export async function fetchListingPreview(listingId: string): Promise<ListingPreview | undefined> {
  const { data, error } = await supabase
    .from("listings")
    .select("address, city, state, zip_code, price, bedrooms, bathrooms, square_feet, photos")
    .eq("id", listingId)
    .maybeSingle();

  if (error || !data) return undefined;

  return {
    address: data.address,
    cityStateZip: `${data.city}, ${data.state} ${data.zip_code}`,
    price: data.price ? `$${data.price.toLocaleString()}` : undefined,
    beds: data.bedrooms ?? undefined,
    baths: data.bathrooms ?? undefined,
    sqft: data.square_feet ?? undefined,
    photoUrl: resolveFirstListingPhotoUrl(data.photos),
  };
}

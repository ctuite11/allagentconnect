import { formatListingPriceDisplay } from "@/lib/formatListingPriceDisplay";
import { fetchPublicListing } from "@/lib/publicListing";
import { resolveFirstListingPhotoUrl } from "@/lib/resolveListingPhotoUrl";
import type { ListingPreview } from "@/components/share/ShareListingsDialog";

/**
 * Listing card preview for share/contact dialogs.
 * Uses the public marketing RPC so anonymous guests do not need
 * `listings.select(...)` (and so Phase 3 lockdown will not break previews).
 */
export async function fetchListingPreview(listingId: string): Promise<ListingPreview | undefined> {
  try {
    const data = await fetchPublicListing(listingId);
    if (!data) return undefined;

    const priceDisplay = formatListingPriceDisplay({
      price: data.price,
      price_range_min: data.price_range_min,
      price_range_max: data.price_range_max,
    });

    return {
      address: data.address,
      cityStateZip: `${data.city}, ${data.state} ${data.zip_code}`,
      price: priceDisplay ?? undefined,
      beds: data.bedrooms ?? undefined,
      baths: data.bathrooms ?? undefined,
      sqft: data.square_feet ?? undefined,
      photoUrl: resolveFirstListingPhotoUrl(data.photos),
    };
  } catch (error) {
    console.error("fetchListingPreview failed:", error);
    return undefined;
  }
}

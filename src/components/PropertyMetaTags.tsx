import { Helmet } from 'react-helmet-async';
import { getListingPublicUrl } from '@/lib/getPublicUrl';
import { resolveListingPhotoUrl } from '@/lib/resolveListingPhotoUrl';

const FALLBACK_OG_IMAGE = "https://allagentconnect.com/og/aac-og-2026-01-22.jpg";

interface PropertyMetaTagsProps {
  address: string;
  city: string;
  state: string;
  /** Pre-formatted price; falls back to numeric `price` when omitted. */
  priceDisplay?: string | null;
  price?: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  photo: string | null;
  listingType: string;
  listingId: string;
}

export const PropertyMetaTags = ({
  address,
  city,
  state,
  priceDisplay,
  price,
  bedrooms,
  bathrooms,
  description,
  photo,
  listingType,
  listingId,
}: PropertyMetaTagsProps) => {
  const title = `${address}, ${city}, ${state} - All Agent Connect`;
  const basePrice =
    priceDisplay ??
    (price != null && price > 0 ? `$${price.toLocaleString()}` : null);
  const priceText =
    basePrice == null
      ? "Price on request"
      : listingType === "for_rent"
        ? `${basePrice}/month`
        : basePrice;
  
  const metaDescription = description 
    ? `${priceText} - ${bedrooms} bed, ${bathrooms} bath. ${description.substring(0, 120)}...`
    : `${priceText} - ${bedrooms} bed, ${bathrooms} bath property in ${city}, ${state}`;

  const resolvedPhoto = resolveListingPhotoUrl(photo);
  const imageUrl = resolvedPhoto ?? FALLBACK_OG_IMAGE;
  const imageType = imageUrl.toLowerCase().includes(".png") ? "image/png" : "image/jpeg";
  const canonicalUrl = getListingPublicUrl(listingId);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:secure_url" content={imageUrl} />
      <meta property="og:image:type" content={imageType} />
      <meta property="og:image:alt" content={`Photo of ${address}`} />
      <meta property="og:site_name" content="All Agent Connect" />
      <meta property="og:locale" content="en_US" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={`Photo of ${address}`} />
    </Helmet>
  );
};

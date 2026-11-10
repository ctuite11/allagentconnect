import type { FC } from "react";
import { Seo } from "@/components/Seo";

interface PropertyMetaTagsProps {
  address: string;
  city: string;
  state: string;
  /** Pre-formatted price; falls back to numeric `price` when omitted. */
  priceDisplay?: string | null;
  price?: number | null;
  /** Range endpoints, used when no fixed `price` and no `priceDisplay` is supplied. */
  priceRangeMin?: number | null;
  priceRangeMax?: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  photo: string | null;
  listingType: string;
  listingId: string;
}

export const PropertyMetaTags: FC<PropertyMetaTagsProps> = () => (
  <Seo title="Private shared link" description="Secure access through All Agent Connect." noindex />
);

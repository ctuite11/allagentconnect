import { useMemo } from "react";
import { ListingCoverImage } from "@/components/ListingCoverImage";
import { resolveFirstListingPhotoUrl } from "@/lib/resolveListingPhotoUrl";

export interface ListingRecord {
  id: string;
  agent_id?: string | null;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  price_range_min?: number | null;
  price_range_max?: number | null;
  status: string;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  latitude?: number | null;
  longitude?: number | null;
  photos?: string[] | null;
  list_office?: string | null;
  office_name?: string | null;
  created_at?: string | null;
  list_date?: string | null;
  active_date?: string | null;
}

export interface AgentOfficeRecord {
  id: string;
  company?: string | null;
  office_name?: string | null;
}

export function getPrimaryPhotoUrl(photos: unknown): string | null {
  return resolveFirstListingPhotoUrl(photos) ?? null;
}

export function formatBrokerageLine(listOffice?: string | null): string | null {
  const normalized = listOffice?.trim();
  if (!normalized) return null;
  if (/^(listed by|listing courtesy of)\b/i.test(normalized)) return normalized;
  return `Listed by ${normalized}`;
}

export function resolveListingBrokerage(listing: ListingRecord): string | null {
  return listing.list_office?.trim() || listing.office_name?.trim() || null;
}

export function ListingImage({ photos, alt }: { photos?: unknown; alt: string }) {
  const src = useMemo(() => getPrimaryPhotoUrl(photos), [photos]);

  return <ListingCoverImage src={src} alt={alt} />;
}

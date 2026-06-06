import { useEffect, useMemo, useState } from "react";

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
  if (!Array.isArray(photos) || photos.length === 0) return null;

  const first = photos[0] as unknown;
  if (typeof first === "string") {
    const trimmed = first.trim();
    return trimmed ? trimmed : null;
  }

  if (first && typeof first === "object") {
    const candidate = first as { url?: unknown; src?: unknown; image_url?: unknown };
    const raw = candidate.url ?? candidate.src ?? candidate.image_url;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      return trimmed ? trimmed : null;
    }
  }

  return null;
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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-100 via-zinc-100 to-zinc-200/80">
        <div className="text-[11px] font-medium text-zinc-500">Photo unavailable</div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

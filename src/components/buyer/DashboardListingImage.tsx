import { useState } from "react";
import {
  LISTING_PHOTO_PLACEHOLDER,
  isListingPhotoPlaceholder,
} from "@/lib/resolveListingPhotoUrl";

/** Listing photo or AAC listing placeholder. `neutral` = empty white cell (hot sheet mosaics). */
export function DashboardListingImage({
  photoUrl,
  alt,
  imageClassName = "h-full w-full object-cover",
  emptyFallback = "placeholder",
}: {
  photoUrl: string;
  alt: string;
  imageClassName?: string;
  /** `neutral` — blank cell for collage tiles (no listing placeholder). */
  emptyFallback?: "placeholder" | "neutral" | "monogram";
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const hasRealPhoto =
    Boolean(photoUrl?.trim()) && !isListingPhotoPlaceholder(photoUrl) && !loadFailed;

  if (!hasRealPhoto) {
    if (emptyFallback === "neutral") {
      return <div className={`${imageClassName} bg-white`} aria-hidden />;
    }
    // `monogram` kept as alias → same AAC listing placeholder for consistency
    return (
      <img
        src={LISTING_PHOTO_PLACEHOLDER}
        alt={alt}
        className={`${imageClassName} object-contain bg-[#F4F6F8]`}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <img
      src={photoUrl}
      alt={alt}
      className={imageClassName}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setLoadFailed(true)}
    />
  );
}

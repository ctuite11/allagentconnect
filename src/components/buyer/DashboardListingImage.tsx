import { useState } from "react";
import AACMonogram from "@/components/ui/AACMonogram";

/** Listing photo or fallback — default monogram; `neutral` = empty white cell (hot sheet mosaics). */
export function DashboardListingImage({
  photoUrl,
  alt,
  imageClassName = "h-full w-full object-cover",
  emptyFallback = "monogram",
}: {
  photoUrl: string;
  alt: string;
  imageClassName?: string;
  /** `neutral` — blank cell for collage tiles (no AAC monogram). */
  emptyFallback?: "monogram" | "neutral";
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const useFallback = !photoUrl || photoUrl === "/placeholder.svg" || loadFailed;
  if (useFallback) {
    if (emptyFallback === "neutral") {
      return <div className={`${imageClassName} bg-white`} aria-hidden />;
    }
    return (
      <div className="flex h-full w-full items-center justify-center bg-white text-neutral-500" aria-hidden>
        <AACMonogram className="h-7 w-7" size={28} />
      </div>
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

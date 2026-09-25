import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import {
  LISTING_PHOTO_PLACEHOLDER,
  isListingPhotoPlaceholder,
} from "@/lib/resolveListingPhotoUrl";

type ListingCoverImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  /** Resolved photo URL, or null/undefined/empty when missing. */
  src?: string | null;
};

/**
 * Shared listing cover/hero image. Falls back to the AAC listing placeholder
 * when there is no usable photo or the image fails to load.
 * Display-only — never persists the placeholder into listing data.
 */
export function ListingCoverImage({
  src,
  alt = "",
  className,
  onError,
  ...rest
}: ListingCoverImageProps) {
  const initial =
    src?.trim() && !isListingPhotoPlaceholder(src) ? src.trim() : LISTING_PHOTO_PLACEHOLDER;
  const [failed, setFailed] = useState(false);

  // Reset error fallback when the incoming src changes (e.g. carousel next photo).
  useEffect(() => {
    setFailed(false);
  }, [initial]);

  const displaySrc = failed ? LISTING_PHOTO_PLACEHOLDER : initial;

  return (
    <img
      {...rest}
      src={displaySrc}
      alt={alt}
      className={cn(
        "h-full w-full object-cover",
        isListingPhotoPlaceholder(displaySrc) && "object-contain bg-[#F4F6F8]",
        className,
      )}
      onError={(e) => {
        if (!failed) setFailed(true);
        onError?.(e);
      }}
    />
  );
}

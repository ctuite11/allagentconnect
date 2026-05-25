import type { MouseEvent } from "react";
import { MapPin } from "lucide-react";
import { buildDisplayAddress, cn, type ListingAddressUnitSource } from "@/lib/utils";

/** AAC premium compact address row — Inter, 13px normal, emerald MapPin, single formatted line. */
export const LISTING_CARD_ADDRESS_ROW_CLASS =
  "flex min-h-[2.25rem] min-w-0 items-center gap-1";

export const LISTING_CARD_MAP_PIN_CLASS =
  "h-3.5 w-3.5 shrink-0 text-[#50C878]";

export const LISTING_CARD_ADDRESS_TEXT_CLASS =
  "min-w-0 flex-1 break-words font-sans text-[13px] font-normal leading-[1.35] text-neutral-800";

type ListingCardAddressLineProps = {
  listing: ListingAddressUnitSource;
  className?: string;
  onClick?: (e: MouseEvent) => void;
  /** When set, the address links to Google Maps (e.g. search list). */
  mapsHref?: string;
};

export function ListingCardAddressLine({
  listing,
  className,
  onClick,
  mapsHref,
}: ListingCardAddressLineProps) {
  const displayAddress = buildDisplayAddress(listing);

  const addressText = mapsHref ? (
    <a
      href={mapsHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(LISTING_CARD_ADDRESS_TEXT_CLASS, "transition-colors hover:text-neutral-900")}
    >
      {displayAddress}
    </a>
  ) : (
    <p className={LISTING_CARD_ADDRESS_TEXT_CLASS}>{displayAddress}</p>
  );

  return (
    <div
      className={cn(LISTING_CARD_ADDRESS_ROW_CLASS, onClick && !mapsHref && "cursor-pointer", className)}
      onClick={!mapsHref ? onClick : undefined}
    >
      <MapPin className={LISTING_CARD_MAP_PIN_CLASS} aria-hidden strokeWidth={2} />
      {addressText}
    </div>
  );
}

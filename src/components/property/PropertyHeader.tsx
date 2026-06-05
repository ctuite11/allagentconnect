import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { LISTING_CARD_MAP_PIN_CLASS } from "@/components/listing/ListingCardAddressLine";
import {
  propertyPageContainer,
  propertyMediaCol,
  propertyHeaderRow,
  propertyAddressH1,
  propertyPriceText,
} from "./propertyTokens";

interface PropertyHeaderProps {
  address: React.ReactNode;
  /** Pre-formatted price label, e.g. `$900,000 – $1,050,000` */
  priceDisplay?: string | null;
  /** e.g. "/ mo" for rentals; appended after price */
  priceSuffix?: React.ReactNode;
  className?: string;
  /** Render only the inner row — parent column controls width (buyer listing page). */
  embedded?: boolean;
}

function PropertyHeaderRow({
  address,
  priceDisplay,
  priceSuffix,
}: Pick<PropertyHeaderProps, "address" | "priceDisplay" | "priceSuffix">) {
  return (
    <div className={cn(propertyHeaderRow, "w-full")}>
      <h1 className={cn(propertyAddressH1, "min-w-0 flex-1")}>
        <MapPin className={cn(LISTING_CARD_MAP_PIN_CLASS, "relative top-[1px]")} aria-hidden strokeWidth={2} />
        {address}
      </h1>
      <p className={cn(propertyPriceText, "shrink-0 text-right tabular-nums")}>
        {priceDisplay ?? "—"}
        {priceSuffix && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {priceSuffix}
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * Address (left) + price (right), spanning the photo column above the gallery.
 */
export function PropertyHeader({
  address,
  priceDisplay,
  priceSuffix,
  className,
  embedded = false,
}: PropertyHeaderProps) {
  if (embedded) {
    return (
      <div className={className}>
        <PropertyHeaderRow address={address} priceDisplay={priceDisplay} priceSuffix={priceSuffix} />
      </div>
    );
  }

  return (
    <div className={cn(propertyPageContainer, "pb-2", className)}>
      <div className={cn(propertyMediaCol, "w-full")}>
        <PropertyHeaderRow address={address} priceDisplay={priceDisplay} priceSuffix={priceSuffix} />
      </div>
    </div>
  );
}

export default PropertyHeader;

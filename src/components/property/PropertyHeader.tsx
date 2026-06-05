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
  price: number | null | undefined;
  /** e.g. "/ mo" for rentals; appended after price */
  priceSuffix?: React.ReactNode;
  className?: string;
  /** Render only the inner row — parent column controls width (buyer listing page). */
  embedded?: boolean;
}

function PropertyHeaderRow({
  address,
  price,
  priceSuffix,
}: Pick<PropertyHeaderProps, "address" | "price" | "priceSuffix">) {
  return (
    <div className={cn(propertyHeaderRow, "w-full")}>
      <h1 className={cn(propertyAddressH1, "min-w-0 flex-1")}>
        <MapPin className={cn(LISTING_CARD_MAP_PIN_CLASS, "relative top-[1px]")} aria-hidden strokeWidth={2} />
        {address}
      </h1>
      <p className={cn(propertyPriceText, "shrink-0 text-right tabular-nums")}>
        ${price?.toLocaleString() ?? "—"}
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
  price,
  priceSuffix,
  className,
  embedded = false,
}: PropertyHeaderProps) {
  if (embedded) {
    return (
      <div className={className}>
        <PropertyHeaderRow address={address} price={price} priceSuffix={priceSuffix} />
      </div>
    );
  }

  return (
    <div className={cn(propertyPageContainer, "pb-2", className)}>
      <div className={cn(propertyMediaCol, "w-full")}>
        <PropertyHeaderRow address={address} price={price} priceSuffix={priceSuffix} />
      </div>
    </div>
  );
}

export default PropertyHeader;

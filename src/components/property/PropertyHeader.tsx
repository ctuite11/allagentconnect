import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { LISTING_CARD_MAP_PIN_CLASS } from "@/components/listing/ListingCardAddressLine";
import {
  propertyPageContainer,
  propertyMediaCol,
  propertyAddressH1,
  propertyPriceText,
} from "./propertyTokens";

interface PropertyHeaderProps {
  address: React.ReactNode;
  price: number | null | undefined;
  /** e.g. "/ mo" for rentals; appended after price */
  priceSuffix?: React.ReactNode;
  className?: string;
}

/**
 * Address + price above the buyer listing hero, left-aligned with the photo column.
 */
export function PropertyHeader({
  address,
  price,
  priceSuffix,
  className,
}: PropertyHeaderProps) {
  return (
    <div className={cn(propertyPageContainer, "pb-2", className)}>
      <div className={propertyMediaCol}>
        <div className="space-y-1">
          <h1 className={propertyAddressH1}>
            <MapPin className={cn(LISTING_CARD_MAP_PIN_CLASS, "relative top-[1px]")} aria-hidden strokeWidth={2} />
            {address}
          </h1>
          <p className={propertyPriceText}>
            ${price?.toLocaleString() ?? "—"}
            {priceSuffix && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {priceSuffix}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default PropertyHeader;

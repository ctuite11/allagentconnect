import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
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
}

/**
 * Address (left) + Price (right), constrained to the media column width.
 * Shared shell used by both PropertyDetail and ConsumerPropertyDetail.
 */
export function PropertyHeader({
  address,
  price,
  priceSuffix,
  className,
}: PropertyHeaderProps) {
  return (
    <div className={cn(propertyPageContainer, "pb-2", className)}>
      <div className={cn(propertyMediaCol, "pr-2")}>
        <div className={propertyHeaderRow}>
          <h1 className={propertyAddressH1}>
            <MapPin className="w-4 h-4 text-emerald-500 shrink-0 relative top-[1px]" />
            {address}
          </h1>
          <div className="text-right">
            <p className={propertyPriceText}>
              ${price?.toLocaleString() ?? "—"}
              {priceSuffix && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  {priceSuffix}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PropertyHeader;

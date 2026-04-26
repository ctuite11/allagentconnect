import { Bed, Bath, Square, DollarSign, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  propertyFactsRow,
  propertyFactItem,
  propertyFactValue,
  propertyFactLabel,
  propertyFactIcon,
} from "./propertyTokens";

interface PropertyFactsRowProps {
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFeet?: number | null;
  price?: number | null;
  daysOnMarket?: number | null;
  /** Merges into the row container (border-b, flex, etc.) */
  className?: string;
  /** Spacing / wrapper above the stats row (default mt-4) */
  containerClassName?: string;
}

/**
 * Compact AAC-style facts row: Beds · Baths · Sq Ft · $/sf · DOM.
 * Each item only renders if data is present.
 */
export function PropertyFactsRow({
  bedrooms,
  bathrooms,
  squareFeet,
  price,
  daysOnMarket,
  className,
  containerClassName,
}: PropertyFactsRowProps) {
  const pricePerSqft =
    price && squareFeet && squareFeet > 0
      ? Math.round(price / squareFeet)
      : null;

  return (
    <div className={cn("mt-4", containerClassName)}>
      <div className={cn(propertyFactsRow, className)}>
        {bedrooms != null && bedrooms > 0 && (
          <div className={propertyFactItem}>
            <Bed className={propertyFactIcon} />
            <span className={propertyFactValue}>{bedrooms}</span>
            <span className={propertyFactLabel}>Beds</span>
          </div>
        )}
        {bathrooms != null && bathrooms > 0 && (
          <div className={propertyFactItem}>
            <Bath className={propertyFactIcon} />
            <span className={propertyFactValue}>{bathrooms}</span>
            <span className={propertyFactLabel}>Baths</span>
          </div>
        )}
        {squareFeet != null && squareFeet > 0 && (
          <div className={propertyFactItem}>
            <Square className={propertyFactIcon} />
            <span className={propertyFactValue}>
              {squareFeet.toLocaleString()}
            </span>
            <span className={propertyFactLabel}>Sq Ft</span>
          </div>
        )}
        {pricePerSqft != null && (
          <div className={propertyFactItem}>
            <DollarSign className={propertyFactIcon} />
            <span className={propertyFactValue}>
              ${pricePerSqft.toLocaleString()}
            </span>
            <span className={propertyFactLabel}>/sf</span>
          </div>
        )}
        {daysOnMarket != null && (
          <div className={propertyFactItem}>
            <Calendar className={propertyFactIcon} />
            <span className={propertyFactValue}>{daysOnMarket}</span>
            <span className={propertyFactLabel}>DOM</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default PropertyFactsRow;

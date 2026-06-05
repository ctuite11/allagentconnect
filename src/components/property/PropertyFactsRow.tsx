import { Bed, Bath, Square, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  propertyFactsRow,
  propertyFactItem,
  propertyFactValue,
  propertyFactIcon,
} from "./propertyTokens";

interface PropertyFactsRowProps {
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFeet?: number | null;
  garageSpaces?: number | null;
  /** Merges into the row container (border-b, flex, etc.) */
  className?: string;
  /** Spacing / wrapper above the stats row (default mt-4) */
  containerClassName?: string;
}

/**
 * Buyer listing detail stats: icon + value only (no text labels).
 */
export function PropertyFactsRow({
  bedrooms,
  bathrooms,
  squareFeet,
  garageSpaces,
  className,
  containerClassName,
}: PropertyFactsRowProps) {
  const iconCls = cn(propertyFactIcon, "text-[#0E56F5]");

  return (
    <div className={cn(containerClassName)}>
      <div className={cn(propertyFactsRow, "gap-x-5 gap-y-2 border-b-0 pb-0", className)}>
        {bedrooms != null && bedrooms > 0 && (
          <div className={propertyFactItem}>
            <Bed className={iconCls} aria-hidden />
            <span className={propertyFactValue}>{bedrooms}</span>
          </div>
        )}
        {bathrooms != null && bathrooms > 0 && (
          <div className={propertyFactItem}>
            <Bath className={iconCls} aria-hidden />
            <span className={propertyFactValue}>{bathrooms}</span>
          </div>
        )}
        {squareFeet != null && squareFeet > 0 && (
          <div className={propertyFactItem}>
            <Square className={iconCls} aria-hidden />
            <span className={propertyFactValue}>{squareFeet.toLocaleString()}</span>
          </div>
        )}
        {garageSpaces != null && garageSpaces > 0 && (
          <div className={propertyFactItem}>
            <Car className={iconCls} aria-hidden />
            <span className={propertyFactValue}>{garageSpaces}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default PropertyFactsRow;

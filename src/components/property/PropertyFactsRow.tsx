import { Bed, Bath, Square, CircleParking } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  propertyFactsRow,
  propertyFactItem,
  propertyFactValue,
  propertyFactLabel,
  propertyFactIcon,
} from "./propertyTokens";

/** Matches neighborhood pill / expand control inset inside the photo (`left-4` / `right-4`). */
export const propertyPhotoContentInset = "px-4";

interface PropertyFactsRowProps {
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFeet?: number | null;
  totalParkingSpaces?: number | null;
  daysOnMarket?: number | null;
  /** Renders before bed/bath/etc. stats on the same row */
  propertyTypeLabel?: string | null;
  /** Merges into the row container (border-b, flex, etc.) */
  className?: string;
  /** Spacing / wrapper above the stats row */
  containerClassName?: string;
}

/**
 * Buyer listing detail stats: icon + value only (left group under photo).
 */
export function PropertyFactsRow({
  bedrooms,
  bathrooms,
  squareFeet,
  totalParkingSpaces,
  daysOnMarket,
  propertyTypeLabel,
  className,
  containerClassName,
}: PropertyFactsRowProps) {
  const iconCls = cn(propertyFactIcon, "text-[#0E56F5]");

  return (
    <div className={cn(containerClassName)}>
      <div className={cn("mt-0 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2", className)}>
        {propertyTypeLabel ? (
          <div className={propertyFactItem}>
            <span className={cn(propertyFactLabel, "text-neutral-600")}>Property Type:</span>
            <span className={cn(propertyFactValue, "text-sm text-neutral-900")}>{propertyTypeLabel}</span>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
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
          <div className={propertyFactItem}>
            <CircleParking className={iconCls} aria-hidden />
            <span className={propertyFactValue}>{totalParkingSpaces ?? 0}</span>
          </div>
          {daysOnMarket != null && daysOnMarket >= 0 && (
            <div className={propertyFactItem}>
              <span className={cn(propertyFactLabel, "text-neutral-500")}>DOM</span>
              <span className={propertyFactValue}>{daysOnMarket}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PropertyFactsRow;

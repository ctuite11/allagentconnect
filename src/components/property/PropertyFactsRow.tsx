import { Bed, Bath, Square, CircleParking } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
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

  const groups: ReactNode[] = [];

  if (propertyTypeLabel) {
    groups.push(
      <div key="type" className={cn(propertyFactItem, "shrink-0 whitespace-nowrap basis-full lg:basis-auto")}>
        <span className={cn(propertyFactLabel, "text-neutral-600")}>Property Type:</span>
        <span className={cn(propertyFactValue, "text-sm text-neutral-900")}>{propertyTypeLabel}</span>
      </div>,
    );
  }
  if (bedrooms != null && bedrooms > 0) {
    groups.push(
      <div key="beds" className={cn(propertyFactItem, "shrink-0 whitespace-nowrap")}>
        <Bed className={iconCls} aria-hidden />
        <span className={propertyFactValue}>{bedrooms}</span>
      </div>,
    );
  }
  if (bathrooms != null && bathrooms > 0) {
    groups.push(
      <div key="baths" className={cn(propertyFactItem, "shrink-0 whitespace-nowrap")}>
        <Bath className={iconCls} aria-hidden />
        <span className={propertyFactValue}>{bathrooms}</span>
      </div>,
    );
  }
  if (squareFeet != null && squareFeet > 0) {
    groups.push(
      <div key="sqft" className={cn(propertyFactItem, "shrink-0 whitespace-nowrap")}>
        <Square className={iconCls} aria-hidden />
        <span className={propertyFactValue}>{squareFeet.toLocaleString()}</span>
      </div>,
    );
  }
  groups.push(
    <div key="parking" className={cn(propertyFactItem, "shrink-0 whitespace-nowrap")}>
      <CircleParking className={iconCls} aria-hidden />
      <span className={propertyFactValue}>{totalParkingSpaces ?? 0}</span>
    </div>,
  );
  if (daysOnMarket != null && daysOnMarket >= 0) {
    groups.push(
      <div key="dom" className={cn(propertyFactItem, "shrink-0 whitespace-nowrap")}>
        <span className={cn(propertyFactLabel, "text-neutral-500")}>DOM</span>
        <span className={propertyFactValue}>{daysOnMarket}</span>
      </div>,
    );
  }

  return (
    <div className={cn(containerClassName)}>
      <div
        className={cn(
          "mt-0 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2.5 border-b-0 pb-0 lg:flex-nowrap lg:gap-x-9 lg:overflow-x-auto lg:[&::-webkit-scrollbar]:hidden",
          className,
        )}
      >
        {groups}
      </div>
    </div>
  );
}

export default PropertyFactsRow;

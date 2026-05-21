import { cn } from "@/lib/utils";
import { formatListingPropertyTypeLabel } from "@/lib/format";

type ListingCardPropertyTypeLineProps = {
  propertyType?: string | null;
  className?: string;
};

/** Inline property type under price on compact listing cards. */
export function ListingCardPropertyTypeLine({
  propertyType,
  className,
}: ListingCardPropertyTypeLineProps) {
  const label = formatListingPropertyTypeLabel(propertyType);
  if (!label) return null;

  return (
    <p className={cn("truncate text-[13px] font-semibold leading-tight text-neutral-700", className)}>
      {label}
    </p>
  );
}

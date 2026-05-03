import type { ComponentProps } from "react";
import ListingCard from "@/components/ListingCard";
import { cn } from "@/lib/utils";

export type SuccessHubListingCardProps = Omit<
  ComponentProps<typeof ListingCard>,
  "viewMode" | "showActions" | "isFavorites"
>;

/**
 * Success Hub listing tile — standard `ListingCard` compact only.
 * No typography/icon overrides (those caused cross-surface regressions).
 */
export function SuccessHubListingCard({ hideMlsMeta, className, ...rest }: SuccessHubListingCardProps) {
  return (
    <div className={cn("min-w-0 max-w-full", className)}>
      <ListingCard
        {...rest}
        viewMode="compact"
        showActions={false}
        hideMlsMeta={hideMlsMeta ?? true}
        isFavorites
      />
    </div>
  );
}

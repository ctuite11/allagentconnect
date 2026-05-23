import type { ComponentProps } from "react";
import ListingCard from "@/components/ListingCard";
import { cn } from "@/lib/utils";

export type SuccessHubListingCardProps = Omit<
  ComponentProps<typeof ListingCard>,
  "viewMode" | "showActions" | "isFavorites" | "compactListingDetailTo"
> & {
  className?: string;
  /** When set, the whole compact card navigates here (e.g. `/agent/listings` on Success Hub «My listings»). */
  compactClickTo?: string;
};

/**
 * Success Hub listing tile — standard `ListingCard` compact only.
 * No typography/icon overrides (those caused cross-surface regressions).
 * Pass `compactAgentOwned` for agent-owned grids (Success Hub «My listings»): no favorites overlay, single photo, no promo banners — same compact shell as market/search.
 */
export function SuccessHubListingCard({
  hideMlsMeta,
  className,
  compactClickTo,
  ...rest
}: SuccessHubListingCardProps) {
  return (
    <div className={cn("min-w-0 max-w-full", compactClickTo && "cursor-pointer", className)}>
      <ListingCard
        {...rest}
        viewMode="compact"
        showActions={false}
        hideMlsMeta={hideMlsMeta ?? false}
        isFavorites
        compactListingDetailTo={compactClickTo}
      />
    </div>
  );
}

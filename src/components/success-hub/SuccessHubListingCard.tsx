import type { ComponentProps } from "react";
import ListingCard from "@/components/ListingCard";
import { successHubListingAttributionProps } from "@/components/success-hub/listingCardAdapter";
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
 * Agent-only surfaces: always shows brokerage + listing-agent email strip when data exists.
 * Pass `compactAgentOwned` for Success Hub «My listings» (no favorites chrome on photo).
 */
export function SuccessHubListingCard({
  hideMlsMeta,
  className,
  compactClickTo,
  listing,
  showAgentEmailContact = true,
  listingAgentContact: listingAgentContactProp,
  listingEmailSubject: listingEmailSubjectProp,
  ...rest
}: SuccessHubListingCardProps) {
  const resolvedAttribution = successHubListingAttributionProps(listing);

  return (
    <div className={cn("min-w-0 max-w-full", compactClickTo && "cursor-pointer", className)}>
      <ListingCard
        {...rest}
        listing={listing}
        viewMode="compact"
        showActions={false}
        hideMlsMeta={hideMlsMeta ?? false}
        isFavorites
        compactListingDetailTo={compactClickTo}
        showAgentEmailContact={showAgentEmailContact}
        listingAgentContact={listingAgentContactProp ?? resolvedAttribution.listingAgentContact}
        listingEmailSubject={listingEmailSubjectProp ?? resolvedAttribution.listingEmailSubject}
      />
    </div>
  );
}

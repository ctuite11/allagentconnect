import type { ComponentProps } from "react";
import ListingCard from "@/components/ListingCard";
import { cn } from "@/lib/utils";

/**
 * Success Hub–scoped compact listing tile: buyer favorites–style (`isFavorites`) + typography/image
 * overrides so cards match dashboard density (not oversized search-result emphasis).
 */
export const SUCCESS_HUB_LISTING_CARD_SCOPE =
  "min-w-0 max-w-full " +
  "[&_img]:!h-40 [&_div.h-48]:!h-40 [&_div.h-48]:!max-h-40 " +
  "[&_p.font-bold.text-neutral-950]:!text-lg [&_p.font-bold.text-neutral-950]:!font-semibold " +
  "[&_p.font-medium.text-sm]:!text-[15px] [&_p.font-medium.text-sm]:!font-normal [&_p.font-medium.text-sm]:!leading-snug " +
  "[&_div.flex.items-center.gap-6.mt-1]:!gap-3 [&_div.flex.items-center.gap-6.mt-1]:!text-sm [&_div.flex.items-center.gap-6.mt-1]:!text-neutral-700 " +
  "[&_div.flex.items-center.gap-6.mt-1_span]:!text-sm [&_div.flex.items-center.gap-6.mt-1_span]:!font-medium " +
  "[&_div.flex.items-center.gap-6.mt-1_svg]:!h-3.5 [&_div.flex.items-center.gap-6.mt-1_svg]:!w-3.5 " +
  "[&>div.rounded-lg]:!shadow-none [&>div.rounded-lg]:hover:!shadow-sm";

export type SuccessHubListingCardProps = Omit<
  ComponentProps<typeof ListingCard>,
  "viewMode" | "showActions" | "isFavorites"
>;

/** Buyer-dashboard favorites alignment: compact card + single Listed-by treatment. */
export function SuccessHubListingCard({
  hideMlsMeta,
  className,
  ...rest
}: SuccessHubListingCardProps) {
  return (
    <div className={cn(SUCCESS_HUB_LISTING_CARD_SCOPE, className)}>
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

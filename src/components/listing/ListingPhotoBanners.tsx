/**
 * Compact Compass-style listing photo badges.
 * Skinny metadata labels over the photo — not CTA chips.
 * Optional `leading` (selection checkbox) shares one top-left row; banners sit to its right.
 */

import type { ReactNode } from "react";
import { Sparkles, RefreshCw, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BannerData, OpenHouseBannerData } from "@/components/ListingCardShell";

/** Gap between selection checkbox and banner chips (~6–8px). */
const LEADING_GAP_CLASS = "gap-1.5";

function BannerIcon({ type }: { type: BannerData["iconType"] }) {
  const className = "h-2 w-2 shrink-0";
  switch (type) {
    case "sparkles":
      return <Sparkles className={className} aria-hidden />;
    case "refresh":
      return <RefreshCw className={className} aria-hidden />;
    case "trendingDown":
      return <TrendingDown className={className} aria-hidden />;
    default:
      return null;
  }
}

function formatOpenHouseLabel(
  banner: OpenHouseBannerData,
  variant: "full" | "short",
): string {
  if (variant === "short") {
    return banner.isBroker ? "BROKER TOUR" : "OPEN HOUSE";
  }
  const prefix = banner.isBroker ? "BROKER" : "OPEN";
  return `${prefix}: ${banner.date} ${banner.time}`;
}

export function ListingPhotoBannerBadge({
  color,
  children,
  className,
}: {
  color: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-[18px] max-w-full items-center gap-0.5 rounded-[3px] px-1.5 text-[9px] font-semibold leading-none text-white",
        color,
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface ListingPhotoBannersProps {
  statusBanner?: BannerData | null;
  priceChangeBanner?: BannerData | null;
  openHouseBanner?: OpenHouseBannerData | null;
  /**
   * Top-left control that shares a row with banners (typically the selection checkbox).
   * When provided, banners sit to the right with a fixed flex gap — never overlaid on the checkbox.
   */
  leading?: ReactNode;
  /** Shorter open-house label for tiny thumbs */
  compact?: boolean;
  /** Extra classes on the absolute container */
  className?: string;
}

/**
 * Shared photo-badge rules for all listing cards:
 * - Temporary PRICE REDUCED wins over status (BACK ON MARKET / base).
 * - Otherwise show the status banner from useListingBanners.
 * - Open house may sit beside whichever primary banner is selected.
 * - Selection checkbox (leading) and banners share one horizontal row (no wrap under checkbox).
 */
export function ListingPhotoBanners({
  statusBanner = null,
  priceChangeBanner = null,
  openHouseBanner = null,
  leading,
  compact = false,
  className,
}: ListingPhotoBannersProps) {
  const primaryBanner = priceChangeBanner ?? statusBanner;
  const showOpenHouse = Boolean(openHouseBanner);
  const hasBanners = Boolean(primaryBanner) || showOpenHouse;

  if (!hasBanners && !leading) return null;

  return (
    <div
      className={cn(
        "absolute top-2 left-2 z-20 flex max-w-[calc(100%-1rem)] flex-nowrap items-center",
        LEADING_GAP_CLASS,
        className,
      )}
    >
      {leading ? (
        <div className="pointer-events-auto relative z-10 flex shrink-0 items-center">
          {leading}
        </div>
      ) : null}

      {hasBanners ? (
        <div className="pointer-events-none flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden">
          {primaryBanner && (
            <ListingPhotoBannerBadge color={primaryBanner.color}>
              <BannerIcon type={primaryBanner.iconType} />
              <span className="truncate">{primaryBanner.text}</span>
            </ListingPhotoBannerBadge>
          )}

          {showOpenHouse && openHouseBanner && (
            <ListingPhotoBannerBadge color={openHouseBanner.color}>
              <span className="truncate">
                {formatOpenHouseLabel(openHouseBanner, compact ? "short" : "full")}
              </span>
            </ListingPhotoBannerBadge>
          )}
        </div>
      ) : null}
    </div>
  );
}

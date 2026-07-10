/**
 * Compact Compass-style listing photo badges.
 * Content-width chips in the top-left of the photo — not full-width ribbons.
 * Banner eligibility/precedence still comes from useListingBanners + callers.
 */

import type { ReactNode } from "react";
import { Sparkles, RefreshCw, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BannerData, OpenHouseBannerData } from "@/components/ListingCardShell";

function BannerIcon({ type, compact }: { type: BannerData["iconType"]; compact?: boolean }) {
  const size = compact ? "h-2.5 w-2.5" : "h-3 w-3";
  switch (type) {
    case "sparkles":
      return <Sparkles className={size} aria-hidden />;
    case "refresh":
      return <RefreshCw className={size} aria-hidden />;
    case "trendingDown":
      return <TrendingDown className={size} aria-hidden />;
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
  // Concise event chip: OPEN: MMM d start–end
  const prefix = banner.isBroker ? "BROKER" : "OPEN";
  return `${prefix}: ${banner.date} ${banner.time}`;
}

export function ListingPhotoBannerBadge({
  color,
  compact,
  children,
  className,
}: {
  color: string;
  compact?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-[5px] font-semibold leading-none text-white shadow-[0_1px_2px_rgba(0,0,0,0.18)]",
        compact
          ? "h-[22px] px-1.5 text-[10px]"
          : "h-[28px] px-2.5 text-[12px]",
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
  /** Tighter chips for tiny mobile thumbs */
  compact?: boolean;
  /** Extra classes on the absolute container (e.g. offset for selection checkbox) */
  className?: string;
}

/**
 * Shared photo-badge rules for all listing cards:
 * - Temporary PRICE REDUCED wins over status (BACK ON MARKET / base).
 * - Otherwise show the status banner from useListingBanners.
 * - Open house may sit beside whichever primary banner is selected.
 */
export function ListingPhotoBanners({
  statusBanner = null,
  priceChangeBanner = null,
  openHouseBanner = null,
  compact = false,
  className,
}: ListingPhotoBannersProps) {
  // PRICE REDUCED (24h) > BACK ON MARKET (24h) / base status
  const primaryBanner = priceChangeBanner ?? statusBanner;
  const showOpenHouse = Boolean(openHouseBanner);

  if (!primaryBanner && !showOpenHouse) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute top-2 left-2 z-20 flex max-w-[calc(100%-1rem)] flex-wrap items-start gap-1.5",
        className,
      )}
    >
      {primaryBanner && (
        <ListingPhotoBannerBadge color={primaryBanner.color} compact={compact}>
          <BannerIcon type={primaryBanner.iconType} compact={compact} />
          <span className="truncate">{primaryBanner.text}</span>
        </ListingPhotoBannerBadge>
      )}

      {showOpenHouse && openHouseBanner && (
        <ListingPhotoBannerBadge color={openHouseBanner.color} compact={compact}>
          <span className="truncate">
            {formatOpenHouseLabel(openHouseBanner, compact ? "short" : "full")}
          </span>
        </ListingPhotoBannerBadge>
      )}
    </div>
  );
}

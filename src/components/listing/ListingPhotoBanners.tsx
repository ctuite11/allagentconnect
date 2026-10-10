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
  const prefix = banner.isBroker ? "BROKER TOUR" : "OPEN HOUSE";
  return `${prefix}: ${banner.date} · ${banner.time.replace(" - ", "–")}`;
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
  /** All upcoming events (date order). Each renders on its own line under the status. */
  openHouseBanners?: OpenHouseBannerData[] | null;
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
  openHouseBanners = null,
  leading,
  compact = false,
  className,
}: ListingPhotoBannersProps) {
  const primaryBanner = priceChangeBanner ?? statusBanner;
  const events =
    openHouseBanners && openHouseBanners.length > 0
      ? openHouseBanners
      : openHouseBanner
        ? [openHouseBanner]
        : [];
  // Tiny thumbnails keep a single short event label to avoid covering the photo.
  const shownEvents = compact ? events.slice(0, 1) : events;
  const hasBanners = Boolean(primaryBanner) || shownEvents.length > 0;

  if (!hasBanners && !leading) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute top-2 left-2 z-20 flex max-w-[calc(100%-1rem)] flex-col items-start gap-1",
        className,
      )}
    >
      <div className={cn("flex max-w-full flex-nowrap items-center", LEADING_GAP_CLASS)}>
        {leading ? (
          <div className="pointer-events-auto relative z-10 flex shrink-0 items-center">
            {leading}
          </div>
        ) : null}
        {primaryBanner && (
          <ListingPhotoBannerBadge color={primaryBanner.color} className="min-w-0">
            <BannerIcon type={primaryBanner.iconType} />
            <span className="truncate">{primaryBanner.text}</span>
          </ListingPhotoBannerBadge>
        )}
      </div>

      {shownEvents.map((ev, i) => (
        <ListingPhotoBannerBadge key={i} color={ev.color}>
          <span className="truncate">{formatOpenHouseLabel(ev, compact ? "short" : "full")}</span>
        </ListingPhotoBannerBadge>
      ))}
    </div>
  );
}

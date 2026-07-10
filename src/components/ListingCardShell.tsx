/**
 * ListingCardShell — Canonical desktop list-view layout.
 *
 * This is the SINGLE visual source of truth for horizontal listing cards.
 * ListingCard (agent management) consumes this shell and injects actions/metadata via slots.
 *
 * Layout: Card → flex → [Photo w-40 h-40] + [grid-cols-12 info]
 *   Col 1-6: address, location, stats, metadataSlot
 *   Col 7-8: status + property type
 *   Col 9-10: price + listing type + dateSlot
 *   Col 11-12: actionsSlot
 *
 * DO NOT add context-specific logic here.
 * All behavioral differences go through the slot props.
 */

import type { MouseEvent, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import {
  Bed, Bath, Home, Calendar,
} from "lucide-react";
import { format } from "date-fns";
import DcmlsBadge from "@/components/DcmlsBadge";
import { formatListingIdLabel, LISTING_ID_NAV_CLASS } from "@/lib/listingIdDisplay";
import { formatListingPropertyTypeLabel } from "@/lib/format";
import { ListingCardAddressLine } from "@/components/listing/ListingCardAddressLine";
import { ListingPhotoBanners } from "@/components/listing/ListingPhotoBanners";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BannerData {
  text: string;
  color: string;
  iconType: "sparkles" | "refresh" | "trendingDown";
}

export interface OpenHouseBannerData {
  text: string;
  date: string;
  time: string;
  color: string;
  isBroker: boolean;
}

export interface ShellListingData {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  property_type?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  square_feet?: number | null;
  status: string;
  photos?: any;
  listing_type?: string | null;
  listing_number?: string | null;
  neighborhood?: string | null;
  publish_to_dcmls?: boolean;
  dcmls_status?: string;
  /** MLS condo unit (column) — included in formatted street heading when not already in address */
  unit_number?: string | null;
  condo_details?: unknown;
}

export interface ListingCardShellProps {
  /** Core listing data */
  listing: ShellListingData;

  /** Computed display values */
  photoUrl: string | null;
  displayPrice: string;

  /** Banners */
  statusBanner?: BannerData | null;
  priceChangeBanner?: BannerData | null;
  openHouseBanner?: OpenHouseBannerData | null;

  /** Next open house data (for inline info block) */
  nextOpenHouse?: any;

  /** Date to display in price column (created_at, list_date, etc.) */
  dateDisplay?: string | null;

  // ── Slots ──────────────────────────────────────────────────────────────

  /** Shown immediately below bed/bath/sqft (e.g. “Listed by: …”). */
  listedByLine?: ReactNode;

  /** Extra rows in col 1-6 below bed/bath/sqft (match count, micro-facts, attribution, etc.) */
  metadataSlot?: ReactNode;

  /** When provided, replaces the default address + location <h3> block */
  addressSlot?: ReactNode;

  /** Col 11-12 action buttons */
  actionsSlot: ReactNode;

  /** Overlay on photo (checkbox, etc.) */
  photoOverlay?: ReactNode;

  /** Extra metadata items in the listing-number row (relisting badge, cumulative days, etc.) */
  infoRowExtra?: ReactNode;

  /** Extra stat items after bed/bath/sqft (price per sqft, etc.) */
  statsExtra?: ReactNode;

  /** Extra content rendered inside the price block (e.g. $/sqft) */
  priceExtra?: ReactNode;

  /** Replaces default Sale/Rental + dateDisplay below price when provided */
  priceDateSlot?: ReactNode;

  /** Full-width footer below the main card content, right-aligned */
  footerSlot?: ReactNode;

  // ── Layout variants ───────────────────────────────────────────────────

  /** Photo aspect: "square" (default 160×160) or "wide" (wider, shorter) */
  photoAspect?: "square" | "wide";

  /** Price column alignment: "default" or "topRight" (anchored to top) */
  pricePosition?: "default" | "topRight";

  /** Stats row style: "default" (small muted) or "prominent" (larger, primary-colored icons) */
  statsVariant?: "default" | "prominent";

  /** Status badge size override */
  statusSize?: "sm" | "md" | "lg";

  /** Optional label rendered above the status badge (e.g. "Status:") */
  statusLabel?: string;

  /** When true, hides the status banner overlays on the photo */
  hidePhotoBanners?: boolean;

  /** When true, hides the actions column (col 11-12) and expands price to col-span-4 */
  hideActionsCol?: boolean;

  // ── Events ─────────────────────────────────────────────────────────────

  /** Card click handler */
  onClick?: () => void;

  /** AAC listing ID (`ID# L-…`) opens detail (same destination as card); use stopPropagation inside handler */
  onListingNumberClick?: (e: MouseEvent) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ListingCardShell({
  listing,
  photoUrl,
  displayPrice,
  statusBanner,
  priceChangeBanner,
  openHouseBanner,
  nextOpenHouse,
  dateDisplay,
  listedByLine,
  metadataSlot,
  addressSlot,
  actionsSlot,
  photoOverlay,
  infoRowExtra,
  statsExtra,
  priceExtra,
  priceDateSlot,
  footerSlot,
  photoAspect = "square",
  pricePosition = "default",
  statsVariant = "default",
  statusSize = "sm",
  statusLabel,
  hidePhotoBanners = false,
  hideActionsCol = false,
  onClick,
  onListingNumberClick,
}: ListingCardShellProps) {

  const listingIdLabel = formatListingIdLabel(listing);
  const isProminent = statsVariant === "prominent";
  const statsIconClass = isProminent ? "w-4 h-4 inline mr-0.5 text-primary" : "w-3 h-3 inline mr-0.5";
  const statsTextClass = isProminent ? "flex gap-4 text-sm text-foreground mb-3" : "flex gap-2 text-xs text-muted-foreground mb-3";

  const photoClass = photoAspect === "wide" ? "w-52 h-36" : "w-40 h-40";
  return (
    <Card
      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex gap-4 p-4">
        {/* ── Photo with Banners ────────────────────────────────────────── */}
        <div className={`relative ${photoClass} flex-shrink-0`}>
          {photoOverlay}
          <DcmlsBadge listing={listing} />

          {photoUrl ? (
            <img
              src={photoUrl}
              alt={listing.address}
              className={`w-full h-full object-cover ${photoAspect === "wide" ? "rounded-lg" : "rounded"}`}
            />
          ) : (
            <div className="w-full h-full bg-muted rounded flex items-center justify-center">
              <Home className="w-8 h-8 text-muted-foreground" />
            </div>
          )}

          {!hidePhotoBanners && (
            <ListingPhotoBanners
              statusBanner={statusBanner}
              priceChangeBanner={priceChangeBanner}
              openHouseBanner={openHouseBanner}
            />
          )}

          {/* Photo count badge */}
          <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
            {listing.photos?.length || 0} Photos
          </div>
        </div>

        {/* ── Info Grid ─────────────────────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-12 gap-3">
          {/* Col 1-6: Address, location, metadata */}
          <div className="col-span-6 flex flex-col">
            {addressSlot || (
              <ListingCardAddressLine listing={listing} className="mb-2" />
            )}

            {/* Info row: listing number + extras (DOM only on listing detail pages) */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              {listingIdLabel &&
                (onListingNumberClick ? (
                  <button
                    type="button"
                    className={cn(LISTING_ID_NAV_CLASS, "text-xs")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onListingNumberClick(e);
                    }}
                  >
                    {listingIdLabel}
                  </button>
                ) : (
                  <span>{listingIdLabel}</span>
                ))}
              {infoRowExtra}
            </div>

            {/* Stats row: bed/bath/sqft + extras */}
            <div className={cn(statsTextClass, "mt-1")}>
              {listing.bedrooms != null && (
                <span><Bed className={statsIconClass} />{listing.bedrooms}</span>
              )}
              {listing.bathrooms != null && (
                <span><Bath className={statsIconClass} />{listing.bathrooms}</span>
              )}
              {listing.square_feet != null && (
                <span><Home className={statsIconClass} />{listing.square_feet.toLocaleString()} sqft</span>
              )}
              {statsExtra}
            </div>

            {listedByLine ? <div className="mb-2 min-w-0">{listedByLine}</div> : null}

            {/* Open House Info (inline) */}
            {nextOpenHouse && (
              <div className={`flex items-center gap-1.5 text-xs p-2 rounded-md mb-2 ${
                nextOpenHouse.type === 'broker'
                  ? 'bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800'
              }`}>
                <Calendar className={`h-4 w-4 ${
                  nextOpenHouse.type === 'broker'
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`} />
                <div className="flex-1">
                  <div className={`font-semibold ${
                    nextOpenHouse.type === 'broker'
                      ? 'text-purple-700 dark:text-purple-300'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {nextOpenHouse.type === 'broker' ? 'Broker Tour' : 'Open House'}
                  </div>
                  <div className={
                    nextOpenHouse.type === 'broker'
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }>
                    {format(new Date(nextOpenHouse.date), "EEE, MMM d")} • {nextOpenHouse.start_time} - {nextOpenHouse.end_time}
                  </div>
                </div>
              </div>
            )}

            {/* Context-specific metadata (match count, agent attribution, etc.) */}
            {metadataSlot}
          </div>

          {/* Col 7-8: Status + property type */}
          <div className="col-span-2 flex flex-col items-center justify-center">
            <div className="inline-flex items-center gap-2 mb-1 whitespace-nowrap">
              {statusLabel && (
                <span className="text-sm text-muted-foreground leading-none font-medium">{statusLabel}</span>
              )}
              <ListingStatusBadge status={listing.status} size={statusSize} />
            </div>
            {listing.property_type && (
              <div className="truncate text-xs text-muted-foreground">
                {formatListingPropertyTypeLabel(listing.property_type)}
              </div>
            )}
          </div>

          {/* Col 9-10 (or 9-12 when hideActionsCol): Price */}
          <div className={`${hideActionsCol ? "col-span-4" : "col-span-2"} text-right ${pricePosition === "topRight" ? "flex flex-col items-end" : ""}`}>
            {pricePosition === "topRight" ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-primary">{displayPrice}</span>
                  {priceExtra}
                </div>
                {priceDateSlot}
              </>
            ) : (
              <>
                <div className="text-base font-bold text-primary mb-0.5">
                  {displayPrice}
                </div>
                {priceExtra}
                <div className="text-xs text-muted-foreground">
                  {listing.listing_type === 'for_rent' ? 'Rental' : 'Sale'}
                </div>
                {dateDisplay && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {dateDisplay}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Col 11-12: Actions (injected by consumer) */}
          {!hideActionsCol && (
            <div className="col-span-2 flex flex-col gap-1.5 justify-center pt-1">
              {actionsSlot}
            </div>
          )}
        </div>
      </div>

      {/* Footer slot (search agent attribution, etc.) */}
      {footerSlot}

      {/* Open House footer bar */}
      {openHouseBanner && nextOpenHouse && (
        <div className={`${
          openHouseBanner.isBroker
            ? 'bg-purple-50 border-t border-purple-200'
            : 'bg-emerald-50 border-t border-emerald-200'
        } px-3 py-1.5 text-xs`}>
          <Calendar className={`w-4 h-4 inline mr-2 ${
            openHouseBanner.isBroker ? 'text-purple-600' : 'text-emerald-600'
          }`} />
          <span className={`font-semibold ${
            openHouseBanner.isBroker ? 'text-purple-700' : 'text-emerald-700'
          }`}>
            {openHouseBanner.isBroker ? 'Broker Open House:' : 'Open House:'}
          </span>{" "}
          {format(new Date(nextOpenHouse.date), "EEEE, MMMM d, yyyy")} • {openHouseBanner.time}
        </div>
      )}
    </Card>
  );
}

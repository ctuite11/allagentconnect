/**
 * ListingCardShell — Canonical desktop list-view layout.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  CANONICAL SOURCE OF TRUTH                                      │
 * │                                                                  │
 * │  My Listings (ListingCard list mode) defines the canonical       │
 * │  desktop layout. All other consumers (SearchListingCard, etc.)   │
 * │  MUST render the same visual structure:                          │
 * │    • Photo block (140×100, rounded-xl)                           │
 * │    • Flex layout: info stack (left) + right column               │
 * │    • Typography hierarchy, badge placement, metrics row          │
 * │                                                                  │
 * │  Only actions and context-specific labels may differ.            │
 * │  DO NOT add competing layout paths.                              │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * Layout: Card → flex → [Photo 140×100] + [flex: info-stack | right-col]
 *   Info stack: listing # + type, address, location, stats, open house, metadataSlot
 *   Right col:  price (or priceSlot), status badge, property type, dateDisplay,
 *               rightMetadataSlot, actionsSlot
 *
 * DO NOT add context-specific logic here.
 * All behavioral differences go through the slot props.
 */

import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import {
  MapPin, Bed, Bath, Home, Sparkles,
  TrendingDown, RefreshCw, Calendar,
} from "lucide-react";
import { format } from "date-fns";

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
}

export interface ListingCardShellProps {
  /** Core listing data */
  listing: ShellListingData;

  /** Computed display values */
  photoUrl: string | null;
  displayPrice: string;
  daysOnMarket: number;
  unitNumber?: string | null;

  /** Banners */
  statusBanner?: BannerData | null;
  priceChangeBanner?: BannerData | null;
  openHouseBanner?: OpenHouseBannerData | null;

  /** Next open house data (for inline info block) */
  nextOpenHouse?: any;

  /** Date to display in right column (created_at, list_date, etc.) */
  dateDisplay?: string | null;

  // ── Slots ──────────────────────────────────────────────────────────────

  /** Extra rows in info stack below stats (match count, micro-facts, agent attribution, etc.) */
  metadataSlot?: ReactNode;

  /** Right column action buttons */
  actionsSlot: ReactNode;

  /** Overlay on photo (checkbox, etc.) */
  photoOverlay?: ReactNode;

  /** Extra items in the listing-number row (listing type badge, relisting badge, etc.) */
  infoRowExtra?: ReactNode;

  /** Extra stat items after bed/bath/sqft (price per sqft, etc.) */
  statsExtra?: ReactNode;

  /** Extra metadata in right column below status (dates, view/favorite counts, etc.) */
  rightMetadataSlot?: ReactNode;

  /** Override the default price display (e.g. quick-edit form) */
  priceSlot?: ReactNode;

  // ── Events ─────────────────────────────────────────────────────────────

  /** Card click handler */
  onClick?: () => void;
}

// ── Banner Icon ──────────────────────────────────────────────────────────────

function BannerIcon({ type }: { type: BannerData["iconType"] }) {
  switch (type) {
    case "sparkles": return <Sparkles className="w-2.5 h-2.5" />;
    case "refresh": return <RefreshCw className="w-2.5 h-2.5" />;
    case "trendingDown": return <TrendingDown className="w-2.5 h-2.5" />;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function ListingCardShell({
  listing,
  photoUrl,
  displayPrice,
  daysOnMarket,
  unitNumber,
  statusBanner,
  priceChangeBanner,
  openHouseBanner,
  nextOpenHouse,
  dateDisplay,
  metadataSlot,
  actionsSlot,
  photoOverlay,
  infoRowExtra,
  statsExtra,
  rightMetadataSlot,
  priceSlot,
  onClick,
}: ListingCardShellProps) {
  return (
    <Card
      className="overflow-hidden hover:shadow-md transition-shadow border-l-4 border-l-primary cursor-pointer"
      onClick={onClick}
    >
      <div className="flex gap-4 p-4">
        {/* ── Photo (140×100, canonical size) ───────────────────────────── */}
        <div className="relative w-[140px] h-[100px] flex-shrink-0 rounded-xl overflow-hidden bg-muted">
          {photoOverlay}

          {photoUrl ? (
            <img
              src={photoUrl}
              alt={listing.address}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Home className="w-8 h-8 text-muted-foreground" />
            </div>
          )}

          {/* Status Change Banner (top priority) */}
          {statusBanner && (
            <div className={`absolute top-0 left-0 right-0 ${statusBanner.color} text-white text-[10px] font-bold px-1.5 py-0.5 text-center flex items-center justify-center gap-0.5`}>
              <BannerIcon type={statusBanner.iconType} />
              {statusBanner.text}
            </div>
          )}

          {/* Price Change Banner (second priority) */}
          {priceChangeBanner && !statusBanner && (
            <div className={`absolute top-0 left-0 right-0 ${priceChangeBanner.color} text-white text-[10px] font-bold px-1.5 py-0.5 text-center flex items-center justify-center gap-0.5`}>
              <TrendingDown className="w-2.5 h-2.5" />
              {priceChangeBanner.text}
            </div>
          )}

          {/* Open House Banner */}
          {openHouseBanner && (
            <div
              className={`absolute ${statusBanner || priceChangeBanner ? 'top-5' : 'top-0'} left-0 right-0 ${openHouseBanner.color} text-white text-[10px] font-bold px-1.5 py-0.5 text-center`}
            >
              {openHouseBanner.isBroker ? '🏢' : '🎈'} {openHouseBanner.date}
            </div>
          )}

          {/* Photo count badge */}
          <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
            {listing.photos?.length || 0} Photos
          </div>
        </div>

        {/* ── Content: Info Stack + Right Column ───────────────────────── */}
        <div className="flex-1 flex gap-4 min-w-0">
          {/* Left: Info stack */}
          <div className="flex-1 min-w-0 space-y-0.5">
            {/* Row 1: Listing # + DOM + extras */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {listing.listing_number && <span>#{listing.listing_number}</span>}
              {infoRowExtra}
              {daysOnMarket > 0 && (
                <>
                  {(listing.listing_number || infoRowExtra) && <span className="text-muted-foreground/40">•</span>}
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {daysOnMarket} {daysOnMarket === 1 ? 'day' : 'days'} on market
                  </Badge>
                </>
              )}
            </div>

            {/* Row 2: Address + unit */}
            <h3 className="font-semibold text-sm truncate">
              {listing.address}
              {unitNumber && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Unit {unitNumber}
                </Badge>
              )}
            </h3>

            {/* Row 3: Location + neighborhood */}
            <div className="flex items-center text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 mr-1" />
              {listing.city}, {listing.state} {listing.zip_code}
              {listing.neighborhood && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {listing.neighborhood}
                </Badge>
              )}
            </div>

            {/* Row 4: Stats (bed / bath / sqft + extras) */}
            <div className="flex gap-2 text-xs text-muted-foreground pt-0.5">
              {listing.bedrooms != null && (
                <span><Bed className="w-3 h-3 inline mr-0.5" />{listing.bedrooms}</span>
              )}
              {listing.bathrooms != null && (
                <span><Bath className="w-3 h-3 inline mr-0.5" />{listing.bathrooms}</span>
              )}
              {listing.square_feet != null && (
                <span><Home className="w-3 h-3 inline mr-0.5" />{listing.square_feet.toLocaleString()} sqft</span>
              )}
              {statsExtra}
            </div>

            {/* Open House Info (inline, when provided) */}
            {nextOpenHouse && (
              <div className={`flex items-center gap-1.5 text-xs p-2 rounded-md mt-1 ${
                nextOpenHouse.type === 'broker'
                  ? 'bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800'
              }`}>
                <Calendar className={`h-3.5 w-3.5 ${
                  nextOpenHouse.type === 'broker'
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`} />
                <div className="flex-1">
                  <div className={`font-semibold text-[11px] ${
                    nextOpenHouse.type === 'broker'
                      ? 'text-purple-700 dark:text-purple-300'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {nextOpenHouse.type === 'broker' ? 'Broker Tour' : 'Open House'}
                  </div>
                  <div className={`text-[11px] ${
                    nextOpenHouse.type === 'broker'
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {format(new Date(nextOpenHouse.date), "EEE, MMM d")} • {nextOpenHouse.start_time} - {nextOpenHouse.end_time}
                  </div>
                </div>
              </div>
            )}

            {/* Context-specific metadata (match count, agent attribution, quick edit, OH details, etc.) */}
            {metadataSlot}
          </div>

          {/* Right: Price + Status + Actions */}
          <div className="shrink-0 flex flex-col items-end text-right gap-0.5 min-w-[120px]">
            {priceSlot || (
              <div className="text-base font-bold text-primary">
                {displayPrice}
              </div>
            )}
            <ListingStatusBadge status={listing.status} size="sm" />
            {listing.property_type && (
              <div className="text-xs text-muted-foreground">{listing.property_type}</div>
            )}
            {dateDisplay && (
              <div className="text-xs text-muted-foreground">
                {dateDisplay}
              </div>
            )}
            {rightMetadataSlot}
            <div className="mt-auto pt-1 flex flex-col gap-1.5 w-full">
              {actionsSlot}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

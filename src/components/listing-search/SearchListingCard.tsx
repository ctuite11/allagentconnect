/**
 * SearchListingCard — Thin wrapper around ListingCardShell.
 *
 * Provides search-specific actions (View + Contact) and metadata
 * (price/sqft, micro-facts, agent attribution, checkbox) via shell slots.
 *
 * The visual layout is 100% owned by ListingCardShell.
 * This file ONLY supplies:
 *   - variant-specific data computation
 *   - actionsSlot (View + Contact buttons)
 *   - metadataSlot (agent attribution)
 *   - statsExtra (price per sqft)
 *   - photoOverlay (checkbox)
 *   - mobile view (search-specific compact layout)
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import {
  MapPin, Bed, Bath, Home, Calendar, Sparkles,
  TrendingDown, RefreshCw, Check, Mail, ExternalLink,
  Phone,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import ContactAgentDialog from "@/components/ContactAgentDialog";
import { LISTING_STATUS, isComingSoon } from "@/constants/status";
import { buildDisplayAddress } from "@/lib/utils";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { ListingCardShell, type BannerData, type OpenHouseBannerData } from "@/components/ListingCardShell";

// ── Types ───────────────────────────────────────────────────────────────────

interface SearchListing {
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
  open_houses?: any;
  listing_type?: string | null;
  list_date?: string | null;
  listing_number?: string | null;
  neighborhood?: string | null;
  agent_id?: string | null;
  agent_name?: string | null;
  agent_email?: string | null;
  agent_phone?: string | null;
  list_office?: string | null;
  unit_number?: string | null;
  year_built?: number | null;
  garage_spaces?: number | null;
  total_parking_spaces?: number | null;
  property_styles?: any;
  price_range_min?: number | null;
  price_range_max?: number | null;
  condo_details?: any;
  active_date?: string | null;
  created_at?: string | null;
}

interface SearchListingCardProps {
  listing: SearchListing;
  isSelected?: boolean;
  onSelect?: (id: string, e?: React.SyntheticEvent) => void;
  onRowClick?: (listing: SearchListing) => void;
  fromPath?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);

const getFirstPhoto = (listing: SearchListing) => {
  if (listing.photos && Array.isArray(listing.photos) && listing.photos.length > 0) {
    const photo = listing.photos[0];
    if (typeof photo === "string") return photo;
    if (photo?.url) {
      if (photo.url.startsWith("http")) return photo.url;
      const { data } = supabase.storage.from("listing-photos").getPublicUrl(photo.url);
      return data.publicUrl;
    }
  }
  return null;
};

const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
};

const getNextOpenHouse = (openHouses?: any) => {
  if (!openHouses || !Array.isArray(openHouses)) return null;
  const now = new Date();
  const upcoming = openHouses
    .filter((oh: any) => new Date(`${oh.date}T${oh.end_time}:00`) > now)
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return upcoming[0] || null;
};

const getUnitNumber = (listing: SearchListing) => {
  if (listing.unit_number) return listing.unit_number;
  if (!listing.condo_details) return null;
  try {
    const details = typeof listing.condo_details === 'string' ? JSON.parse(listing.condo_details) : listing.condo_details;
    return details?.unit_number || null;
  } catch {
    return null;
  }
};

const calculateDaysOnMarket = (listing: SearchListing) => {
  const marketDate = listing.active_date || listing.list_date || listing.created_at;
  if (!marketDate) return 0;
  const activeDate = new Date(marketDate);
  const today = new Date();
  return Math.ceil(Math.abs(today.getTime() - activeDate.getTime()) / (1000 * 60 * 60 * 24));
};

const getStatusChangeBanner = (status: string): BannerData | null => {
  if (isComingSoon(status)) return { text: "COMING SOON", color: "bg-purple-600", iconType: "sparkles" };
  if (status === LISTING_STATUS.NEW) return { text: "NEW LISTING", color: "bg-blue-600", iconType: "sparkles" };
  if (status === LISTING_STATUS.BACK_ON_MARKET) return { text: "BACK ON MARKET", color: "bg-orange-600", iconType: "refresh" };
  if (status === LISTING_STATUS.PRICE_CHANGED) return { text: "PRICE REDUCED", color: "bg-red-600", iconType: "trendingDown" };
  return null;
};

const getOpenHouseBanner = (nextOH: any): OpenHouseBannerData | null => {
  if (!nextOH) return null;
  const isBrokerOnly = nextOH.event_type === 'broker_tour' || nextOH.type === 'broker';
  return {
    text: isBrokerOnly ? "BROKER OPEN HOUSE" : "OPEN HOUSE",
    date: format(new Date(nextOH.date), "MMM d"),
    time: `${formatTime(nextOH.start_time)} - ${formatTime(nextOH.end_time)}`,
    color: isBrokerOnly ? "bg-purple-600" : "bg-green-600",
    isBroker: isBrokerOnly,
  };
};

const getPropertyStyle = (listing: SearchListing) => {
  if (listing.property_styles) {
    if (Array.isArray(listing.property_styles) && listing.property_styles.length > 0) return listing.property_styles[0];
    if (typeof listing.property_styles === "string") return listing.property_styles;
  }
  return listing.property_type || null;
};

// ── Component ───────────────────────────────────────────────────────────────

export const SearchListingCard = ({
  listing,
  isSelected = false,
  onSelect,
  onRowClick,
  fromPath,
}: SearchListingCardProps) => {
  const navigate = useNavigate();
  const [contactOpen, setContactOpen] = useState(false);

  const photoUrl = getFirstPhoto(listing);
  const nextOpenHouse = getNextOpenHouse(listing.open_houses);
  const statusBanner = getStatusChangeBanner(listing.status);
  const openHouseBanner = getOpenHouseBanner(nextOpenHouse);
  const unitNumber = getUnitNumber(listing);
  const daysOnMarket = calculateDaysOnMarket(listing);

  const formatPriceRange = () => {
    const min = listing.price_range_min;
    const max = listing.price_range_max;
    if (min && max) return `${formatPrice(min)} – ${formatPrice(max)}`;
    if (min) return `From ${formatPrice(min)}`;
    if (max) return `Up to ${formatPrice(max)}`;
    return null;
  };

  const displayPrice = listing.price ? formatPrice(listing.price) : (formatPriceRange() || formatPrice(0));
  const pricePerSqFt = listing.square_feet && listing.square_feet > 0
    ? Math.round(listing.price / listing.square_feet) : null;

  const microFacts: string[] = [];
  if (listing.year_built) microFacts.push(`Built ${listing.year_built}`);
  const parking = listing.garage_spaces || listing.total_parking_spaces;
  if (parking) microFacts.push(`${parking} pkg`);

  const fullAddress = `${listing.address}${unitNumber ? ` #${unitNumber}` : ""}, ${listing.city}, ${listing.state}`;

  const handleCardClick = () => {
    if (onRowClick) {
      onRowClick(listing);
    } else {
      navigate(`/property/${listing.id}`, { state: { from: fromPath } });
    }
  };

  return (
    <>
      {/* ══ DESKTOP (md+) — delegates to ListingCardShell ═══════════════ */}
      <div className="hidden md:block">
        <ListingCardShell
          listing={{
            ...listing,
            // Suppress shell's default listing number — we render a clickable one via infoRowExtra
            listing_number: null,
          }}
          addressSlot={
            <>
              <h3 className="font-semibold text-sm mb-1">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-primary transition-colors"
                >
                  {listing.address}
                </a>
                {unitNumber && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Unit {unitNumber}
                  </Badge>
                )}
              </h3>
              <div className="flex items-center text-muted-foreground text-xs mb-2">
                <MapPin className="w-3 h-3 mr-1" />
                {listing.city}, {listing.state} {listing.zip_code}
                {listing.neighborhood && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {listing.neighborhood}
                  </Badge>
                )}
              </div>
            </>
          }
          photoUrl={photoUrl}
          displayPrice={displayPrice}
          daysOnMarket={daysOnMarket}
          unitNumber={unitNumber}
          statusBanner={statusBanner}
          openHouseBanner={openHouseBanner}
          nextOpenHouse={nextOpenHouse}
          onClick={handleCardClick}
          photoAspect="wide"
          pricePosition="topRight"
          statsVariant="prominent"
          hideDOMBadge
          photoOverlay={onSelect ? (
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(listing.id, e); }}
              className="absolute left-2 top-2 z-10 h-5 w-5 rounded-md border border-white/80 bg-white/90 shadow-sm flex items-center justify-center"
              aria-label="Select listing"
            >
              {isSelected && <Check className="h-3 w-3 text-emerald-600" />}
            </button>
          ) : undefined}
          priceDateSlot={
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              {pricePerSqFt && <div>${pricePerSqFt}/sqft</div>}
              {listing.list_date && (
                <div>List Date: {format(new Date(listing.list_date), "MM/dd/yy")}</div>
              )}
              {daysOnMarket > 0 && <div>DOM: {daysOnMarket}</div>}
            </div>
          }
          infoRowExtra={
            <>
              {listing.listing_number && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/property/${listing.id}`, { state: { from: fromPath } }); }}
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Listing #{listing.listing_number}
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/property/${listing.id}`, { state: { from: fromPath } }); }}
                className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> View
              </button>
            </>
          }
          metadataSlot={
            <div className="space-y-1">
              {microFacts.length > 0 && (
                <div className="text-xs text-muted-foreground truncate">
                  {microFacts.join(" · ")}
                </div>
              )}
            </div>
          }
          footerSlot={listing.agent_name ? (
            <div className="px-4 py-2 flex items-center justify-end gap-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{listing.agent_name}</span>
              {listing.agent_phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {formatPhoneNumber(listing.agent_phone)}
                </span>
              )}
              {listing.agent_id && (
                <button
                  onClick={(e) => { e.stopPropagation(); setContactOpen(true); }}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary/80 transition-colors"
                  title="Contact listing agent"
                >
                  <Mail className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : undefined}
          actionsSlot={<></>}
        />
      </div>

      {/* ══ MOBILE (< md) — search-specific compact layout ═════════════ */}
      <Card className="md:hidden overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={handleCardClick}>
        <div className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-shrink-0">
              {onSelect && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSelect(listing.id, e); }}
                  className="absolute left-2 top-2 z-10 h-5 w-5 rounded-md border border-white/80 bg-white/90 shadow-sm flex items-center justify-center"
                  aria-label="Select listing"
                >
                  {isSelected && <Check className="h-3 w-3 text-emerald-600" />}
                </button>
              )}
              <div className="relative h-[75px] w-[100px] overflow-hidden rounded bg-muted">
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Home className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                {statusBanner && (
                  <div className={`absolute top-0 left-0 right-0 ${statusBanner.color} text-white text-[10px] font-bold px-1.5 py-0.5 text-center flex items-center justify-center gap-0.5`}>
                    {statusBanner.iconType === 'sparkles' ? <Sparkles className="h-2.5 w-2.5" /> :
                     statusBanner.iconType === 'refresh' ? <RefreshCw className="h-2.5 w-2.5" /> :
                     <TrendingDown className="h-2.5 w-2.5" />}
                    {statusBanner.text}
                  </div>
                )}
                {(listing.photos?.length || 0) > 0 && (
                  <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                    {listing.photos?.length}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {listing.address}
                {unitNumber && <Badge variant="secondary" className="ml-1.5 text-[10px]">Unit {unitNumber}</Badge>}
              </h3>
              <div className="flex items-center text-xs text-muted-foreground mt-0.5">
                <MapPin className="w-3 h-3 mr-0.5" />
                {listing.city}, {listing.state} {listing.zip_code}
              </div>
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <ListingStatusBadge status={listing.status} size="sm" />
                {listing.listing_number && (
                  <span className="text-[11px] font-mono text-muted-foreground">#{listing.listing_number}</span>
                )}
                {daysOnMarket > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {daysOnMarket} DOM
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-base font-bold text-primary">{displayPrice}</span>
              {pricePerSqFt && <span className="text-xs text-muted-foreground">${pricePerSqFt}/sqft</span>}
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Bed className="h-3.5 w-3.5" /> {listing.bedrooms ?? "-"}
              </span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Bath className="h-3.5 w-3.5" /> {listing.bathrooms ?? "-"}
              </span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Home className="h-3.5 w-3.5" /> {listing.square_feet?.toLocaleString() ?? "-"} sqft
              </span>
            </div>
          </div>

          {microFacts.length > 0 && (
            <div className="mt-1.5 text-[11px] text-muted-foreground truncate">
              {microFacts.join(" · ")}
            </div>
          )}

          {nextOpenHouse && (
            <div className="mt-2 flex items-center gap-1.5 text-xs p-2 rounded-md bg-emerald-50 border border-emerald-200">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-medium">
                OH: {format(new Date(nextOpenHouse.date), "MMM d")} • {formatTime(nextOpenHouse.start_time)} – {formatTime(nextOpenHouse.end_time)}
              </span>
            </div>
          )}

          {listing.list_date && (
            <div className="mt-1 text-[11px] text-muted-foreground">
              Listed {format(new Date(listing.list_date), "MM/dd/yy")}
            </div>
          )}

          {listing.agent_name && (
            <div className="mt-2">
              <div className="text-sm font-medium text-foreground truncate">{listing.agent_name}</div>
              {listing.list_office && <div className="text-xs text-muted-foreground truncate">{listing.list_office}</div>}
            </div>
          )}

          <div className="mt-3 flex items-center justify-end gap-3 border-t border-border pt-3">
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/property/${listing.id}`, { state: { from: fromPath } }); }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" /> View
            </button>
            {listing.agent_id && (
              <button
                onClick={(e) => { e.stopPropagation(); setContactOpen(true); }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-primary"
              >
                <Mail className="h-4 w-4" /> Contact
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Contact Dialog */}
      {listing.agent_id && (
        <ContactAgentDialog
          listingId={listing.id}
          agentId={listing.agent_id}
          listingAddress={fullAddress}
          open={contactOpen}
          onOpenChange={setContactOpen}
          hideTrigger
        />
      )}
    </>
  );
};

export default SearchListingCard;

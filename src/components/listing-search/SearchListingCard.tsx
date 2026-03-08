/**
 * SearchListingCard — forked from ListingCard list-view layout.
 *
 * Same container, grid structure, visual hierarchy, banners, and card language
 * as the My Listings management card. Management-only controls stripped;
 * replaced with View + Contact actions and agent attribution.
 *
 * DO NOT merge back into ListingCard.tsx — this is intentionally a separate
 * search-results-specific component.
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import {
  MapPin, Bed, Bath, Home, Eye, Calendar, Sparkles,
  TrendingDown, RefreshCw, Check, Mail, ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import ContactAgentDialog from "@/components/ContactAgentDialog";
import { LISTING_STATUS, isComingSoon } from "@/constants/status";
import { buildDisplayAddress } from "@/lib/utils";

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
  list_office?: string | null;
  unit_number?: string | null;
  year_built?: number | null;
  garage_spaces?: number | null;
  total_parking_spaces?: number | null;
  property_styles?: any;
  price_range_min?: number | null;
  price_range_max?: number | null;
}

interface SearchListingCardProps {
  listing: SearchListing;
  isSelected?: boolean;
  onSelect?: (id: string, e?: React.SyntheticEvent) => void;
  onRowClick?: (listing: SearchListing) => void;
  fromPath?: string;
}

// ── Helpers (same as ListingCard) ───────────────────────────────────────────

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

const calculateDaysOnMarket = (listDate?: string | null) => {
  if (!listDate) return 0;
  const start = new Date(listDate);
  return Math.ceil(Math.abs(Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
};

// ── Status banner (simplified — no history fetch) ───────────────────────────

const getStatusBanner = (status: string) => {
  if (isComingSoon(status)) {
    return { text: "COMING SOON", color: "bg-purple-600", iconType: "sparkles" as const };
  }
  if (status === LISTING_STATUS.NEW) {
    return { text: "NEW LISTING", color: "bg-blue-600", iconType: "sparkles" as const };
  }
  if (status === LISTING_STATUS.BACK_ON_MARKET) {
    return { text: "BACK ON MARKET", color: "bg-orange-600", iconType: "refresh" as const };
  }
  if (status === LISTING_STATUS.PRICE_CHANGED) {
    return { text: "PRICE REDUCED", color: "bg-red-600", iconType: "trendingDown" as const };
  }
  return null;
};

const getOpenHouseBanner = (nextOH: any) => {
  if (!nextOH) return null;
  const isBrokerOnly = nextOH.event_type === "broker_tour" || nextOH.type === "broker";
  return {
    text: isBrokerOnly ? "BROKER OPEN HOUSE" : "OPEN HOUSE",
    date: format(new Date(nextOH.date), "MMM d"),
    time: `${formatTime(nextOH.start_time)} - ${formatTime(nextOH.end_time)}`,
    color: isBrokerOnly ? "bg-purple-600" : "bg-green-600",
    isBroker: isBrokerOnly,
  };
};

// ── Micro-facts ─────────────────────────────────────────────────────────────

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
  const statusBanner = getStatusBanner(listing.status);
  const openHouseBanner = getOpenHouseBanner(nextOpenHouse);
  const daysOnMarket = calculateDaysOnMarket(listing.list_date);
  const displayAddress = buildDisplayAddress(listing);

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
    ? Math.round(listing.price / listing.square_feet)
    : null;

  const microFacts: string[] = [];
  if (listing.year_built) microFacts.push(`Built ${listing.year_built}`);
  const parking = listing.garage_spaces || listing.total_parking_spaces;
  if (parking) microFacts.push(`${parking} pkg`);
  const style = getPropertyStyle(listing);
  if (style) microFacts.push(style);

  const fullAddress = `${listing.address}${listing.unit_number ? ` #${listing.unit_number}` : ""}, ${listing.city}, ${listing.state}`;

  const handleCardClick = () => {
    if (onRowClick) {
      onRowClick(listing);
    } else {
      navigate(`/property/${listing.id}`, { state: { from: fromPath } });
    }
  };

  // ── Checkbox (same style as ListingCard) ────────────────────────────────

  const checkboxButton = onSelect ? (
    <button
      onClick={(e) => { e.stopPropagation(); onSelect(listing.id, e); }}
      className="absolute left-2 top-2 z-10 h-5 w-5 rounded-md border border-white/80 bg-white/90 shadow-sm flex items-center justify-center"
      aria-label="Select listing"
    >
      {isSelected && <Check className="h-3 w-3 text-emerald-600" />}
    </button>
  ) : null;

  // ═══════════════════════════════════════════════════════════════════════════
  // DESKTOP LIST VIEW — exact fork of ListingCard list-view (lines 898-1190)
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <Card
      onClick={handleCardClick}
      className={`overflow-hidden cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary ${isSelected ? "ring-2 ring-emerald-300/30" : ""}`}
    >
      {/* DESKTOP (md+) */}
      <div className="hidden md:flex gap-4 p-4">
        {/* Photo with Banners — 160×160 */}
        <div className="relative w-40 h-40 flex-shrink-0">
          {checkboxButton}
          {photoUrl ? (
            <img src={photoUrl} alt={listing.address} className="w-full h-full object-cover rounded" />
          ) : (
            <div className="w-full h-full bg-muted rounded flex items-center justify-center">
              <Home className="w-8 h-8 text-muted-foreground" />
            </div>
          )}

          {/* Status Change Banner (top priority) */}
          {statusBanner && (
            <div className={`absolute top-0 left-0 right-0 ${statusBanner.color} text-white text-xs font-bold px-2 py-1 text-center flex items-center justify-center gap-1`}>
              {statusBanner.iconType === "sparkles" ? <Sparkles className="w-3 h-3" /> :
               statusBanner.iconType === "refresh" ? <RefreshCw className="w-3 h-3" /> :
               <TrendingDown className="w-3 h-3" />}
              {statusBanner.text}
            </div>
          )}

          {/* Open House Banner */}
          {openHouseBanner && (
            <div className={`absolute ${statusBanner ? "top-6" : "top-0"} left-0 right-0 ${openHouseBanner.color} text-white text-xs font-bold px-2 py-1 text-center`}>
              {openHouseBanner.isBroker ? "🏢" : "🎈"} {openHouseBanner.date} • {openHouseBanner.time}
            </div>
          )}

          {/* Photo count badge */}
          <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
            {listing.photos?.length || 0} Photos
          </div>
        </div>

        {/* Listing Info — 12-column grid (same as ListingCard) */}
        <div className="flex-1 grid grid-cols-12 gap-3">
          {/* Col 1-6: Address, location, metadata, stats */}
          <div className="col-span-6">
            <h3 className="font-semibold text-sm mb-1">
              {listing.address}
              {listing.unit_number && (
                <Badge variant="secondary" className="ml-2 text-xs">Unit {listing.unit_number}</Badge>
              )}
            </h3>
            <div className="flex items-center text-muted-foreground text-xs mb-2">
              <MapPin className="w-3 h-3 mr-1" />
              {listing.city}, {listing.state} {listing.zip_code}
              {listing.neighborhood && (
                <Badge variant="secondary" className="ml-2 text-xs">{listing.neighborhood}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              {listing.listing_number && <span>Listing #{listing.listing_number}</span>}
              {daysOnMarket > 0 && (
                <>
                  {listing.listing_number && <span>•</span>}
                  <Badge variant="outline" className="text-xs">
                    {daysOnMarket} {daysOnMarket === 1 ? "day" : "days"} on market
                  </Badge>
                </>
              )}
              {listing.list_date && (
                <>
                  <span>•</span>
                  <span>Listed {format(new Date(listing.list_date), "MM/dd/yy")}</span>
                </>
              )}
            </div>
            <div className="flex gap-2 text-xs text-muted-foreground mb-2">
              {listing.bedrooms != null && (
                <span><Bed className="w-3 h-3 inline mr-0.5" />{listing.bedrooms}</span>
              )}
              {listing.bathrooms != null && (
                <span><Bath className="w-3 h-3 inline mr-0.5" />{listing.bathrooms}</span>
              )}
              {listing.square_feet != null && (
                <span><Home className="w-3 h-3 inline mr-0.5" />{listing.square_feet.toLocaleString()} sqft</span>
              )}
              {pricePerSqFt && (
                <span className="text-muted-foreground">${pricePerSqFt}/sqft</span>
              )}
            </div>

            {/* Micro-facts */}
            {microFacts.length > 0 && (
              <div className="text-xs text-muted-foreground mb-2 truncate">
                {microFacts.join(" · ")}
              </div>
            )}

            {/* Open House Info — colored card */}
            {nextOpenHouse && (
              <div className={`flex items-center gap-1.5 text-xs p-2 rounded-md mb-2 ${nextOpenHouse.type === "broker" || nextOpenHouse.event_type === "broker_tour" ? "bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800" : "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"}`}>
                <Calendar className={`h-4 w-4 ${nextOpenHouse.type === "broker" || nextOpenHouse.event_type === "broker_tour" ? "text-purple-600 dark:text-purple-400" : "text-emerald-600 dark:text-emerald-400"}`} />
                <div className="flex-1">
                  <div className={`font-semibold ${nextOpenHouse.type === "broker" || nextOpenHouse.event_type === "broker_tour" ? "text-purple-700 dark:text-purple-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                    {nextOpenHouse.type === "broker" || nextOpenHouse.event_type === "broker_tour" ? "Broker Tour" : "Open House"}
                  </div>
                  <div className={`${nextOpenHouse.type === "broker" || nextOpenHouse.event_type === "broker_tour" ? "text-purple-600 dark:text-purple-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {format(new Date(nextOpenHouse.date), "EEE, MMM d")} • {formatTime(nextOpenHouse.start_time)} - {formatTime(nextOpenHouse.end_time)}
                  </div>
                </div>
              </div>
            )}

            {/* Agent attribution */}
            {listing.agent_name && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{listing.agent_name}</span>
                {listing.list_office && (
                  <span className="ml-2">{listing.list_office}</span>
                )}
              </div>
            )}
          </div>

          {/* Col 7-8: Status + property type */}
          <div className="col-span-2">
            <ListingStatusBadge status={listing.status} size="sm" className="mb-1" />
            {listing.property_type && (
              <div className="text-xs text-muted-foreground">{listing.property_type}</div>
            )}
          </div>

          {/* Col 9-10: Price (right-aligned) */}
          <div className="col-span-2 text-right">
            <div className="text-base font-bold text-primary mb-0.5">
              {displayPrice}
            </div>
            <div className="text-xs text-muted-foreground">
              {listing.listing_type === "for_rent" ? "Rental" : "Sale"}
            </div>
            {listing.list_date && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(listing.list_date), "MM/dd/yy")}
              </div>
            )}
          </div>

          {/* Col 11-12: View + Contact actions */}
          <div className="col-span-2 flex flex-col gap-1.5 justify-center pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/property/${listing.id}`, { state: { from: fromPath } });
              }}
              className="w-full"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View
            </Button>
            {listing.agent_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setContactOpen(true);
                }}
                className="w-full"
              >
                <Mail className="w-3 h-3 mr-1" />
                Contact
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE (< md): compact vertical layout */}
      <div className="md:hidden p-4">
        <div className="flex gap-3">
          <div className="relative flex-shrink-0">
            {checkboxButton}
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
                  {statusBanner.iconType === "sparkles" ? <Sparkles className="h-2.5 w-2.5" /> :
                   statusBanner.iconType === "refresh" ? <RefreshCw className="h-2.5 w-2.5" /> :
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
              {listing.unit_number && (
                <Badge variant="secondary" className="ml-1.5 text-[10px]">Unit {listing.unit_number}</Badge>
              )}
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

        {/* Price + Stats */}
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-base font-bold text-primary">
              {displayPrice}
            </span>
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

        {/* Micro-facts */}
        {microFacts.length > 0 && (
          <div className="mt-1.5 text-[11px] text-muted-foreground truncate">
            {microFacts.join(" · ")}
          </div>
        )}

        {/* Open house info */}
        {nextOpenHouse && (
          <div className="mt-2 flex items-center gap-1.5 text-xs p-2 rounded-md bg-emerald-50 border border-emerald-200">
            <Calendar className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-emerald-700 font-medium">
              OH: {format(new Date(nextOpenHouse.date), "MMM d")} • {formatTime(nextOpenHouse.start_time)} – {formatTime(nextOpenHouse.end_time)}
            </span>
          </div>
        )}

        {/* List date */}
        {listing.list_date && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            Listed {format(new Date(listing.list_date), "MM/dd/yy")}
          </div>
        )}

        {/* Agent */}
        {listing.agent_name && (
          <div className="mt-2">
            <div className="text-sm font-medium text-foreground truncate">{listing.agent_name}</div>
            {listing.list_office && <div className="text-xs text-muted-foreground truncate">{listing.list_office}</div>}
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center justify-end gap-3 border-t border-border pt-3">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/property/${listing.id}`, { state: { from: fromPath } }); }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-primary"
          >
            <ExternalLink className="h-4 w-4" />
            View
          </button>
          {listing.agent_id && (
            <button
              onClick={(e) => { e.stopPropagation(); setContactOpen(true); }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-primary"
            >
              <Mail className="h-4 w-4" />
              Contact
            </button>
          )}
        </div>
      </div>

      {/* Open House footer bar (desktop) */}
      {nextOpenHouse && (
        <div className="hidden md:block bg-emerald-50 border-t border-emerald-200 px-3 py-1.5 text-xs">
          <Calendar className="w-4 h-4 inline mr-2 text-emerald-600" />
          <span className="font-semibold text-emerald-700">
            {nextOpenHouse.type === "broker" || nextOpenHouse.event_type === "broker_tour" ? "Broker Open House:" : "Open House:"}
          </span>{" "}
          {format(new Date(nextOpenHouse.date), "EEEE, MMMM d, yyyy")} • {formatTime(nextOpenHouse.start_time)} – {formatTime(nextOpenHouse.end_time)}
        </div>
      )}

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
    </Card>
  );
};

export default SearchListingCard;

/**
 * SearchListingCard — MLS-style search results card.
 *
 * Renders its own desktop + mobile layouts directly (does NOT use ListingCardShell).
 * Layout follows MLS scan pattern:
 *   Header: Address left / Status center / Price right
 *   Body: stats, micro-facts, open house
 *   Footer: List Office left / List Agent right
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import {
  MapPin, Bed, Bath, Home, Calendar,
  Check, Mail, ExternalLink,
  Phone, Pin,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import ContactAgentDialog from "@/components/ContactAgentDialog";
import { LISTING_STATUS, isComingSoon } from "@/constants/status";
import { formatPhoneNumber } from "@/lib/phoneFormat";

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
  list_office_phone?: string | null;
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


  // ── Attribution row (shared between desktop & mobile) ─────────────────
  const AttributionRow = ({ compact = false }: { compact?: boolean }) => {
    const labelClass = compact ? "text-[11px]" : "text-xs";
    const valueClass = compact ? "text-[11px] font-medium text-foreground" : "text-xs font-medium text-foreground";

    return (
      <div className={`flex items-start justify-between gap-4 ${compact ? "flex-wrap" : ""}`}>
        {/* Left — List Office */}
        {listing.list_office && (
          <div className="min-w-0">
            <span className={`${labelClass} text-muted-foreground`}>List Office: </span>
            <span className={valueClass}>{listing.list_office}</span>
            {listing.list_office_phone && (
              <span className={`${labelClass} text-muted-foreground ml-2`}>
                <Phone className="h-3 w-3 inline mr-0.5" />{formatPhoneNumber(listing.list_office_phone)}
              </span>
            )}
          </div>
        )}

        {/* Right — List Agent */}
        {listing.agent_name && (
          <div className="min-w-0 text-right flex-shrink-0">
            <span className={`${labelClass} text-muted-foreground`}>List Agent: </span>
            <span className={valueClass}>{listing.agent_name}</span>
            {listing.agent_phone && (
              <span className={`${labelClass} text-muted-foreground ml-2`}>
                <Phone className="h-3 w-3 inline mr-0.5" />{formatPhoneNumber(listing.agent_phone)}
              </span>
            )}
            {!compact && listing.agent_email && (
              <span className={`${labelClass} text-muted-foreground ml-2`}>{listing.agent_email}</span>
            )}
            {listing.agent_id && (
              <button
                onClick={(e) => { e.stopPropagation(); setContactOpen(true); }}
                className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                {!compact && "Contact"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* ══ DESKTOP (md+) — custom MLS-style card ═══════════════════════ */}
      <Card
        className="hidden md:flex overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
        onClick={handleCardClick}
      >
        {/* Photo column */}
        <div className="relative flex-shrink-0 w-52 h-auto min-h-[9rem]">
          {onSelect && (
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(listing.id, e); }}
              className="absolute left-2 top-2 z-10 h-5 w-5 rounded-md border border-white/80 bg-white/90 shadow-sm flex items-center justify-center"
              aria-label="Select listing"
            >
              {isSelected && <Check className="h-3 w-3 text-emerald-600" />}
            </button>
          )}

          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <Home className="w-8 h-8 text-muted-foreground" />
            </div>
          )}


          {/* Photo count */}
          {(listing.photos?.length || 0) > 1 && (
            <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
              {listing.photos?.length}
            </div>
          )}
        </div>

        {/* Content column */}
        <div className="flex-1 p-4 flex flex-col min-w-0">
          {/* A. Header row: Address / Status / Price */}
          <div className="flex items-start gap-4">
            {/* Address block */}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm">
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
              <div className="flex items-center text-muted-foreground text-xs mt-0.5">
                <MapPin className="w-3 h-3 mr-1 text-primary" />
                {listing.city}, {listing.state} {listing.zip_code}
              </div>
              {listing.neighborhood && (
                <div className="flex items-center text-xs text-muted-foreground">
                  <Pin className="w-3 h-3 mr-1 text-red-400" fill="currentColor" />
                  {listing.neighborhood}
                </div>
              )}
            </div>

            {/* Status block — centered */}
            <div className="flex-shrink-0 flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Status:</span>
              <ListingStatusBadge status={listing.status} size="lg" />
            </div>

            {/* Price block — right-aligned stack, flex-1 for true status centering */}
            <div className="flex-1 text-right">
              <div className="text-lg font-bold text-primary">{displayPrice}</div>
              {pricePerSqFt && (
                <div className="text-xs text-muted-foreground">${pricePerSqFt}/sqft</div>
              )}
              <div className="mt-1">
                {listing.list_date && (
                  <div className="text-xs text-muted-foreground">List Date: {format(new Date(listing.list_date), "MM/dd/yy")}</div>
                )}
                {daysOnMarket > 0 && (
                  <div className="text-xs text-muted-foreground">DOM: {daysOnMarket}</div>
                )}
              </div>
            </div>
          </div>

          {/* B. Info row — tighter spacing with dot separator */}
          <div className="flex items-center text-xs text-muted-foreground">
            {listing.listing_number && (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/property/${listing.id}`, { state: { from: fromPath } }); }}
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Listing #{listing.listing_number}
              </button>
            )}
            {listing.listing_number && listing.property_type && (
              <span className="mx-1.5">·</span>
            )}
            {listing.property_type && (
              <span>{listing.property_type}</span>
            )}
          </div>

          {/* C. Stats row */}
          <div className="flex items-center gap-4 text-sm text-foreground mt-1">
            <span className="flex items-center gap-1">
              <Bed className="h-4 w-4 text-primary" /> {listing.bedrooms ?? "-"} Beds
            </span>
            <span className="flex items-center gap-1">
              <Bath className="h-4 w-4 text-primary" /> {listing.bathrooms ?? "-"} Baths
            </span>
            <span className="flex items-center gap-1">
              <Home className="h-4 w-4 text-primary" /> {listing.square_feet?.toLocaleString() ?? "-"} sqft
            </span>
          </div>

          {/* D. Micro-facts */}
          {microFacts.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1.5">
              {microFacts.join(" · ")}
            </div>
          )}

          {/* E. Open house banner */}
          {nextOpenHouse && (
            <div className="mt-2 flex items-center gap-1.5 text-xs p-2 rounded-md bg-emerald-50 border border-emerald-200">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-medium">
                Open House: {format(new Date(nextOpenHouse.date), "MMM d")} • {formatTime(nextOpenHouse.start_time)} – {formatTime(nextOpenHouse.end_time)}
              </span>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* F. Divider + G. Attribution row */}
          {(listing.list_office || listing.agent_name) && (
            <div className="border-t border-border pt-2.5 mt-2.5">
              <AttributionRow />
            </div>
          )}
        </div>
      </Card>

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

          {/* Attribution footer */}
          {(listing.list_office || listing.agent_name) && (
            <div className="mt-2.5 border-t border-border pt-2.5">
              <AttributionRow compact />
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

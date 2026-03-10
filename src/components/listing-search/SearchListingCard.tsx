/**
 * SearchListingCard — MLS-style search results card.
 *
 * Renders its own desktop + mobile layouts directly (does NOT use ListingCardShell).
 * Desktop layout follows MLS information architecture:
 *   Left column: Large photo + utility icon strip
 *   Right column: Scan row → Facts grid → Remarks → Attribution footer
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import {
  MapPin, Bed, Bath, Home, Calendar,
  Check, Mail, ExternalLink,
  Phone, Camera, FileText, Video,
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
  description?: string | null;
  num_fireplaces?: number | null;
  virtual_tour_url?: string | null;
  video_url?: string | null;
  documents?: any;
  floors?: number | null;
  lot_size?: number | null;
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

const humanize = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const getDocCount = (docs: any): number => {
  if (!docs) return 0;
  if (Array.isArray(docs)) return docs.length;
  return 0;
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
  const photoCount = Array.isArray(listing.photos) ? listing.photos.length : 0;
  const docCount = getDocCount(listing.documents);
  const propertyStyle = getPropertyStyle(listing);

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

  const fullAddress = `${listing.address}${unitNumber ? ` #${unitNumber}` : ""}, ${listing.city}, ${listing.state}`;

  const handleCardClick = () => {
    if (onRowClick) {
      onRowClick(listing);
    } else {
      navigate(`/property/${listing.id}`, { state: { from: fromPath } });
    }
  };

  // ── Facts grid data ─────────────────────────────────────────────────────
  const facts: { label: string; value: string }[] = [];
  if (propertyStyle) facts.push({ label: "Style", value: humanize(String(propertyStyle)) });
  if (listing.bedrooms != null) facts.push({ label: "Beds", value: String(listing.bedrooms) });
  if (listing.bathrooms != null) facts.push({ label: "Baths", value: String(listing.bathrooms) });
  if (listing.square_feet) facts.push({ label: "Living Area", value: `${listing.square_feet.toLocaleString()} sqft` });
  if (listing.garage_spaces) facts.push({ label: "Garage", value: String(listing.garage_spaces) });
  if (listing.total_parking_spaces) facts.push({ label: "Parking", value: String(listing.total_parking_spaces) });
  if (listing.num_fireplaces) facts.push({ label: "Fireplaces", value: String(listing.num_fireplaces) });
  if (listing.year_built) facts.push({ label: "Year Built", value: String(listing.year_built) });
  if (listing.floors) facts.push({ label: "Floors", value: String(listing.floors) });
  if (listing.lot_size) facts.push({ label: "Lot", value: `${listing.lot_size.toLocaleString()} sqft` });

  // ── Attribution row (shared between desktop & mobile) ─────────────────
  const AttributionRow = ({ compact = false }: { compact?: boolean }) => {
    const labelClass = compact ? "text-[11px] text-muted-foreground/70" : "text-[11px] text-muted-foreground/70";
    const valueClass = compact ? "text-[11px] text-foreground" : "text-xs text-foreground";

    return (
      <div className={`flex items-start justify-between gap-4 ${compact ? "flex-wrap" : ""}`}>
        {listing.list_office && (
          <div className="min-w-0">
            <span className={labelClass}>List Office: </span>
            <span className={valueClass}>{listing.list_office}</span>
            {listing.list_office_phone && (
              <span className={`${labelClass} ml-2`}>
                <Phone className="h-2.5 w-2.5 inline mr-0.5 opacity-60" />{formatPhoneNumber(listing.list_office_phone)}
              </span>
            )}
          </div>
        )}
        {listing.agent_name && (
          <div className="min-w-0 text-right flex-shrink-0">
            <span className={labelClass}>List Agent: </span>
            <span className={valueClass}>{listing.agent_name}</span>
            {listing.agent_phone && (
              <span className={`${labelClass} ml-2`}>
                <Phone className="h-2.5 w-2.5 inline mr-0.5 opacity-60" />{formatPhoneNumber(listing.agent_phone)}
              </span>
            )}
            {!compact && listing.agent_email && (
              <span className={`${labelClass} ml-2`}>{listing.agent_email}</span>
            )}
            {listing.agent_id && (
              <button
                onClick={(e) => { e.stopPropagation(); setContactOpen(true); }}
                className="ml-2.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 hover:underline transition-colors"
              >
                <Mail className="h-3 w-3" />
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
      {/* ══ DESKTOP (md+) — MLS-style two-column card ═══════════════════ */}
      <Card
        className="hidden md:block overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="flex items-start p-4 gap-5">
          {/* ── LEFT COLUMN: Photo + Utility strip ──────────────────────── */}
          <div className="flex-shrink-0 w-64">
            {/* A. Photo */}
            <div className="relative w-full aspect-[4/3] overflow-hidden rounded-lg bg-muted">
              {onSelect && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSelect(listing.id, e); }}
                  className="absolute left-2.5 top-2.5 z-10 h-5 w-5 rounded-md border border-white/80 bg-white/90 shadow-sm flex items-center justify-center"
                  aria-label="Select listing"
                >
                  {isSelected && <Check className="h-3 w-3 text-emerald-600" />}
                </button>
              )}
              {photoUrl ? (
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Home className="w-10 h-10 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* B. Utility icon strip under photo */}
            <div className="flex items-center gap-3 mt-2 px-0.5">
              {photoCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Camera className="h-3.5 w-3.5" /> {photoCount}
                </span>
              )}
              {docCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" /> {docCount}
                </span>
              )}
              {listing.virtual_tour_url && (
                <a
                  href={listing.virtual_tour_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  <Video className="h-3.5 w-3.5" /> Tour
                </a>
              )}
              {!listing.virtual_tour_url && listing.video_url && (
                <a
                  href={listing.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  <Video className="h-3.5 w-3.5" /> Video
                </a>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN: Listing content ───────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* SECTION 1 — Top scan row */}
            <div className="flex items-start gap-4">
              {/* Left: ID + Address */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs mb-0.5">
                  {listing.listing_number && (
                    <a
                      href={`/property/${listing.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/property/${listing.id}`, { state: { from: fromPath } });
                      }}
                      className="text-primary font-semibold hover:underline"
                    >
                      L-{listing.listing_number}
                    </a>
                  )}
                </div>
                <h3 className="text-base font-semibold text-foreground leading-tight">
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
                    <Badge variant="secondary" className="ml-2 text-xs align-middle">
                      Unit {unitNumber}
                    </Badge>
                  )}
                </h3>
                <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
                  {listing.city}, {listing.state} {listing.zip_code}
                  {listing.neighborhood && (
                    <span className="text-muted-foreground ml-1">· {listing.neighborhood}</span>
                  )}
                </div>
              </div>

              {/* Middle: Status + DOM + $/sqft */}
              <div className="flex-shrink-0 flex flex-col items-center gap-1 text-center min-w-[100px]">
                <ListingStatusBadge status={listing.status} size="lg" />
                {daysOnMarket > 0 && (
                  <span className="text-xs text-muted-foreground">{daysOnMarket} DOM</span>
                )}
                {pricePerSqFt && (
                  <span className="text-xs text-muted-foreground">${pricePerSqFt}/sqft</span>
                )}
              </div>

              {/* Right: Price + List Date */}
              <div className="flex-shrink-0 text-right min-w-[120px]">
                <div className="text-lg font-bold text-primary">{displayPrice}</div>
                {listing.list_date && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Listed {format(new Date(listing.list_date), "MM/dd/yy")}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2 — Structured facts grid */}
            {facts.length > 0 && (
              <div className="grid grid-cols-4 gap-x-6 gap-y-1 mt-3 pt-3 border-t border-border">
                {facts.map((f) => (
                  <div key={f.label} className="text-xs">
                    <span className="text-muted-foreground">{f.label}: </span>
                    <span className="font-medium text-foreground">{f.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* SECTION 3 — Remarks preview */}
            {listing.description && (
              <div className="mt-2.5 text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                {listing.description}
              </div>
            )}

            {/* Open house banner */}
            {nextOpenHouse && (
              <div className="mt-2.5 flex items-center gap-1.5 text-xs p-2 rounded-md bg-emerald-50 border border-emerald-200">
                <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-medium">
                  Open House: {format(new Date(nextOpenHouse.date), "MMM d")} • {formatTime(nextOpenHouse.start_time)} – {formatTime(nextOpenHouse.end_time)}
                </span>
              </div>
            )}

            {/* SECTION 4 — Attribution footer */}
            {(listing.list_office || listing.agent_name) && (
              <div className="border-t border-border mt-3 pt-2.5">
                <AttributionRow />
              </div>
            )}
          </div>
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
                {photoCount > 0 && (
                  <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                    {photoCount}
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

          {listing.year_built && (
            <div className="mt-1.5 text-[11px] text-muted-foreground truncate">
              Built {listing.year_built}
              {listing.total_parking_spaces ? ` · ${listing.total_parking_spaces} pkg` : ""}
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

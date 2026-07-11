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
import { ListingStatusBadge } from "@/components/ui/status-badge";
import {
  Bed, Bath, Home, Calendar, CircleParking,
  Check, Mail, ExternalLink,
  Phone, Camera, FileText, Video,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import ContactAgentDialog from "@/components/ContactAgentDialog";
import { ListingAgentEmailContact } from "@/components/listing/ListingAgentEmailContact";
import {
  listingAgentContactFromRow,
  listingEmailSubjectFromRow,
  type ListingAgentContact,
} from "@/lib/listingAgentContact";
import { LISTING_STATUS, isComingSoon } from "@/constants/status";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import DcmlsBadge from "@/components/DcmlsBadge";
import { resolveBrokerageAttribution, resolveListedByAttribution } from "@/lib/listingListedBy";
import { ListingCardAttributionStrip } from "@/components/listing/ListingCardAttributionStrip";
import { ListingCardPropertyTypeLine } from "@/components/listing/ListingCardPropertyTypeLine";
import { formatListingIdLabel, LISTING_ID_NAV_CLASS, LISTING_ID_NAV_CLASS_SEARCH_SURFACE } from "@/lib/listingIdDisplay";
import { formatListingEmailSubjectLocation } from "@/lib/listingEmailSubject";
import { buildDisplayAddress, cn } from "@/lib/utils";
import { ListingCardAddressLine } from "@/components/listing/ListingCardAddressLine";
import { ListingPhotoBanners } from "@/components/listing/ListingPhotoBanners";
import {
  listingSelectionCheckboxClass,
  listingSelectionSearchCardSelected,
} from "@/lib/listingSelectionStyles";
import { formatListingPriceDisplay, listingEffectiveNumericPrice } from "@/lib/formatListingPriceDisplay";
import { useListingBanners } from "@/hooks/useListingBanners";

// ── Types ───────────────────────────────────────────────────────────────────

interface SearchListing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number | null;
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
  brokerage_name?: string | null;
  listing_brokerage?: string | null;
  listing_agent_name?: string | null;
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
  publish_to_dcmls?: boolean;
  dcmls_status?: string;
  is_relisting?: boolean | null;
}

interface SearchListingCardProps {
  listing: SearchListing;
  isSelected?: boolean;
  onSelect?: (id: string, e?: React.SyntheticEvent) => void;
  onRowClick?: (listing: SearchListing) => void;
  fromPath?: string;
  /** Agent-only: internal email to listing agent (bottom-right). */
  showAgentEmailContact?: boolean;
  listingAgentContact?: ListingAgentContact | null;
  listingEmailSubject?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const resolvePhotoUrl = (photo: any): string | null => {
  if (typeof photo === "string") return photo;
  if (photo?.url) {
    if (photo.url.startsWith("http")) return photo.url;
    const { data } = supabase.storage.from("listing-photos").getPublicUrl(photo.url);
    return data.publicUrl;
  }
  return null;
};

const getFirstPhoto = (listing: SearchListing) => {
  if (listing.photos && Array.isArray(listing.photos) && listing.photos.length > 0) {
    return resolvePhotoUrl(listing.photos[0]);
  }
  return null;
};

const getAllPhotos = (listing: SearchListing): string[] => {
  if (!listing.photos || !Array.isArray(listing.photos)) return [];
  return listing.photos.map(resolvePhotoUrl).filter((u): u is string => u !== null);
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
  showAgentEmailContact = false,
  listingAgentContact: listingAgentContactProp = null,
  listingEmailSubject: listingEmailSubjectProp,
}: SearchListingCardProps) => {
  const navigate = useNavigate();
  const [contactOpen, setContactOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const resolvedListingAgentContact = showAgentEmailContact
    ? (listingAgentContactProp ?? listingAgentContactFromRow(listing))
    : null;
  const resolvedListingEmailSubject =
    listingEmailSubjectProp ?? listingEmailSubjectFromRow(listing);

  const photoUrl = getFirstPhoto(listing);
  const allPhotos = getAllPhotos(listing);
  const nextOpenHouse = getNextOpenHouse(listing.open_houses);
  const { statusBanner, priceChangeBanner, openHouseBanner } = useListingBanners({
    id: listing.id,
    status: listing.status,
    is_relisting: listing.is_relisting ?? null,
    open_houses: listing.open_houses,
  });
  const photoCount = Array.isArray(listing.photos) ? listing.photos.length : 0;
  const docCount = getDocCount(listing.documents);
  const propertyStyle = getPropertyStyle(listing);

  const displayPrice = formatListingPriceDisplay(listing) ?? "—";
  const basisForSqft = listingEffectiveNumericPrice(listing);
  const pricePerSqFt =
    listing.square_feet && listing.square_feet > 0 && basisForSqft != null && basisForSqft > 0
      ? Math.round(basisForSqft / listing.square_feet)
      : null;

  const fullAddress = buildDisplayAddress(listing);
  const emailSubjectLocation = formatListingEmailSubjectLocation(listing);
  const listedByLine = resolveListedByAttribution(listing);
  const brokerageAttribution = resolveBrokerageAttribution(listing);
  const showUnifiedAttributionFooter = Boolean(
    showAgentEmailContact && (brokerageAttribution || resolvedListingAgentContact),
  );

  const handleCardClick = () => {
    if (onRowClick) {
      onRowClick(listing);
    } else {
      navigate(`/property/${listing.id}`, { state: { from: fromPath } });
    }
  };

  const listingIdLabel = formatListingIdLabel(listing);

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
    const labelClass = compact ? "text-[11px] text-zinc-500 font-normal" : "text-xs text-zinc-500 font-normal";
    const valueClass = compact ? "text-[11px] text-zinc-700" : "text-xs text-zinc-700 font-medium";

    return (
      <div className={`flex items-start justify-between gap-4 ${compact ? "flex-wrap" : ""}`}>
        {listing.list_office && (
          <div className="min-w-0">
            <span className={labelClass}>List Office: </span>
            <span className={valueClass}>{listing.list_office}</span>
            {listing.list_office_phone && (
              <span className={`${labelClass} ml-2`}>
                <Phone className="mr-0.5 inline h-2.5 w-2.5 text-neutral-500" />{formatPhoneNumber(listing.list_office_phone)}
              </span>
            )}
          </div>
        )}
        {(listing.agent_name || resolvedListingAgentContact) && (
          <div className="min-w-0 flex-shrink-0 text-right">
            {resolvedListingAgentContact ? (
              <div onClick={(e) => e.stopPropagation()}>
                <ListingAgentEmailContact
                  contact={resolvedListingAgentContact}
                  defaultSubject={resolvedListingEmailSubject}
                />
              </div>
            ) : (
              <>
                <span className={labelClass}>List Agent: </span>
                <span className={valueClass}>{listing.agent_name}</span>
                {listing.agent_phone && (
                  <span className={`${labelClass} ml-2`}>
                    <Phone className="mr-0.5 inline h-2.5 w-2.5 text-neutral-500" />
                    {formatPhoneNumber(listing.agent_phone)}
                  </span>
                )}
                {!compact && listing.agent_email && (
                  <span className={`${labelClass} ml-2`}>{listing.agent_email}</span>
                )}
                {listing.agent_id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContactOpen(true);
                    }}
                    className="ml-3 inline-flex items-center gap-1 text-xs font-medium text-neutral-700 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline"
                  >
                    <Mail className="h-3 w-3" />
                    {!compact && "Contact"}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* ══ DESKTOP (md+) — MLS-style two-column card ═══════════════════ */}
      <div
        className={cn(
          "relative hidden cursor-pointer overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all duration-200 ease-out will-change-[box-shadow,border-color,transform] md:block",
          isSelected
            ? listingSelectionSearchCardSelected
            : "hover:-translate-y-px hover:border-neutral-300 hover:shadow-[0_4px_14px_rgba(0,0,0,0.07)]",
        )}
        onClick={handleCardClick}
      >
        <div className="flex items-start p-5 gap-6">
          {/* ── LEFT COLUMN: Photo + Utility strip ──────────────────────── */}
          <div className="flex-shrink-0 w-64">
            {/* A. Photo */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-neutral-100">
              <DcmlsBadge listing={listing} />
              <ListingPhotoBanners
                statusBanner={statusBanner}
                priceChangeBanner={priceChangeBanner}
                openHouseBanner={openHouseBanner}
                leading={
                  onSelect ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(listing.id, e);
                      }}
                      className={listingSelectionCheckboxClass(isSelected)}
                      aria-label="Select listing"
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </button>
                  ) : undefined
                }
              />
              {allPhotos.length > 0 ? (
                <img src={allPhotos[currentPhotoIndex] || photoUrl!} alt="" className="w-full h-full object-cover" />
              ) : photoUrl ? (
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Home className="h-10 w-10 text-neutral-400" />
                </div>
              )}
              {allPhotos.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentPhotoIndex((i) => (i - 1 + allPhotos.length) % allPhotos.length); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentPhotoIndex((i) => (i + 1) % allPhotos.length); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
                    {currentPhotoIndex + 1} / {allPhotos.length}
                  </div>
                </>
              )}
            </div>

            {/* B. Utility icon strip under photo */}
            <div className="flex items-center gap-3.5 mt-2.5 px-0.5">
              {photoCount > 0 && (
                 <span className="flex items-center gap-1 text-sm text-neutral-600">
                   <Camera className="h-4 w-4 text-neutral-500" /> {photoCount}
                 </span>
              )}
              {docCount > 0 && (
                 <span className="flex items-center gap-1 text-sm text-neutral-600">
                   <FileText className="h-4 w-4 text-neutral-500" /> {docCount}
                 </span>
              )}
              {listing.virtual_tour_url && (
                <a
                  href={listing.virtual_tour_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                   className="flex items-center gap-1 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-800"
                 >
                   <Video className="h-4 w-4 text-neutral-500" /> Tour
                </a>
              )}
              {!listing.virtual_tour_url && listing.video_url && (
                <a
                  href={listing.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                   className="flex items-center gap-1 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-800"
                 >
                   <Video className="h-4 w-4 text-neutral-500" /> Video
                </a>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN: Listing content ───────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* SECTION 1 — Top scan row: 3 zones */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-6">
              {/* LEFT: ID + Address */}
              <div className="min-w-0">
                {listingIdLabel && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardClick();
                    }}
                    className={cn(LISTING_ID_NAV_CLASS, "text-xs font-semibold text-left")}
                  >
                    {listingIdLabel}
                  </button>
                )}
                <ListingCardAddressLine
                  listing={listing}
                  className="mt-0.5"
                  mapsHref={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                />
              </div>

              {/* CENTER: Status */}
              <div className="flex items-center justify-center gap-1.5 pt-0.5">
                <span className="text-xs text-neutral-600">Status:</span>
                <ListingStatusBadge status={listing.status} size="sm" />
              </div>

              {/* RIGHT: Price + details */}
              <div className="text-right">
                <div className="text-base font-bold text-neutral-900">{displayPrice}</div>
                {pricePerSqFt && (
                  <div className="mt-0.5 text-xs text-neutral-600">${pricePerSqFt}/sqft</div>
                )}
                {listing.list_date && (
                  <div className="mt-0.5 text-xs text-neutral-600">
                    Listed {format(new Date(listing.list_date), "MM/dd/yy")}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2 — Structured facts grid */}
            {facts.length > 0 && (
              <div className="mt-5 grid grid-cols-4 gap-x-8 gap-y-2 border-t border-neutral-100 pt-3.5">
                {facts.map((f) => (
                  <div key={f.label} className="text-xs">
                    <span className="text-zinc-500">{f.label}:</span>{" "}
                    <span className="font-medium text-foreground">{f.value}</span>
                  </div>
                ))}
              </div>
            )}

            {listedByLine && !showUnifiedAttributionFooter && (
              <p
                className={`truncate text-[12px] font-normal text-neutral-500 ${facts.length > 0 ? "mt-3" : "mt-4"}`}
                title={listedByLine}
              >
                {listedByLine}
              </p>
            )}

            {/* SECTION 3 — Remarks preview */}
            {listing.description && (
              <div className="mt-4 line-clamp-3 text-sm leading-relaxed text-neutral-600">
                {listing.description}
              </div>
            )}

            {/* Open house banner */}
            {nextOpenHouse && (
              <div className="mt-3.5 flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-xs">
                <Calendar className="h-3.5 w-3.5 text-emerald-700" />
                <span className="font-medium text-emerald-900">
                  Open House: {format(new Date(nextOpenHouse.date), "MMM d")} • {formatTime(nextOpenHouse.start_time)} – {formatTime(nextOpenHouse.end_time)}
                </span>
              </div>
            )}

          </div>
        </div>

        {/* SECTION 4 — Attribution footer (full card width) */}
        {showUnifiedAttributionFooter ? (
          <div className="border-t border-zinc-200 mx-5 mb-4 pt-2">
            <ListingCardAttributionStrip
              brokerageName={brokerageAttribution}
              contact={resolvedListingAgentContact}
              defaultSubject={resolvedListingEmailSubject}
            />
          </div>
        ) : (listing.list_office || listing.agent_name) ? (
          <div className="border-t border-zinc-200 mx-5 mb-4 pt-2.5">
            <AttributionRow />
          </div>
        ) : null}
      </div>
      {/* ══ MOBILE (< md) — search-specific compact layout ═════════════ */}
      <Card
        className={cn(
          "cursor-pointer overflow-hidden border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-[box-shadow,border-color] md:hidden",
          isSelected
            ? "ring-1 ring-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border-neutral-400"
            : "hover:border-neutral-300 hover:shadow-[0_4px_14px_rgba(0,0,0,0.07)]",
        )}
        onClick={handleCardClick}
      >
        <div className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-shrink-0">
              <div className="relative h-[75px] w-[100px] overflow-hidden rounded-md bg-neutral-100">
                <DcmlsBadge listing={listing} />
                <ListingPhotoBanners
                  statusBanner={statusBanner}
                  priceChangeBanner={priceChangeBanner}
                  openHouseBanner={openHouseBanner}
                  compact
                  className="top-1.5 left-1.5"
                  leading={
                    onSelect ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(listing.id, e);
                        }}
                        className={listingSelectionCheckboxClass(isSelected)}
                        aria-label="Select listing"
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </button>
                    ) : undefined
                  }
                />
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Home className="h-6 w-6 text-neutral-400" />
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
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                <span className="text-base font-bold text-neutral-900">{displayPrice}</span>
                {pricePerSqFt ? (
                  <span className="text-xs text-neutral-600">${pricePerSqFt}/sqft</span>
                ) : null}
              </div>
              <ListingCardPropertyTypeLine propertyType={listing.property_type} className="mt-0.5" />
              <ListingCardAddressLine listing={listing} className="mt-1" />
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <ListingStatusBadge status={listing.status} size="sm" />
                {listingIdLabel && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardClick();
                    }}
                    className={cn(LISTING_ID_NAV_CLASS_SEARCH_SURFACE, "text-[11px] font-mono font-normal")}
                  >
                    {listingIdLabel}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 border-t border-neutral-100 pt-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1 text-sm text-neutral-600">
                <Bed className="h-3.5 w-3.5 text-[#0E56F5]" /> {listing.bedrooms ?? "-"}
              </span>
              <span className="flex items-center gap-1 text-sm text-neutral-600">
                <Bath className="h-3.5 w-3.5 text-[#0E56F5]" /> {listing.bathrooms ?? "-"}
              </span>
              <span className="flex items-center gap-1 text-sm text-neutral-600">
                <Home className="h-3.5 w-3.5 text-[#0E56F5]" /> {listing.square_feet?.toLocaleString() ?? "-"} sqft
              </span>
              <span className="flex items-center gap-1 text-sm text-neutral-600">
                <CircleParking className="h-3.5 w-3.5 text-[#0E56F5]" /> {listing.total_parking_spaces ?? 0}
              </span>
              {listing.list_date && (
                <span className="flex items-center gap-1 text-sm text-neutral-600">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">DOM</span>
                  {Math.max(0, Math.floor((Date.now() - new Date(listing.list_date).getTime()) / 86400000))}
                </span>
              )}
            </div>
          </div>

          {listedByLine && (
            <p className="mt-2 truncate text-[12px] font-normal text-neutral-500" title={`Listed by: ${listedByLine}`}>
              Listed by: {listedByLine}
            </p>
          )}

          {listing.year_built && (
            <div className="mt-1.5 truncate text-[11px] text-neutral-600">
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
            <div className="mt-1 text-[11px] text-neutral-600">
              Listed {format(new Date(listing.list_date), "MM/dd/yy")}
            </div>
          )}

          {showUnifiedAttributionFooter ? (
            <div className="mt-2 border-t border-neutral-100 pt-2">
              <ListingCardAttributionStrip
                brokerageName={brokerageAttribution}
                contact={resolvedListingAgentContact}
                defaultSubject={resolvedListingEmailSubject}
              />
            </div>
          ) : (listing.list_office || listing.agent_name) ? (
            <div className="mt-2.5 border-t border-neutral-100 pt-2.5">
              <AttributionRow compact />
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-end gap-3 border-t border-neutral-100 pt-3">
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/property/${listing.id}`, { state: { from: fromPath } }); }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 transition hover:text-neutral-900"
            >
              <ExternalLink className="h-4 w-4" /> View
            </button>
            {!showAgentEmailContact && resolvedListingAgentContact ? (
              <div onClick={(e) => e.stopPropagation()}>
                <ListingAgentEmailContact
                  contact={resolvedListingAgentContact}
                  defaultSubject={resolvedListingEmailSubject}
                  className="text-sm"
                />
              </div>
            ) : !showAgentEmailContact && listing.agent_id ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContactOpen(true);
                }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 transition hover:text-neutral-900"
              >
                <Mail className="h-4 w-4 text-neutral-500" /> Contact
              </button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Contact Dialog */}
      {!showAgentEmailContact && listing.agent_id && (
        <ContactAgentDialog
          listingId={listing.id}
          agentId={listing.agent_id}
          listingAddress={emailSubjectLocation || fullAddress}
          open={contactOpen}
          onOpenChange={setContactOpen}
          hideTrigger
        />
      )}
    </>
  );
};

export default SearchListingCard;

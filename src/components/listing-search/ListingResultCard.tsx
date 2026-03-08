import { useState } from "react";
import { Check, ExternalLink, Mail, Bed, Bath, Home, Sparkles, RefreshCw, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import ContactAgentDialog from "@/components/ContactAgentDialog";
import { LISTING_STATUS, isComingSoon } from "@/constants/status";
import { format } from "date-fns";

interface Listing {
  id: string;
  listing_number: string;
  address: string;
  unit_number?: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  status: string;
  list_date?: string;
  photos?: any;
  neighborhood?: string;
  agent_name?: string | null;
  agent_id?: string | null;
  list_office?: string | null;
  year_built?: number;
  garage_spaces?: number;
  total_parking_spaces?: number;
  property_type?: string;
  property_styles?: any;
  open_houses?: any[];
}

interface ListingResultCardProps {
  listing: Listing;
  isSelected: boolean;
  onSelect: (id: string, e?: React.SyntheticEvent) => void;
  onRowClick: (listing: Listing) => void;
  fromPath?: string;
}

// ── Formatters ──────────────────────────────────────────────────────────────

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);

const getThumbnail = (listing: Listing) => {
  if (listing.photos && Array.isArray(listing.photos) && listing.photos.length > 0) {
    const photo = listing.photos[0];
    return typeof photo === "string" ? photo : photo?.url || null;
  }
  return null;
};

const getPhotoCount = (listing: Listing) => {
  if (listing.photos && Array.isArray(listing.photos)) return listing.photos.length;
  return 0;
};

const getPricePerSqFt = (price: number, sqft?: number) => {
  if (!sqft || sqft === 0) return null;
  return Math.round(price / sqft);
};

const getPropertyStyle = (listing: Listing) => {
  if (listing.property_styles) {
    if (Array.isArray(listing.property_styles) && listing.property_styles.length > 0) return listing.property_styles[0];
    if (typeof listing.property_styles === "string") return listing.property_styles;
  }
  return listing.property_type || null;
};

// ── Location helpers ────────────────────────────────────────────────────────

const BOSTON_NEIGHBORHOODS = new Set(
  [
    "allston", "back bay", "bay village", "beacon hill", "brighton",
    "charlestown", "chinatown", "dorchester", "downtown", "east boston",
    "fenway", "fenway-kenmore", "hyde park", "jamaica plain", "mattapan",
    "mission hill", "north end", "roslindale", "roxbury", "south boston",
    "south boston waterfront", "south end", "west end", "west roxbury",
    "seaport", "leather district", "financial district",
  ].map((s) => s.toLowerCase())
);

const norm = (s?: string) => (s || "").trim().toLowerCase();
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const sanitizeStreet = (raw?: string) => {
  const s = (raw || "").trim();
  if (!s) return "";
  return s.replace(/(?:,\s*[^,]+,\s*[A-Za-z]{2}\s*\d{5})+$/i, "").trim();
};

const extractZipFromAddress = (raw?: string) => {
  const m = (raw || "").match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : "";
};

const getLocation = (listing: Listing) => {
  const street = sanitizeStreet(listing.address);
  const cityRaw = (listing.city || "").trim();
  const neighborhoodRaw = (listing.neighborhood || "").trim();
  const neighborhood = neighborhoodRaw ? neighborhoodRaw.replace(/^boston\s*[-,]\s*/i, "").trim() : "";
  const neighborhoodKey = norm(neighborhood);
  const isBoston = norm(cityRaw) === "boston" || (neighborhoodKey && BOSTON_NEIGHBORHOODS.has(neighborhoodKey));
  const zipRaw = (listing.zip_code || "").trim();
  const zip = zipRaw && zipRaw !== "00000" ? zipRaw : extractZipFromAddress(listing.address) || "";
  const state = (listing.state || "MA").trim().toUpperCase() || "MA";
  const city = isBoston ? "Boston" : titleCase(cityRaw || "");
  const showNeighborhood = isBoston ? !!neighborhood : !!neighborhood && norm(neighborhood) !== norm(city);

  return { street, city, state, zip, neighborhood: neighborhood ? titleCase(neighborhood) : "", showNeighborhood };
};

// ── DOM calculator ──────────────────────────────────────────────────────────

const calculateDaysOnMarket = (listDate?: string) => {
  if (!listDate) return null;
  const start = new Date(listDate);
  const today = new Date();
  const diffDays = Math.ceil(Math.abs(today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays;
};

// ── Open house helpers ──────────────────────────────────────────────────────

const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
};

const getNextOpenHouse = (openHouses?: any[]) => {
  if (!openHouses || !Array.isArray(openHouses)) return null;
  const now = new Date();
  const upcoming = openHouses
    .filter((oh: any) => {
      const ohEnd = new Date(`${oh.date}T${oh.end_time}:00`);
      return ohEnd > now;
    })
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return upcoming[0] || null;
};

// ── Status banner logic (status-driven, no DB fetch) ────────────────────────

const getStatusBanner = (status: string) => {
  if (isComingSoon(status)) {
    return { text: "COMING SOON", color: "bg-purple-600", icon: Sparkles };
  }
  if (status === LISTING_STATUS.NEW) {
    return { text: "NEW LISTING", color: "bg-blue-600", icon: Sparkles };
  }
  if (status === LISTING_STATUS.BACK_ON_MARKET) {
    return { text: "BACK ON MARKET", color: "bg-orange-600", icon: RefreshCw };
  }
  if (status === LISTING_STATUS.PRICE_CHANGED) {
    return { text: "PRICE REDUCED", color: "bg-red-600", icon: Sparkles };
  }
  return null;
};

// ── Photo Banners Sub-component ─────────────────────────────────────────────

const PhotoBanners = ({ listing }: { listing: Listing }) => {
  const statusBanner = getStatusBanner(listing.status);
  const nextOH = getNextOpenHouse(listing.open_houses);

  if (!statusBanner && !nextOH) return null;

  return (
    <div className="absolute top-0 left-0 right-0 flex flex-col gap-0.5 z-[5]">
      {statusBanner && (
        <div className={`${statusBanner.color} text-white text-[10px] font-bold tracking-wider px-2 py-1 flex items-center gap-1`}>
          <statusBanner.icon className="h-3 w-3" />
          {statusBanner.text}
        </div>
      )}
      {nextOH && (
        <div className="bg-green-600 text-white text-[10px] font-bold tracking-wider px-2 py-1 flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          OPEN HOUSE · {format(new Date(nextOH.date), "MMM d")}
        </div>
      )}
    </div>
  );
};

// ── Stats Row Sub-component ─────────────────────────────────────────────────

const StatsRow = ({ listing, pricePerSqFt }: { listing: Listing; pricePerSqFt: number | null }) => (
  <div className="flex items-center gap-3 flex-wrap">
    <span className="text-base font-bold text-zinc-900">
      {listing.price > 0 ? formatPrice(listing.price) : "Price TBD"}
    </span>
    {pricePerSqFt && <span className="text-xs text-zinc-500">${pricePerSqFt}/sqft</span>}
    <span className="flex items-center gap-1 text-sm text-zinc-600">
      <Bed className="h-3.5 w-3.5" /> {listing.bedrooms ?? "-"}
    </span>
    <span className="flex items-center gap-1 text-sm text-zinc-600">
      <Bath className="h-3.5 w-3.5" /> {listing.bathrooms ?? "-"}
    </span>
    <span className="flex items-center gap-1 text-sm text-zinc-600">
      <Home className="h-3.5 w-3.5" /> {listing.square_feet?.toLocaleString() ?? "-"} sqft
    </span>
  </div>
);

// ── Main Component ──────────────────────────────────────────────────────────

export const ListingResultCard = ({
  listing,
  isSelected,
  onSelect,
  onRowClick,
  fromPath,
}: ListingResultCardProps) => {
  const navigate = useNavigate();
  const thumbnail = getThumbnail(listing);
  const loc = getLocation(listing);
  const photoCount = getPhotoCount(listing);
  const pricePerSqFt = getPricePerSqFt(listing.price, listing.square_feet);
  const [contactOpen, setContactOpen] = useState(false);
  const dom = calculateDaysOnMarket(listing.list_date);
  const nextOH = getNextOpenHouse(listing.open_houses);

  // Build micro-facts (only: year built, parking, property type)
  const microFacts: string[] = [];
  if (listing.year_built) microFacts.push(`Built ${listing.year_built}`);
  const parking = listing.garage_spaces || listing.total_parking_spaces;
  if (parking) microFacts.push(`${parking} pkg`);
  const style = getPropertyStyle(listing);
  if (style) microFacts.push(style);

  const handleCardClick = () => {
    navigate(`/property/${listing.id}`, { state: { from: fromPath } });
  };

  const fullAddress = `${loc.street}${listing.unit_number ? ` #${listing.unit_number}` : ""}, ${loc.city}, ${loc.state}`;

  // ── Shared UI fragments ───────────────────────────────────────────────────

  const checkboxButton = (size: "sm" | "md") => (
    <button
      onClick={(e) => { e.stopPropagation(); onSelect(listing.id, e); }}
      className={`absolute left-2 top-2 z-10 ${size === "sm" ? "h-5 w-5" : "h-5 w-5"} rounded-md border border-white/80 bg-white/90 shadow-sm flex items-center justify-center`}
      aria-label="Select listing"
    >
      {isSelected && <Check className="h-3 w-3 text-emerald-600" />}
    </button>
  );

  const actionButtons = (
    <div className="flex items-center gap-3">
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/property/${listing.id}`, { state: { from: fromPath } }); }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 transition hover:text-emerald-600"
      >
        <ExternalLink className="h-4 w-4" />
        View
      </button>
      {listing.agent_id && (
        <button
          onClick={(e) => { e.stopPropagation(); setContactOpen(true); }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 transition hover:text-emerald-600"
        >
          <Mail className="h-4 w-4" />
          Contact
        </button>
      )}
    </div>
  );

  return (
    <div
      onClick={handleCardClick}
      className="rounded-2xl border border-zinc-200 bg-white p-4 cursor-pointer transition-all duration-200 hover:border-zinc-300 hover:-translate-y-[1px] hover:shadow-lg will-change-transform shadow-sm focus-within:shadow-lg"
    >
      {/* DESKTOP (md+): horizontal layout */}
      <div className="hidden md:flex gap-4">
        {/* Photo area */}
        <div className="relative flex-shrink-0">
          {checkboxButton("md")}
          <div className={`relative h-[140px] w-[200px] overflow-hidden rounded-xl bg-zinc-50 ${isSelected ? "ring-2 ring-emerald-300/30 border border-emerald-400" : "border border-zinc-200/70"}`}>
            {thumbnail ? (
              <img src={thumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">No photo</div>
            )}
            {/* Status + Open House banners */}
            <PhotoBanners listing={listing} />
            {photoCount > 0 && (
              <div className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white font-medium z-[5]">
                {photoCount}
              </div>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Row 1: Address + Neighborhood */}
          <div className="text-sm font-semibold text-zinc-900 truncate">
            {loc.street}{listing.unit_number ? ` #${listing.unit_number}` : ""}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {loc.city}{loc.city ? "," : ""} {loc.state} {loc.zip}
            {loc.showNeighborhood && ` · ${loc.neighborhood}`}
          </div>

          {/* Row 2: Status + Listing # + DOM + List Date */}
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <ListingStatusBadge status={listing.status} size="sm" />
            <span className="text-[11px] font-mono text-zinc-500">#{listing.listing_number}</span>
            {dom !== null && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium text-zinc-500 border-zinc-200">
                {dom} DOM
              </Badge>
            )}
            {listing.list_date && (
              <span className="text-[11px] text-zinc-400">
                Listed {format(new Date(listing.list_date), "MMM d, yyyy")}
              </span>
            )}
          </div>

          {/* Row 3: Price + Stats with icons */}
          <div className="mt-2">
            <StatsRow listing={listing} pricePerSqFt={pricePerSqFt} />
          </div>

          {/* Row 4: Micro-facts */}
          {microFacts.length > 0 && (
            <div className="mt-1 text-[11px] text-zinc-500 truncate">
              {microFacts.join(" · ")}
            </div>
          )}

          {/* Row 5: Open house info row (compact, below micro-facts) */}
          {nextOH && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-green-700 font-medium">
              <Calendar className="h-3 w-3" />
              Open House: {format(new Date(nextOH.date), "MMM d")} · {formatTime(nextOH.start_time)} – {formatTime(nextOH.end_time)}
            </div>
          )}

          {/* Row 6: Agent */}
          {listing.agent_name && (
            <div className="mt-1.5">
              <span className="text-sm font-semibold text-zinc-900">{listing.agent_name}</span>
              {listing.list_office && (
                <span className="text-xs text-zinc-500 ml-2">{listing.list_office}</span>
              )}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-grow" />

          {/* Row 7: Actions (bottom-right) */}
          <div className="mt-2 flex items-center justify-end">
            {actionButtons}
          </div>
        </div>
      </div>

      {/* MOBILE (< md): vertical layout */}
      <div className="md:hidden flex flex-col">
        {/* Photo + Address row */}
        <div className="flex gap-3">
          <div className="relative flex-shrink-0">
            {checkboxButton("sm")}
            <div className={`relative h-[75px] w-[100px] overflow-hidden rounded-xl bg-zinc-50 ${isSelected ? "ring-2 ring-emerald-300/30 border border-emerald-400" : "border border-zinc-200/70"}`}>
              {thumbnail ? (
                <img src={thumbnail} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-400">No photo</div>
              )}
              <PhotoBanners listing={listing} />
              {photoCount > 0 && (
                <div className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white z-[5]">
                  {photoCount}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-zinc-900 truncate">
              {loc.street}{listing.unit_number ? ` #${listing.unit_number}` : ""}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {loc.city}{loc.city ? "," : ""} {loc.state} {loc.zip}
              {loc.showNeighborhood && ` · ${loc.neighborhood}`}
            </div>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <ListingStatusBadge status={listing.status} size="sm" />
              <span className="text-[11px] font-mono text-zinc-500">#{listing.listing_number}</span>
              {dom !== null && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium text-zinc-500 border-zinc-200">
                  {dom} DOM
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-3 border-t border-zinc-100 pt-3">
          <StatsRow listing={listing} pricePerSqFt={pricePerSqFt} />
        </div>

        {/* Micro-facts */}
        {microFacts.length > 0 && (
          <div className="mt-1.5 text-[11px] text-zinc-500 truncate">
            {microFacts.join(" · ")}
          </div>
        )}

        {/* Open house info */}
        {nextOH && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-green-700 font-medium">
            <Calendar className="h-3 w-3" />
            OH: {format(new Date(nextOH.date), "MMM d")} · {formatTime(nextOH.start_time)} – {formatTime(nextOH.end_time)}
          </div>
        )}

        {/* List date on mobile */}
        {listing.list_date && (
          <div className="mt-1 text-[11px] text-zinc-400">
            Listed {format(new Date(listing.list_date), "MMM d, yyyy")}
          </div>
        )}

        {/* Agent */}
        {listing.agent_name && (
          <div className="mt-2 px-0.5">
            <div className="text-sm font-semibold text-zinc-900 truncate">{listing.agent_name}</div>
            {listing.list_office && <div className="text-xs text-zinc-500 truncate">{listing.list_office}</div>}
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center justify-end border-t border-zinc-100 pt-3">
          {actionButtons}
        </div>
      </div>

      {/* Contact Dialog (owned by card) */}
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
    </div>
  );
};

export default ListingResultCard;

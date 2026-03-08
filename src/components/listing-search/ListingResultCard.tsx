import { useState } from "react";
import { Check, ExternalLink, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import ContactAgentDialog from "@/components/ContactAgentDialog";

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
}

interface ListingResultCardProps {
  listing: Listing;
  isSelected: boolean;
  onSelect: (id: string, e?: React.SyntheticEvent) => void;
  onRowClick: (listing: Listing) => void;
  fromPath?: string;
}

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

  return (
    <div
      onClick={handleCardClick}
      className="rounded-2xl border border-zinc-200 bg-white p-4 cursor-pointer transition-all duration-200 hover:border-zinc-300 hover:-translate-y-[1px] hover:shadow-lg will-change-transform shadow-sm focus-within:shadow-lg"
    >
      {/* DESKTOP (md+): horizontal layout */}
      <div className="hidden md:flex gap-4">
        {/* Photo area */}
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(listing.id, e); }}
            className="absolute left-2 top-2 z-10 h-5 w-5 rounded-md border border-white/80 bg-white/90 shadow-sm flex items-center justify-center"
            aria-label="Select listing"
          >
            {isSelected && <Check className="h-3 w-3 text-emerald-600" />}
          </button>
          <div className={`relative h-[140px] w-[200px] overflow-hidden rounded-xl bg-zinc-50 ${isSelected ? "ring-2 ring-emerald-300/30 border border-emerald-400" : "border border-zinc-200/70"}`}>
            {thumbnail ? (
              <img src={thumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">No photo</div>
            )}
            {photoCount > 0 && (
              <div className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white font-medium">
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

          {/* Row 2: Status + Listing # */}
          <div className="mt-1.5 flex items-center gap-2">
            <ListingStatusBadge status={listing.status} size="sm" />
            <span className="text-[11px] font-mono text-zinc-500">#{listing.listing_number}</span>
          </div>

          {/* Row 3: Price + Stats */}
          <div className="mt-2 flex items-baseline gap-4">
            <span className="text-base font-bold text-zinc-900">{formatPrice(listing.price)}</span>
            {pricePerSqFt && <span className="text-xs text-zinc-500">${pricePerSqFt}/sqft</span>}
            <span className="text-sm text-zinc-600">{listing.bedrooms || "-"} bd</span>
            <span className="text-sm text-zinc-600">{listing.bathrooms || "-"} ba</span>
            <span className="text-sm text-zinc-600">{listing.square_feet?.toLocaleString() || "-"} sqft</span>
          </div>

          {/* Row 4: Micro-facts */}
          {microFacts.length > 0 && (
            <div className="mt-1 text-[11px] text-zinc-500 truncate">
              {microFacts.join(" · ")}
            </div>
          )}

          {/* Row 5: Agent */}
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

          {/* Row 6: Actions (bottom-right) */}
          <div className="mt-2 flex items-center justify-end gap-3">
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
        </div>
      </div>

      {/* MOBILE (< md): vertical layout */}
      <div className="md:hidden flex flex-col">
        {/* Photo + Address row */}
        <div className="flex gap-3">
          <div className="relative flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(listing.id, e); }}
              className="absolute left-1.5 top-1.5 z-10 h-5 w-5 rounded-md border border-white/80 bg-white/90 shadow flex items-center justify-center"
              aria-label="Select listing"
            >
              {isSelected && <Check className="h-3 w-3 text-emerald-600" />}
            </button>
            <div className={`relative h-[75px] w-[100px] overflow-hidden rounded-xl bg-zinc-50 ${isSelected ? "ring-2 ring-emerald-300/30 border border-emerald-400" : "border border-zinc-200/70"}`}>
              {thumbnail ? (
                <img src={thumbnail} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-400">No photo</div>
              )}
              {photoCount > 0 && (
                <div className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
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
            <div className="mt-1.5 flex items-center gap-2">
              <ListingStatusBadge status={listing.status} size="sm" />
              <span className="text-[11px] font-mono text-zinc-500">#{listing.listing_number}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-3 flex items-center gap-4 text-sm border-t border-zinc-100 pt-3">
          <span className="font-semibold text-zinc-900">{formatPrice(listing.price)}</span>
          {pricePerSqFt && <span className="text-xs text-zinc-500">${pricePerSqFt}/sqft</span>}
          <span className="text-zinc-600">{listing.bedrooms || "-"} bd</span>
          <span className="text-zinc-600">{listing.bathrooms || "-"} ba</span>
          <span className="text-zinc-600">{listing.square_feet?.toLocaleString() || "-"} sqft</span>
        </div>

        {/* Micro-facts */}
        {microFacts.length > 0 && (
          <div className="mt-1.5 text-[11px] text-zinc-500 truncate">
            {microFacts.join(" · ")}
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
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/property/${listing.id}`, { state: { from: fromPath } }); }}
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-emerald-600"
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

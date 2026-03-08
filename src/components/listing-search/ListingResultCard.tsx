import { useState } from "react";
import { Check, ExternalLink, Mail, Bed, Bath, Home, Sparkles, RefreshCw, Calendar, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
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

// ── Status banner logic ─────────────────────────────────────────────────────

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
  const statusBanner = getStatusBanner(listing.status);

  // Build micro-facts
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

  // ── Checkbox ──────────────────────────────────────────────────────────────

  const checkboxButton = (
    <button
      onClick={(e) => { e.stopPropagation(); onSelect(listing.id, e); }}
      className="absolute left-2 top-2 z-10 h-5 w-5 rounded-md border border-white/80 bg-white/90 shadow-sm flex items-center justify-center"
      aria-label="Select listing"
    >
      {isSelected && <Check className="h-3 w-3 text-emerald-600" />}
    </button>
  );

  return (
    <Card
      onClick={handleCardClick}
      className={`overflow-hidden cursor-pointer border-l-4 border-l-primary hover:shadow-md transition-shadow ${isSelected ? "ring-2 ring-emerald-300/30" : ""}`}
    >
      {/* DESKTOP (md+): horizontal data-row layout matching My Listings */}
      <div className="hidden md:flex gap-4 p-4">
        {/* Photo area — 160×160 square */}
        <div className="relative w-40 h-40 flex-shrink-0">
          {checkboxButton}
          {thumbnail ? (
            <img src={thumbnail} alt="" className="w-full h-full object-cover rounded" />
          ) : (
            <div className="w-full h-full bg-muted rounded flex items-center justify-center">
              <Home className="w-8 h-8 text-muted-foreground" />
            </div>
          )}

          {/* Status Banner */}
          {statusBanner && (
            <div className={`absolute top-0 left-0 right-0 ${statusBanner.color} text-white text-xs font-bold px-2 py-1 text-center flex items-center justify-center gap-1`}>
              <statusBanner.icon className="w-3 h-3" />
              {statusBanner.text}
            </div>
          )}

          {/* Open House Banner (stacks below status) */}
          {nextOH && (
            <div className={`absolute ${statusBanner ? 'top-6' : 'top-0'} left-0 right-0 bg-green-600 text-white text-xs font-bold px-2 py-1 text-center`}>
              🎈 {format(new Date(nextOH.date), "MMM d")} • {formatTime(nextOH.start_time)}–{formatTime(nextOH.end_time)}
            </div>
          )}

          {/* Photo count badge — bottom-left */}
          {photoCount > 0 && (
            <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
              {photoCount} Photos
            </div>
          )}
        </div>

        {/* Content area — grid matching My Listings structure */}
        <div className="flex-1 grid grid-cols-12 gap-3">
          {/* Col 1-6: Main Info */}
          <div className="col-span-6">
            {/* Address */}
            <h3 className="font-semibold text-sm mb-1">
              {loc.street}
              {listing.unit_number && (
                <Badge variant="secondary" className="ml-2 text-xs">Unit {listing.unit_number}</Badge>
              )}
            </h3>

            {/* Location with MapPin + neighborhood Badge */}
            <div className="flex items-center text-muted-foreground text-xs mb-2">
              <MapPin className="w-3 h-3 mr-1" />
              {loc.city}{loc.city ? "," : ""} {loc.state} {loc.zip}
              {loc.showNeighborhood && (
                <Badge variant="secondary" className="ml-2 text-xs">{loc.neighborhood}</Badge>
              )}
            </div>

            {/* Metadata: Listing #, DOM */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <span>Listing #{listing.listing_number}</span>
              {dom !== null && dom > 0 && (
                <>
                  <span>•</span>
                  <Badge variant="outline" className="text-xs">
                    {dom} {dom === 1 ? 'day' : 'days'} on market
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

            {/* Stats: beds/baths/sqft with icons */}
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

            {/* Open House Info — colored card style */}
            {nextOH && (
              <div className="flex items-center gap-1.5 text-xs p-2 rounded-md mb-2 bg-emerald-50 border border-emerald-200">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <div className="flex-1">
                  <div className="font-semibold text-emerald-700">Open House</div>
                  <div className="text-emerald-600">
                    {format(new Date(nextOH.date), "EEE, MMM d")} • {formatTime(nextOH.start_time)} – {formatTime(nextOH.end_time)}
                  </div>
                </div>
              </div>
            )}

            {/* Agent info */}
            {listing.agent_name && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{listing.agent_name}</span>
                {listing.list_office && (
                  <span className="ml-2">{listing.list_office}</span>
                )}
              </div>
            )}
          </div>

          {/* Col 7-8: Status */}
          <div className="col-span-2">
            <ListingStatusBadge status={listing.status} size="sm" className="mb-1" />
            {listing.property_type && (
              <div className="text-xs text-muted-foreground">{listing.property_type}</div>
            )}
          </div>

          {/* Col 9-10: Price (right-aligned) */}
          <div className="col-span-2 text-right">
            <div className="text-base font-bold text-primary mb-0.5">
              {listing.price > 0 ? formatPrice(listing.price) : "Price TBD"}
            </div>
            <div className="text-xs text-muted-foreground">Sale</div>
            {listing.list_date && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(listing.list_date), "MM/dd/yy")}
              </div>
            )}
          </div>

          {/* Col 11-12: Actions (View + Contact) */}
          <div className="col-span-2 flex flex-col gap-1.5 justify-center pt-1">
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/property/${listing.id}`, { state: { from: fromPath } }); }}
              className="inline-flex items-center justify-center gap-1.5 text-sm font-medium rounded-md border border-input bg-background px-3 py-1.5 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View
            </button>
            {listing.agent_id && (
              <button
                onClick={(e) => { e.stopPropagation(); setContactOpen(true); }}
                className="inline-flex items-center justify-center gap-1.5 text-sm font-medium rounded-md border border-input bg-background px-3 py-1.5 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Mail className="h-3.5 w-3.5" />
                Contact
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE (< md): compact vertical layout */}
      <div className="md:hidden p-4">
        {/* Photo + Address row */}
        <div className="flex gap-3">
          <div className="relative flex-shrink-0">
            {checkboxButton}
            <div className="relative h-[75px] w-[100px] overflow-hidden rounded bg-muted">
              {thumbnail ? (
                <img src={thumbnail} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Home className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              {statusBanner && (
                <div className={`absolute top-0 left-0 right-0 ${statusBanner.color} text-white text-[10px] font-bold px-1.5 py-0.5 text-center flex items-center justify-center gap-0.5`}>
                  <statusBanner.icon className="h-2.5 w-2.5" />
                  {statusBanner.text}
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
              {loc.street}
              {listing.unit_number && (
                <Badge variant="secondary" className="ml-1.5 text-[10px]">Unit {listing.unit_number}</Badge>
              )}
            </h3>
            <div className="flex items-center text-xs text-muted-foreground mt-0.5">
              <MapPin className="w-3 h-3 mr-0.5" />
              {loc.city}{loc.city ? "," : ""} {loc.state} {loc.zip}
            </div>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <ListingStatusBadge status={listing.status} size="sm" />
              <span className="text-[11px] font-mono text-muted-foreground">#{listing.listing_number}</span>
              {dom !== null && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {dom} DOM
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Price + Stats */}
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-base font-bold text-primary">
              {listing.price > 0 ? formatPrice(listing.price) : "Price TBD"}
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
        {nextOH && (
          <div className="mt-2 flex items-center gap-1.5 text-xs p-2 rounded-md bg-emerald-50 border border-emerald-200">
            <Calendar className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-emerald-700 font-medium">
              OH: {format(new Date(nextOH.date), "MMM d")} • {formatTime(nextOH.start_time)} – {formatTime(nextOH.end_time)}
            </span>
          </div>
        )}

        {/* List date on mobile */}
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

      {/* Open House footer bar */}
      {nextOH && (
        <div className="hidden md:block bg-emerald-50 border-t border-emerald-200 px-3 py-1.5 text-xs">
          <Calendar className="w-4 h-4 inline mr-2 text-emerald-600" />
          <span className="font-semibold text-emerald-700">Open House:</span>{" "}
          {format(new Date(nextOH.date), "EEEE, MMMM d, yyyy")} • {formatTime(nextOH.start_time)} – {formatTime(nextOH.end_time)}
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

export default ListingResultCard;

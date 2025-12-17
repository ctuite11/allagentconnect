import { Check, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
}

interface ListingResultCardProps {
  listing: Listing;
  isSelected: boolean;
  onSelect: (id: string, e?: React.SyntheticEvent) => void;
  onRowClick: (listing: Listing) => void;
  fromPath?: string;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
};

const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Active" },
    new: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Active" },
    coming_soon: { bg: "bg-amber-50", text: "text-amber-700", label: "Coming Soon" },
    off_market: { bg: "bg-rose-50", text: "text-rose-700", label: "Off-Market" },
    back_on_market: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Back on Market" },
    price_changed: { bg: "bg-blue-50", text: "text-blue-700", label: "Price Change" },
    under_agreement: { bg: "bg-violet-50", text: "text-violet-700", label: "Under Agreement" },
    pending: { bg: "bg-violet-50", text: "text-violet-700", label: "Pending" },
    sold: { bg: "bg-muted", text: "text-muted-foreground", label: "Sold" },
    withdrawn: { bg: "bg-muted", text: "text-muted-foreground", label: "Withdrawn" },
    expired: { bg: "bg-muted", text: "text-muted-foreground", label: "Expired" },
    cancelled: { bg: "bg-muted", text: "text-muted-foreground", label: "Cancelled" },
  };

  const config = statusConfig[status] || { bg: "bg-muted", text: "text-muted-foreground", label: status };

  return (
    <Badge className={`${config.bg} ${config.text} border-0 text-xs font-medium px-2 py-0.5 whitespace-nowrap`}>
      {config.label}
    </Badge>
  );
};

const getThumbnail = (listing: Listing) => {
  if (listing.photos && Array.isArray(listing.photos) && listing.photos.length > 0) {
    const photo = listing.photos[0];
    return typeof photo === 'string' ? photo : photo?.url || null;
  }
  return null;
};

const BOSTON_NEIGHBORHOODS = new Set(
  [
    "allston", "back bay", "bay village", "beacon hill", "brighton",
    "charlestown", "chinatown", "dorchester", "downtown", "east boston",
    "fenway", "fenway-kenmore", "hyde park", "jamaica plain", "mattapan",
    "mission hill", "north end", "roslindale", "roxbury", "south boston",
    "south boston waterfront", "south end", "west end", "west roxbury",
    "seaport", "leather district", "financial district"
  ].map(s => s.toLowerCase())
);

const norm = (s?: string) => (s || "").trim().toLowerCase();
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const sanitizeStreet = (raw?: string) => {
  const s = (raw || "").trim();
  if (!s) return "";
  return s.replace(/(?:,\s*[^,]+,\s*[A-Za-z]{2}\s*\d{5})+$/i, "").trim();
};

const extractZipFromAddress = (raw?: string) => {
  const s = (raw || "");
  const m = s.match(/\b(\d{5})(?:-\d{4})?\b/);
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
  const zip = zipRaw && zipRaw !== "00000" ? zipRaw : (extractZipFromAddress(listing.address) || "");
  const state = ((listing.state || "MA").trim().toUpperCase() || "MA");
  const city = isBoston ? "Boston" : titleCase(cityRaw || "");
  const showNeighborhood = isBoston ? !!neighborhood : (!!neighborhood && norm(neighborhood) !== norm(city));

  return { street, city, state, zip, neighborhood: neighborhood ? titleCase(neighborhood) : "", isBoston, showNeighborhood };
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

  const handleCardClick = () => {
    navigate(`/property/${listing.id}`, { state: { from: fromPath } });
  };

  return (
    <div
      onClick={handleCardClick}
      className="aac-card cursor-pointer p-3 transition-all hover:shadow-md hover:border-neutral-300 hover:-translate-y-[1px]"
    >
      {/* Top Row: Photo + Address/Status */}
      <div className="flex gap-3">
        {/* Photo with Checkbox */}
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(listing.id, e);
            }}
            className="absolute left-1.5 top-1.5 z-10 h-5 w-5 rounded-md border border-white/80 bg-white/90 shadow flex items-center justify-center"
            aria-label="Select listing"
          >
            {isSelected && <Check className="h-3 w-3" />}
          </button>
          <div className={`relative h-[75px] w-[100px] overflow-hidden rounded-lg bg-neutral-50 ${isSelected ? "ring-2 ring-neutral-300/50 border border-neutral-400" : "border border-neutral-200/70"}`}>
            {thumbnail ? (
              <img src={thumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                No photo
              </div>
            )}
          </div>
        </div>

        {/* Address + Status */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">
            {loc.street}{listing.unit_number ? ` #${listing.unit_number}` : ""}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {loc.city}{loc.city ? "," : ""} {loc.state} {loc.zip}
            {loc.showNeighborhood && ` • ${loc.neighborhood}`}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            {getStatusBadge(listing.status)}
            <span className="text-[11px] font-mono text-muted-foreground">#{listing.listing_number}</span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-semibold">{formatPrice(listing.price)}</span>
          <span className="text-muted-foreground">
            {listing.bedrooms || "-"} bd
          </span>
          <span className="text-muted-foreground">
            {listing.bathrooms || "-"} ba
          </span>
          <span className="text-muted-foreground">
            {listing.square_feet?.toLocaleString() || "-"} sqft
          </span>
        </div>
      </div>

      {/* Actions Row */}
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/property/${listing.id}`, { state: { from: fromPath } });
          }}
        >
          <ExternalLink className="h-4 w-4 mr-1.5" />
          View
        </Button>
      </div>
    </div>
  );
};

export default ListingResultCard;

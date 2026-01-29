import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bed, Bath, Square, Building2 } from "lucide-react";
import { RepliersListing, getListingAgentDisplay } from "@/lib/repliers";

interface IDXListingCardProps {
  listing: RepliersListing;
}

/**
 * Formats address from Repliers address object
 */
function formatAddress(address: RepliersListing["address"]): string {
  if (!address) return "Address unavailable";
  const parts = [
    address.streetNumber,
    address.streetName,
    address.streetSuffix,
  ].filter(Boolean).join(" ");
  return parts || "Address unavailable";
}

/**
 * Formats city, state, zip line
 */
function formatCityStateZip(address: RepliersListing["address"]): string {
  if (!address) return "";
  const cityState = [address.city, address.state].filter(Boolean).join(", ");
  return [cityState, address.zip].filter(Boolean).join(" ");
}

/**
 * Formats price with commas
 */
function formatPrice(price: number | undefined): string {
  if (!price) return "Price TBD";
  return `$${price.toLocaleString()}`;
}

export function IDXListingCard({ listing }: IDXListingCardProps) {
  const navigate = useNavigate();
  const agentInfo = getListingAgentDisplay(listing);

  const handleClick = () => {
    if (listing.mlsNumber) {
      navigate(`/idx/property/${listing.mlsNumber}`);
    }
  };

  const mainPhoto = listing.photos?.[0] || null;
  const details = listing.details || {};

  return (
    <Card
      onClick={handleClick}
      className="group cursor-pointer rounded-2xl border-neutral-200 bg-white overflow-hidden transition-all hover:shadow-lg hover:border-neutral-300"
    >
      {/* Photo */}
      <div className="relative aspect-[4/3] bg-neutral-100 overflow-hidden">
        {mainPhoto ? (
          <img
            src={mainPhoto}
            alt={formatAddress(listing.address)}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="h-12 w-12 text-neutral-300" />
          </div>
        )}
        {/* MLS Badge */}
        {listing.mlsNumber && (
          <Badge
            variant="secondary"
            className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-neutral-700 text-xs"
          >
            MLS# {listing.mlsNumber}
          </Badge>
        )}
      </div>

      <CardContent className="p-4 space-y-2">
        {/* Price */}
        <p className="text-xl font-bold text-neutral-900">
          {formatPrice(listing.listPrice)}
        </p>

        {/* Address */}
        <div>
          <p className="font-medium text-neutral-900 truncate">
            {formatAddress(listing.address)}
          </p>
          <p className="text-sm text-neutral-500 truncate">
            {formatCityStateZip(listing.address)}
          </p>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-sm text-neutral-600 pt-1">
          {details.numBedrooms != null && (
            <span className="flex items-center gap-1">
              <Bed className="h-4 w-4" />
              {details.numBedrooms} bd
            </span>
          )}
          {details.numBathrooms != null && (
            <span className="flex items-center gap-1">
              <Bath className="h-4 w-4" />
              {details.numBathrooms} ba
            </span>
          )}
          {details.sqft != null && (
            <span className="flex items-center gap-1">
              <Square className="h-4 w-4" />
              {details.sqft.toLocaleString()} sqft
            </span>
          )}
        </div>

        {/* Brokerage */}
        {agentInfo.brokerageName && (
          <p className="text-xs text-neutral-400 truncate pt-1">
            {agentInfo.brokerageName}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

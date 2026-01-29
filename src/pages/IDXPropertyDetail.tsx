import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IDXAgentInfo } from "@/components/idx/IDXAgentInfo";
import { useRepliersListing } from "@/hooks/useRepliersListing";
import {
  ArrowLeft,
  Bed,
  Bath,
  Square,
  Calendar,
  MapPin,
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

/**
 * Formats address from Repliers address object
 */
function formatAddress(address: { streetNumber?: string; streetName?: string; streetSuffix?: string } | undefined): string {
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
function formatCityStateZip(address: { city?: string; state?: string; zip?: string } | undefined): string {
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

/**
 * IDX Property Detail page - single MLS listing view using Repliers API
 * Completely separate from Supabase PropertyDetail page
 */
export default function IDXPropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const { data: listing, isLoading, error } = useRepliersListing(id);

  const handleBack = () => {
    navigate("/idx/search");
  };

  if (isLoading) {
    return (
      <PageShell>
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-4 -ml-2 text-neutral-600"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Search
        </Button>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="aspect-[16/10] rounded-2xl" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (error || !listing) {
    return (
      <PageShell>
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-4 -ml-2 text-neutral-600"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Search
        </Button>
        <div className="text-center py-16">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-neutral-700 font-medium mb-2">
            Listing not found
          </p>
          <p className="text-neutral-500 text-sm mb-4">
            This listing may no longer be available
          </p>
          <Button onClick={handleBack} className="rounded-xl">
            Return to Search
          </Button>
        </div>
      </PageShell>
    );
  }

  const photos = listing.photos || [];
  const details = listing.details || {};

  const handlePrevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const handleNextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  return (
    <PageShell>
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={handleBack}
        className="mb-4 -ml-2 text-neutral-600"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Search
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photo carousel */}
          <div className="relative aspect-[16/10] bg-neutral-100 rounded-2xl overflow-hidden">
            {photos.length > 0 ? (
              <>
                <img
                  src={photos[currentPhotoIndex]}
                  alt={`Photo ${currentPhotoIndex + 1}`}
                  className="w-full h-full object-cover"
                />
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevPhoto}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-md hover:bg-white transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5 text-neutral-700" />
                    </button>
                    <button
                      onClick={handleNextPhoto}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-md hover:bg-white transition-colors"
                    >
                      <ChevronRight className="h-5 w-5 text-neutral-700" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white text-sm px-3 py-1 rounded-full">
                      {currentPhotoIndex + 1} / {photos.length}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Building2 className="h-16 w-16 text-neutral-300" />
              </div>
            )}
          </div>

          {/* Price and badges */}
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-3xl font-bold text-neutral-900">
              {formatPrice(listing.listPrice)}
            </p>
            {listing.mlsNumber && (
              <Badge variant="secondary" className="text-sm">
                MLS# {listing.mlsNumber}
              </Badge>
            )}
          </div>

          {/* Address */}
          <div className="flex items-start gap-2">
            <MapPin className="h-5 w-5 text-neutral-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-neutral-900">
                {formatAddress(listing.address)}
              </p>
              <p className="text-neutral-500">
                {formatCityStateZip(listing.address)}
              </p>
            </div>
          </div>

          {/* Property stats */}
          <div className="flex flex-wrap gap-6 py-4 border-t border-b border-neutral-200">
            {details.numBedrooms != null && (
              <div className="flex items-center gap-2">
                <Bed className="h-5 w-5 text-neutral-400" />
                <span className="text-neutral-900 font-medium">
                  {details.numBedrooms} Bedrooms
                </span>
              </div>
            )}
            {details.numBathrooms != null && (
              <div className="flex items-center gap-2">
                <Bath className="h-5 w-5 text-neutral-400" />
                <span className="text-neutral-900 font-medium">
                  {details.numBathrooms} Bathrooms
                </span>
              </div>
            )}
            {details.sqft != null && (
              <div className="flex items-center gap-2">
                <Square className="h-5 w-5 text-neutral-400" />
                <span className="text-neutral-900 font-medium">
                  {details.sqft.toLocaleString()} sqft
                </span>
              </div>
            )}
            {details.yearBuilt != null && (
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-neutral-400" />
                <span className="text-neutral-900 font-medium">
                  Built {details.yearBuilt}
                </span>
              </div>
            )}
          </div>

          {/* Additional details */}
          {(details.propertyType || details.lotSize) && (
            <div className="grid grid-cols-2 gap-4">
              {details.propertyType && (
                <div>
                  <p className="text-sm text-neutral-500">Property Type</p>
                  <p className="font-medium text-neutral-900 capitalize">
                    {details.propertyType.replace(/_/g, " ")}
                  </p>
                </div>
              )}
              {details.lotSize != null && (
                <div>
                  <p className="text-sm text-neutral-500">Lot Size</p>
                  <p className="font-medium text-neutral-900">
                    {details.lotSize.toLocaleString()} sqft
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {listing.description && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-neutral-900">
                Description
              </h2>
              <p className="text-neutral-600 whitespace-pre-line">
                {listing.description}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar - Agent info */}
        <div className="space-y-4">
          <IDXAgentInfo listing={listing} />
        </div>
      </div>
    </PageShell>
  );
}

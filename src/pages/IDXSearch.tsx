import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { IDXSearchFilters } from "@/components/idx/IDXSearchFilters";
import { IDXListingCard } from "@/components/idx/IDXListingCard";
import { useRepliersListings } from "@/hooks/useRepliersListings";
import { RepliersListingsParams } from "@/lib/repliers";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";

const DEFAULT_RESULTS_PER_PAGE = 20;

/**
 * IDX Search page - MLS property search using Repliers API
 * Completely separate from Supabase off-market listing pages
 */
export default function IDXSearch() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filters from URL params
  const getFiltersFromParams = (): RepliersListingsParams => {
    const filters: RepliersListingsParams = {};
    const city = searchParams.get("city");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const minBeds = searchParams.get("minBeds");
    const minBaths = searchParams.get("minBaths");
    const propertyType = searchParams.get("propertyType");
    const status = searchParams.get("status");
    const pageNum = searchParams.get("pageNum");

    if (city) filters.city = city;
    if (minPrice) filters.minPrice = Number(minPrice);
    if (maxPrice) filters.maxPrice = Number(maxPrice);
    if (minBeds) filters.minBeds = Number(minBeds);
    if (minBaths) filters.minBaths = Number(minBaths);
    if (propertyType) filters.propertyType = propertyType;
    if (status) filters.status = status;
    if (pageNum) filters.pageNum = Number(pageNum);

    return filters;
  };

  const [filters, setFilters] = useState<RepliersListingsParams>(getFiltersFromParams);
  const [searchTrigger, setSearchTrigger] = useState(0);

  // Query params for the actual API call
  const queryParams: RepliersListingsParams = {
    ...filters,
    resultsPerPage: DEFAULT_RESULTS_PER_PAGE,
  };

  const { data, isLoading, error, refetch } = useRepliersListings(queryParams, {
    enabled: searchTrigger > 0,
  });

  // Sync filters to URL on search
  const syncFiltersToUrl = (newFilters: RepliersListingsParams) => {
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== null) {
        params.set(key, String(value));
      }
    });
    setSearchParams(params, { replace: true });
  };

  const handleSearch = () => {
    syncFiltersToUrl(filters);
    setSearchTrigger((prev) => prev + 1);
  };

  const handleReset = () => {
    setFilters({});
    setSearchParams({}, { replace: true });
  };

  const handlePageChange = (newPage: number) => {
    const newFilters = { ...filters, pageNum: newPage };
    setFilters(newFilters);
    syncFiltersToUrl(newFilters);
    setSearchTrigger((prev) => prev + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Auto-search on mount if URL has params
  useEffect(() => {
    const hasParams = Array.from(searchParams.keys()).length > 0;
    if (hasParams && searchTrigger === 0) {
      setSearchTrigger(1);
    }
  }, []);

  const listings = data?.listings || [];
  const currentPage = data?.page || 1;
  const totalPages = data?.numPages || 1;
  const totalCount = data?.count || 0;

  return (
    <PageShell>
      <PageHeader title="MLS Property Search" />

      <div className="space-y-6">
        {/* Filters */}
        <IDXSearchFilters
          filters={filters}
          onFiltersChange={setFilters}
          onSearch={handleSearch}
          onReset={handleReset}
        />

        {/* Results section */}
        {searchTrigger === 0 ? (
          <div className="text-center py-16">
            <p className="text-neutral-500 text-lg">
              Enter search criteria and click Search to find MLS listings
            </p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-neutral-200 overflow-hidden">
                <Skeleton className="aspect-[4/3]" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-neutral-700 font-medium mb-2">
              Unable to load listings
            </p>
            <p className="text-neutral-500 text-sm mb-4">
              {error instanceof Error ? error.message : "Please try again later"}
            </p>
            <Button onClick={() => refetch()} variant="outline" className="rounded-xl">
              Try Again
            </Button>
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-neutral-700 font-medium mb-2">
              No properties found
            </p>
            <p className="text-neutral-500 text-sm">
              Try adjusting your search criteria
            </p>
          </div>
        ) : (
          <>
            {/* Results count */}
            <p className="text-sm text-neutral-500">
              Showing {listings.length} of {totalCount.toLocaleString()} properties
            </p>

            {/* Results grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <IDXListingCard key={listing.mlsNumber} listing={listing} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-4">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="rounded-xl"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-neutral-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="rounded-xl"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}

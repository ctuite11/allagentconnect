import { useState, useEffect, useCallback, useRef } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { filterVisibleListings } from "@/lib/filterVisibleListings";
import { filterByPricePerSqft } from "@/lib/filterByPricePerSqft";
import { applyLocationFilter } from "@/lib/buildLocationFilter";
import { getListingIdsWithinRadius } from "@/lib/buildRadiusFilter";
import { buildSearchParams, parseAdvancedParams } from "@/lib/buildSearchParams";
import ListingSearchFilters, { FilterState, initialFilters } from "@/components/listing-search/ListingSearchFilters";
import { RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ListingSearch = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [filters, setFilters] = useState<FilterState>(() => {
    const urlFilters = { ...initialFilters };
    
    const propertyTypes = searchParams.get("propertyTypes");
    if (propertyTypes) urlFilters.propertyTypes = propertyTypes.split(",");
    
    const statuses = searchParams.get("statuses");
    if (statuses) {
      urlFilters.statuses = statuses.split(",").map(s => s === "private" ? "off_market" : s);
    }
    
    const towns = searchParams.get("towns");
    if (towns) urlFilters.selectedTowns = towns.split(",");
    
    if (searchParams.get("priceMin")) urlFilters.priceMin = searchParams.get("priceMin") || "";
    if (searchParams.get("priceMax")) urlFilters.priceMax = searchParams.get("priceMax") || "";
    if (searchParams.get("bedsMin")) urlFilters.bedsMin = searchParams.get("bedsMin") || "";
    if (searchParams.get("bathsMin")) urlFilters.bathsMin = searchParams.get("bathsMin") || "";
    if (searchParams.get("state")) urlFilters.state = searchParams.get("state") || "MA";
    if (searchParams.get("county")) urlFilters.county = searchParams.get("county") || "";
    if (searchParams.get("streetNumber")) urlFilters.streetNumber = searchParams.get("streetNumber") || "";
    if (searchParams.get("streetName")) urlFilters.streetName = searchParams.get("streetName") || "";
    if (searchParams.get("zipCode")) urlFilters.zipCode = searchParams.get("zipCode") || "";
    parseAdvancedParams(searchParams, urlFilters);
    
    return urlFilters;
  });
  
  const [counties, setCounties] = useState<{ id: string; name: string; state: string }[]>([]);
  const [resultCount, setResultCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const requestIdRef = useRef(0);

  // Fetch counties on mount
  useEffect(() => {
    const fetchCounties = async () => {
      const { data } = await supabase
        .from("counties")
        .select("id, name, state")
        .order("state")
        .order("name");
      if (data) setCounties(data);
    };
    fetchCounties();
  }, []);

  // Fetch result count using same visibility rules as the results page
  const fetchResultCount = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setCountLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // If radius is set, get IDs within radius first
      let radiusIds: string[] | null = null;
      if (filters.radius && filters.originLat && filters.originLng) {
        radiusIds = await getListingIdsWithinRadius(
          filters.originLat, filters.originLng, filters.radius, filters.radiusUnit
        );
        if (radiusIds && radiusIds.length === 0) {
          setResultCount(0);
          setCountLoading(false);
          return;
        }
      }

      let query = supabase
        .from("listings")
        .select("id, status, agent_id, price, square_feet")
        .limit(500);

      // Apply radius ID filter
      if (radiusIds) {
        query = query.in("id", radiusIds);
      }

      if (filters.dcmlsOnly) {
        query = query.eq("publish_to_dcmls", true).eq("dcmls_status", "published");
      }
      if (filters.statuses.length > 0) query = query.in("status", filters.statuses);
      if (filters.propertyTypes.length > 0) query = query.in("property_type", filters.propertyTypes);
      if (filters.priceMin) query = query.gte("price", parseInt(filters.priceMin));
      if (filters.priceMax) query = query.lte("price", parseInt(filters.priceMax));
      if (filters.bedsMin) query = query.gte("bedrooms", parseInt(filters.bedsMin));
      if (filters.bathsMin) query = query.gte("bathrooms", parseFloat(filters.bathsMin));
      if (filters.state) query = query.eq("state", filters.state);
      if (filters.selectedTowns.length > 0) query = applyLocationFilter(query, filters.selectedTowns);
      if (filters.streetNumber) query = query.ilike("address", `${filters.streetNumber}%`);
      if (filters.streetName) query = query.ilike("address", `%${filters.streetName}%`);
      if (filters.zipCode) query = query.ilike("zip_code", `${filters.zipCode}%`);
      if (filters.sqftMin) query = query.gte("square_feet", parseInt(filters.sqftMin));
      if (filters.sqftMax) query = query.lte("square_feet", parseInt(filters.sqftMax));
      if (filters.bedsMax) query = query.lte("bedrooms", parseInt(filters.bedsMax));
      if (filters.bathsMax) query = query.lte("bathrooms", parseFloat(filters.bathsMax));
      if (filters.yearBuiltMin) query = query.gte("year_built", parseInt(filters.yearBuiltMin));
      if (filters.yearBuiltMax) query = query.lte("year_built", parseInt(filters.yearBuiltMax));
      if (filters.lotSizeMin) query = query.gte("lot_size", parseFloat(filters.lotSizeMin));
      if (filters.lotSizeMax) query = query.lte("lot_size", parseFloat(filters.lotSizeMax));
      if (filters.garageSpaces) query = query.gte("garage_spaces", parseInt(filters.garageSpaces));
      if (filters.parkingSpaces) query = query.gte("total_parking_spaces", parseInt(filters.parkingSpaces));
      if (filters.keywordsInclude) query = query.ilike("description", `%${filters.keywordsInclude}%`);
      if (filters.listingNumber) query = query.ilike("listing_number", `%${filters.listingNumber.replace(/^L-/i, "")}%`);
      if (filters.listDateFrom) query = query.gte("list_date", filters.listDateFrom);
      if (filters.listDateTo) query = query.lte("list_date", filters.listDateTo);

      const { data, error } = await query;
      if (currentRequestId !== requestIdRef.current) return; // stale response
      if (!error && data) {
        const visible = filterVisibleListings(data, user?.id ?? null);
        const filtered = filterByPricePerSqft(visible, filters.pricePerSqFtMin || "", filters.pricePerSqFt || "");
        setResultCount(filtered.length);
      }
    } catch (error) {
      if (currentRequestId !== requestIdRef.current) return;
      console.error("Count error:", error);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setCountLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchResultCount();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchResultCount]);

  const updateUrlParams = useCallback((f: FilterState) => {
    const params = buildSearchParams(f);
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    updateUrlParams(newFilters);
  };

  const handleReset = () => {
    setFilters(initialFilters);
    updateUrlParams(initialFilters);
  };

  const handleViewResults = () => {
    navigate(`/listing-results?${buildSearchParams(filters).toString()}`);
  };

  const handleViewResultsNewTab = () => {
    window.open(`/listing-results?${buildSearchParams(filters).toString()}`, '_blank');
  };

  return (
<div className="bg-white text-neutral-900">
      <main>
        <div className="max-w-[1280px] mx-auto px-6 py-6">
          <PageHeader
            title="Listing Search"
            subtitle="Search and filter available listings"
            className="mb-8"
          />
          
          <div className="sticky top-0 z-30 bg-white rounded-3xl border border-neutral-200 aac-shadow mb-4">
            <div className="px-5 py-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="h-9 gap-1.5 text-sm rounded-xl border-neutral-200 text-neutral-700 hover:text-emerald-600 hover:bg-transparent hover:border-neutral-300 transition-colors shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>

                {/* Active filter chips */}
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                  {filters.selectedTowns.length > 0 && (
                    <Badge variant="secondary" className="text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap">
                      {filters.selectedTowns.length} {filters.selectedTowns.length === 1 ? 'town' : 'towns'}
                    </Badge>
                  )}
                  {filters.propertyTypes.length > 0 && (
                    <Badge variant="secondary" className="text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap">
                      {filters.propertyTypes.length} {filters.propertyTypes.length === 1 ? 'type' : 'types'}
                    </Badge>
                  )}
                  {filters.statuses.length > 0 && (
                    <Badge variant="secondary" className="text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap">
                      {filters.statuses.length} {filters.statuses.length === 1 ? 'status' : 'statuses'}
                    </Badge>
                  )}
                </div>

                {/* Results + View Results */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={handleViewResults}
                    disabled={countLoading || resultCount === 0}
                    className="flex items-center gap-2 text-sm text-neutral-500 hover:text-emerald-600 disabled:opacity-50 disabled:cursor-default cursor-pointer transition-colors group"
                    title={resultCount !== null && resultCount > 0 ? "View results" : ""}
                  >
                    <span className={`font-medium text-neutral-900 bg-neutral-100 px-2.5 py-1 rounded-lg group-hover:bg-neutral-50 transition-all duration-200 ${countLoading ? "opacity-50" : ""}`}>
                      {resultCount ?? 0}
                    </span>
                    <span>results</span>
                  </button>
                  
                  <Button
                    onClick={handleViewResults}
                    disabled={countLoading || resultCount === 0}
                    size="sm"
                    className="h-9 gap-1.5 text-sm bg-primary hover:bg-primary/90 text-white rounded-2xl px-4"
                  >
                    <Search className="h-3.5 w-3.5" />
                    View Results
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <ListingSearchFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            counties={counties}
            onSearch={handleViewResults}
          />
        </div>
      </main>
    </div>
  );
};

export default ListingSearch;

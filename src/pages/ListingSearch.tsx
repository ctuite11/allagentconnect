import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ListingSearchFilters, { FilterState, initialFilters } from "@/components/listing-search/ListingSearchFilters";
import { RotateCcw, Search, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const ListingSearch = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [filters, setFilters] = useState<FilterState>(() => {
    // Initialize from URL params
    const urlFilters = { ...initialFilters };
    
    const propertyTypes = searchParams.get("propertyTypes");
    if (propertyTypes) urlFilters.propertyTypes = propertyTypes.split(",");
    
    const statuses = searchParams.get("statuses");
    if (statuses) urlFilters.statuses = statuses.split(",");
    
    const towns = searchParams.get("towns");
    if (towns) urlFilters.selectedTowns = towns.split(",");
    
    if (searchParams.get("priceMin")) urlFilters.priceMin = searchParams.get("priceMin") || "";
    if (searchParams.get("priceMax")) urlFilters.priceMax = searchParams.get("priceMax") || "";
    if (searchParams.get("bedsMin")) urlFilters.bedsMin = searchParams.get("bedsMin") || "";
    if (searchParams.get("bathsMin")) urlFilters.bathsMin = searchParams.get("bathsMin") || "";
    if (searchParams.get("state")) urlFilters.state = searchParams.get("state") || "MA";
    if (searchParams.get("county")) urlFilters.county = searchParams.get("county") || "";
    
    return urlFilters;
  });
  
  const [counties, setCounties] = useState<{ id: string; name: string; state: string }[]>([]);
  const [resultCount, setResultCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

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

  // Fetch result count when filters change
  const fetchResultCount = useCallback(async () => {
    setCountLoading(true);
    try {
      let query = supabase
        .from("listings")
        .select("id", { count: "exact", head: true });

      // Apply status filter
      if (filters.statuses.length > 0) {
        query = query.in("status", filters.statuses);
      }

      // Apply property type filter
      if (filters.propertyTypes.length > 0) {
        query = query.in("property_type", filters.propertyTypes);
      }

      // Apply price filters
      if (filters.priceMin) {
        query = query.gte("price", parseInt(filters.priceMin));
      }
      if (filters.priceMax) {
        query = query.lte("price", parseInt(filters.priceMax));
      }

      // Apply beds filters
      if (filters.bedsMin) {
        query = query.gte("bedrooms", parseInt(filters.bedsMin));
      }

      // Apply baths filters
      if (filters.bathsMin) {
        query = query.gte("bathrooms", parseFloat(filters.bathsMin));
      }

      // Apply state filter
      if (filters.state) {
        query = query.eq("state", filters.state);
      }

      // Apply town filter
      if (filters.selectedTowns.length > 0) {
        query = query.in("city", filters.selectedTowns);
      }

      const { count, error } = await query;
      if (!error) {
        setResultCount(count ?? 0);
      }
    } catch (error) {
      console.error("Count error:", error);
    } finally {
      setCountLoading(false);
    }
  }, [filters]);

  // Update count when filters change
  useEffect(() => {
    fetchResultCount();
  }, [filters]);

  // Update URL params when filters change
  const updateUrlParams = useCallback((f: FilterState) => {
    const params = new URLSearchParams();
    
    if (f.propertyTypes.length > 0) params.set("propertyTypes", f.propertyTypes.join(","));
    if (f.statuses.length > 0) params.set("statuses", f.statuses.join(","));
    if (f.selectedTowns.length > 0) params.set("towns", f.selectedTowns.join(","));
    if (f.priceMin) params.set("priceMin", f.priceMin);
    if (f.priceMax) params.set("priceMax", f.priceMax);
    if (f.bedsMin) params.set("bedsMin", f.bedsMin);
    if (f.bathsMin) params.set("bathsMin", f.bathsMin);
    if (f.state && f.state !== "MA") params.set("state", f.state);
    if (f.county) params.set("county", f.county);
    
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
    const params = new URLSearchParams();
    
    if (filters.propertyTypes.length > 0) params.set("propertyTypes", filters.propertyTypes.join(","));
    if (filters.statuses.length > 0) params.set("statuses", filters.statuses.join(","));
    if (filters.selectedTowns.length > 0) params.set("towns", filters.selectedTowns.join(","));
    if (filters.priceMin) params.set("priceMin", filters.priceMin);
    if (filters.priceMax) params.set("priceMax", filters.priceMax);
    if (filters.bedsMin) params.set("bedsMin", filters.bedsMin);
    if (filters.bathsMin) params.set("bathsMin", filters.bathsMin);
    if (filters.state && filters.state !== "MA") params.set("state", filters.state);
    if (filters.county) params.set("county", filters.county);
    
    navigate(`/listing-results?${params.toString()}`);
  };

  const handleViewResultsNewTab = () => {
    const params = new URLSearchParams();
    
    if (filters.propertyTypes.length > 0) params.set("propertyTypes", filters.propertyTypes.join(","));
    if (filters.statuses.length > 0) params.set("statuses", filters.statuses.join(","));
    if (filters.selectedTowns.length > 0) params.set("towns", filters.selectedTowns.join(","));
    if (filters.priceMin) params.set("priceMin", filters.priceMin);
    if (filters.priceMax) params.set("priceMax", filters.priceMax);
    if (filters.bedsMin) params.set("bedsMin", filters.bedsMin);
    if (filters.bathsMin) params.set("bathsMin", filters.bathsMin);
    if (filters.state && filters.state !== "MA") params.set("state", filters.state);
    if (filters.county) params.set("county", filters.county);
    
    window.open(`/listing-results?${params.toString()}`, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <main className="flex-1 pt-20">
        <div className="max-w-[1280px] mx-auto px-6 py-6">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground font-display">Listing Search</h1>
            <p className="text-muted-foreground mt-1">
              Search MLS and off-market inventory
            </p>
          </div>
          
          {/* Action Bar */}
          <div className="bg-card border border-border rounded-lg shadow-sm mb-4">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="h-8 gap-1.5 text-sm"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  {/* Results counter - clickable */}
                  <button
                    onClick={handleViewResults}
                    disabled={countLoading || resultCount === 0}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-default cursor-pointer transition-colors group"
                    title={resultCount !== null && resultCount > 0 ? "View results" : ""}
                  >
                    <span className="font-medium text-foreground bg-muted px-2.5 py-1 rounded-md group-hover:bg-muted/80 transition-colors">
                      {countLoading ? "..." : resultCount ?? 0}
                    </span>
                    <span>results</span>
                  </button>
                  
                  <Button
                    onClick={handleViewResults}
                    disabled={countLoading || resultCount === 0}
                    size="sm"
                    className="h-8 gap-1.5 text-sm bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white"
                  >
                    <Search className="h-3.5 w-3.5" />
                    View Results
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleViewResultsNewTab}
                    disabled={countLoading || resultCount === 0}
                    className="h-8 gap-1.5 text-sm"
                    title="Open results in new tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Builder */}
          <ListingSearchFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            counties={counties}
            onSearch={handleViewResults}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ListingSearch;

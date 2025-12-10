import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ListingSearchTopBar, { FilterState, initialFilters } from "@/components/listing-search/ListingSearchTopBar";
import MoreFiltersDrawer from "@/components/listing-search/MoreFiltersDrawer";
import ListingResultsTable from "@/components/listing-search/ListingResultsTable";
import { toast } from "sonner";
import { Search } from "lucide-react";

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
  
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [counties, setCounties] = useState<{ id: string; name: string; state: string }[]>([]);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState("list_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

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

  // Initial search on mount
  useEffect(() => {
    handleSearch();
  }, []);

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

  const handleSearch = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("listings")
        .select(`
          id,
          listing_number,
          address,
          unit_number,
          city,
          state,
          zip_code,
          price,
          bedrooms,
          bathrooms,
          square_feet,
          status,
          list_date,
          property_type,
          agent_id,
          lot_size,
          year_built,
          garage_spaces,
          total_parking_spaces,
          description
        `)
        .limit(500);

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
      if (filters.bedsMax) {
        query = query.lte("bedrooms", parseInt(filters.bedsMax));
      }

      // Apply baths filters
      if (filters.bathsMin) {
        query = query.gte("bathrooms", parseFloat(filters.bathsMin));
      }
      if (filters.bathsMax) {
        query = query.lte("bathrooms", parseFloat(filters.bathsMax));
      }

      // Apply sqft filters
      if (filters.sqftMin) {
        query = query.gte("square_feet", parseInt(filters.sqftMin));
      }
      if (filters.sqftMax) {
        query = query.lte("square_feet", parseInt(filters.sqftMax));
      }

      // Apply year built filters
      if (filters.yearBuiltMin) {
        query = query.gte("year_built", parseInt(filters.yearBuiltMin));
      }
      if (filters.yearBuiltMax) {
        query = query.lte("year_built", parseInt(filters.yearBuiltMax));
      }

      // Apply garage spaces filter
      if (filters.garageSpaces) {
        query = query.gte("garage_spaces", parseInt(filters.garageSpaces));
      }

      // Apply total parking filter
      if (filters.parkingSpaces) {
        query = query.gte("total_parking_spaces", parseInt(filters.parkingSpaces));
      }

      // Apply state filter
      if (filters.state) {
        query = query.eq("state", filters.state);
      }

      // Apply town filter
      if (filters.selectedTowns.length > 0) {
        query = query.in("city", filters.selectedTowns);
      }

      // Apply address filter
      if (filters.streetAddress) {
        query = query.ilike("address", `%${filters.streetAddress}%`);
      }

      // Apply zip filter
      if (filters.zipCode) {
        query = query.ilike("zip_code", `${filters.zipCode}%`);
      }

      // Apply keyword include filter
      if (filters.keywordsInclude) {
        query = query.ilike("description", `%${filters.keywordsInclude}%`);
      }

      // Apply sorting
      const ascending = sortDirection === "asc";
      query = query.order(sortColumn, { ascending, nullsFirst: false });

      const { data, error } = await query;

      if (error) {
        console.error("Search error:", error);
        toast.error("Error searching listings");
        return;
      }

      // Fetch agent names for listings
      if (data && data.length > 0) {
        const agentIds = [...new Set(data.map(l => l.agent_id))];
        const { data: agents } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name")
          .in("id", agentIds);

        const agentMap = new Map(
          agents?.map(a => [a.id, `${a.first_name} ${a.last_name}`]) || []
        );

        const listingsWithAgents = data.map(l => ({
          ...l,
          agent_name: agentMap.get(l.agent_id) || null,
        }));

        setListings(listingsWithAgents);
      } else {
        setListings([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Error searching listings");
    } finally {
      setLoading(false);
    }
  }, [filters, sortColumn, sortDirection]);

  const handleReset = () => {
    setFilters(initialFilters);
    updateUrlParams(initialFilters);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  // Re-search when sort changes
  useEffect(() => {
    if (listings.length > 0 || loading) {
      handleSearch();
    }
  }, [sortColumn, sortDirection]);

  const handleRowClick = (listing: any) => {
    navigate(`/property/${listing.id}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <main className="flex-1 pt-16">
        {/* Header */}
        <section className="bg-card border-b border-border py-6">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Property Search</h1>
                <p className="text-sm text-muted-foreground">
                  Search listings across Massachusetts with MLS-familiar filters
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Top Filter Bar */}
        <ListingSearchTopBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onSearch={handleSearch}
          onOpenMoreFilters={() => setMoreFiltersOpen(true)}
          resultCount={listings.length}
          loading={loading}
          counties={counties}
        />

        {/* Results Table */}
        <section className="flex-1">
          <div className="container mx-auto px-4 py-4">
            <ListingResultsTable
              listings={listings}
              loading={loading}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              onRowClick={handleRowClick}
            />
          </div>
        </section>
      </main>

      {/* More Filters Drawer */}
      <MoreFiltersDrawer
        open={moreFiltersOpen}
        onOpenChange={setMoreFiltersOpen}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      <Footer />
    </div>
  );
};

export default ListingSearch;

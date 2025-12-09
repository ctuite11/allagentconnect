import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import MLSPINFilterPanel from "@/components/mlspin-search/MLSPINFilterPanel";
import MLSPINResultsTable from "@/components/mlspin-search/MLSPINResultsTable";
import ListingIntelDrawer from "@/components/mlspin-search/ListingIntelDrawer";
import { toast } from "sonner";

interface FilterState {
  propertyTypes: string[];
  statuses: string[];
  bedsMin: string;
  bedsMax: string;
  bathsMin: string;
  bathsMax: string;
  sqftMin: string;
  sqftMax: string;
  yearBuiltMin: string;
  yearBuiltMax: string;
  parkingMin: string;
  priceMin: string;
  priceMax: string;
  streetNumber: string;
  streetName: string;
  zipCode: string;
  radius: string;
  state: string;
  county: string;
  selectedTowns: string[];
  openHouse: boolean;
  brokerTour: boolean;
  keywordsInclude: string;
  keywordsExclude: string;
}

const initialFilters: FilterState = {
  propertyTypes: [],
  statuses: ["active", "coming_soon"],
  bedsMin: "",
  bedsMax: "",
  bathsMin: "",
  bathsMax: "",
  sqftMin: "",
  sqftMax: "",
  yearBuiltMin: "",
  yearBuiltMax: "",
  parkingMin: "",
  priceMin: "",
  priceMax: "",
  streetNumber: "",
  streetName: "",
  zipCode: "",
  radius: "",
  state: "",
  county: "",
  selectedTowns: [],
  openHouse: false,
  brokerTour: false,
  keywordsInclude: "",
  keywordsExclude: "",
};

const MLSPINSearch = () => {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [counties, setCounties] = useState<{ id: string; name: string; state: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState("list_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
          description,
          photos,
          year_built,
          lot_size
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

      // Apply address filters
      if (filters.streetName) {
        query = query.ilike("address", `%${filters.streetName}%`);
      }
      if (filters.zipCode) {
        query = query.ilike("zip_code", `${filters.zipCode}%`);
      }

      // Apply state filter
      if (filters.state) {
        query = query.eq("state", filters.state);
      }

      // Apply town filter
      if (filters.selectedTowns.length > 0) {
        query = query.in("city", filters.selectedTowns);
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
    if (listings.length > 0) {
      handleSearch();
    }
  }, [sortColumn, sortDirection]);

  const handleRowClick = (listing: any) => {
    setSelectedListing(listing);
    setDrawerOpen(true);
  };

  const handleMessageAgent = (listing: any) => {
    toast.info(`Message agent for ${listing.address}`);
  };

  const handleSaveListing = async (listing: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to save listings");
        return;
      }

      const { error } = await supabase
        .from("favorites")
        .upsert({
          user_id: user.id,
          listing_id: listing.id,
        });

      if (error) throw error;
      toast.success("Listing saved to favorites");
    } catch (error) {
      console.error("Error saving listing:", error);
      toast.error("Error saving listing");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      
      <div className="flex-1 flex overflow-hidden pt-16">
        {/* Filter Panel */}
        <MLSPINFilterPanel
          filters={filters}
          onFiltersChange={setFilters}
          onSearch={handleSearch}
          onReset={handleReset}
          counties={counties}
        />

        {/* Results Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Results Header */}
          <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {loading ? "Searching..." : `${listings.length} listings`}
              </span>
              {selectedIds.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({selectedIds.length} selected)
                </span>
              )}
            </div>
          </div>

          {/* Results Table */}
          <MLSPINResultsTable
            listings={listings}
            loading={loading}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onRowClick={handleRowClick}
            onMessageAgent={handleMessageAgent}
            onSaveListing={handleSaveListing}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        </div>
      </div>

      {/* Intel Drawer */}
      <ListingIntelDrawer
        listing={selectedListing}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
};

export default MLSPINSearch;

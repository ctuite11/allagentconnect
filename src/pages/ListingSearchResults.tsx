import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// Navigation removed - rendered globally in App.tsx

import ListingResultsTable from "@/components/listing-search/ListingResultsTable";
import { toast } from "sonner";
import { ArrowLeft, CheckSquare, FileSpreadsheet, X, List } from "lucide-react";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";
import { Button } from "@/components/ui/button";
import { FilterState, initialFilters } from "@/components/listing-search/ListingSearchFilters";
import { SectionCard } from "@/components/ui/section-card";


const ListingSearchResults = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [filters] = useState<FilterState>(() => {
    // Initialize from URL params
    const urlFilters = { ...initialFilters };
    
    const propertyTypes = searchParams.get("propertyTypes");
    if (propertyTypes) urlFilters.propertyTypes = propertyTypes.split(",");
    
    const statuses = searchParams.get("statuses");
    if (statuses) {
      // Map legacy "private" to "off_market" for backwards compatibility
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
    
    return urlFilters;
  });
  
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState("list_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());

  const handleSelectListing = (id: string) => {
    setSelectedListings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSearch = useCallback(async () => {
    setLoading(true);
    try {
    // Get current user for off-market visibility check
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;

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
        description,
        photos,
        neighborhood,
        open_houses,
        property_styles,
        num_fireplaces,
        virtual_tour_url,
        video_url,
        documents,
        floors,
        active_date,
        condo_details,
        price_range_min,
        price_range_max
      `)
      .limit(500);

      // Apply status filter
      if (filters.statuses.length > 0) {
        query = query.in("status", filters.statuses);
      }

      // Apply internal filter override
      if (filters.internalFilter === "off_market") {
        query = query.eq("status", "off_market");
      } else if (filters.internalFilter === "coming_soon") {
        query = query.eq("status", "coming_soon");
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

      // Fetch agent info for listings
      if (data && data.length > 0) {
        const agentIds = [...new Set(data.map(l => l.agent_id))];
        const { data: agents } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, email, phone, cell_phone, office_name, office_phone")
          .in("id", agentIds);

        const agentMap = new Map(
          agents?.map(a => [a.id, {
            name: `${a.first_name || ''} ${a.last_name || ''}`.trim(),
            email: a.email,
            phone: a.cell_phone || a.phone,
            office: a.office_name,
            officePhone: a.office_phone,
          }]) || []
        );

        let listingsWithAgents = data.map(l => {
          const agentInfo = agentMap.get(l.agent_id);
          return {
            ...l,
            agent_name: agentInfo?.name || null,
            agent_email: agentInfo?.email || null,
            agent_phone: agentInfo?.phone || null,
            list_office: agentInfo?.office || null,
            list_office_phone: agentInfo?.officePhone || null,
          };
        });

        // Off-market visibility rule: off_market listings only visible to listing agent
        listingsWithAgents = listingsWithAgents.filter(listing => {
          if (listing.status !== 'off_market') return true;
          // Off-market listings: only show if current user is the listing agent
          return currentUserId && listing.agent_id === currentUserId;
        });

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

  // Initial search on mount
  useEffect(() => {
    handleSearch();
  }, []);

  // Re-search when sort changes
  useEffect(() => {
    if (listings.length > 0 || loading) {
      handleSearch();
    }
  }, [sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const handleRowClick = (listing: any) => {
    navigate(`/property/${listing.id}`, { 
      state: { from: `/listing-results${window.location.search}` } 
    });
  };

  const handleBackToSearch = () => {
    navigate(`/listing-search${window.location.search}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white pt-20">
      <main className="flex-1">
        <div className="max-w-[1400px] mx-auto px-6 pt-6">
          {/* Page Header */}
          <div className="mb-6 border-b border-neutral-200/70 bg-transparent px-0 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBackToSearch}
                  className="p-1.5 -ml-1.5 rounded-md hover:bg-zinc-100 transition-colors text-zinc-600 hover:text-zinc-900"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-neutral-900">Edit Search</h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-neutral-500">
                  <span className="font-semibold text-neutral-900">{loading ? "..." : listings.length}</span>
                  {" "}listings found
                </span>
              </div>
            </div>
          </div>

          {/* Sticky Bulk Action Bar */}
          {selectedListings.size > 0 && (
            <SectionCard className="sticky top-16 z-30 mb-4 p-3 bg-neutral-100 shadow-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground">
                  <CheckSquare className="h-5 w-5" />
                  <span className="font-semibold">{selectedListings.size} Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8"
                    onClick={() => toast.info("Message feature coming soon")}
                  >
                    <List className="h-4 w-4 mr-1.5" />
                    Message
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8"
                    onClick={() => toast.info("Add to Hotsheet coming soon")}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                    Add to Hotsheet
                  </Button>
                  <BulkShareListingsDialog
                    listingIds={Array.from(selectedListings)}
                    listingCount={selectedListings.size}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setSelectedListings(new Set());
                    }}
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Clear
                  </Button>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Results — premium horizontal card stack only */}
          <section className="bg-transparent">
            <ListingResultsTable
              listings={listings}
              loading={loading}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              onRowClick={handleRowClick}
              filters={filters}
              fromPath={`/listing-results${window.location.search}`}
            />
          </section>
        </div>
      </main>
    </div>
  );
};

export default ListingSearchResults;

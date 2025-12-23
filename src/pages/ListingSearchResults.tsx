import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";

import ListingResultsTable from "@/components/listing-search/ListingResultsTable";
import ListingCard from "@/components/ListingCard";
import { toast } from "sonner";
import { ArrowLeft, LayoutGrid, List, CheckSquare, Eye, EyeOff, Bookmark, FileSpreadsheet, X } from "lucide-react";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";
import { Button } from "@/components/ui/button";
import { FilterState, initialFilters } from "@/components/listing-search/ListingSearchFilters";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SectionCard } from "@/components/ui/section-card";
import SaveToHotSheetDialog from "@/components/SaveToHotSheetDialog";
import SaveSearchDialog from "@/components/SaveSearchDialog";


const ListingSearchResults = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [filters] = useState<FilterState>(() => {
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
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState("list_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [hotSheetDialogOpen, setHotSheetDialogOpen] = useState(false);
  const [saveSearchDialogOpen, setSaveSearchDialogOpen] = useState(false);

  // Build current search criteria for hot sheet
  const buildHotSheetCriteria = () => ({
    state: filters?.state,
    county: filters?.county,
    cities: filters?.selectedTowns,
    propertyTypes: filters?.propertyTypes,
    minPrice: filters?.priceMin ? parseInt(filters.priceMin) : null,
    maxPrice: filters?.priceMax ? parseInt(filters.priceMax) : null,
    bedrooms: filters?.bedsMin ? parseInt(filters.bedsMin) : null,
    bathrooms: filters?.bathsMin ? parseFloat(filters.bathsMin) : null,
    statuses: filters?.statuses,
  });

  // Generate search summary for default name
  const searchSummary = useMemo(() => {
    const parts: string[] = [];
    
    // Towns
    if (filters.selectedTowns.length > 0) {
      parts.push(filters.selectedTowns.slice(0, 2).join(", ") + (filters.selectedTowns.length > 2 ? ` +${filters.selectedTowns.length - 2}` : ""));
    } else if (filters.state) {
      parts.push(filters.state);
    }
    
    // Beds
    if (filters.bedsMin) {
      parts.push(`${filters.bedsMin}+ Beds`);
    }
    
    // Price
    if (filters.priceMin || filters.priceMax) {
      const min = filters.priceMin ? `$${Math.round(parseInt(filters.priceMin) / 1000)}k` : "";
      const max = filters.priceMax ? `$${Math.round(parseInt(filters.priceMax) / 1000)}k` : "";
      if (min && max) {
        parts.push(`${min}–${max}`);
      } else if (min) {
        parts.push(`${min}+`);
      } else if (max) {
        parts.push(`Up to ${max}`);
      }
    }
    
    return parts.join(" • ") || `Search ${new Date().toLocaleDateString()}`;
  }, [filters]);

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

  const toggleSelectAll = () => {
    if (selectedListings.size === displayedListings.length) {
      setSelectedListings(new Set());
    } else {
      setSelectedListings(new Set(displayedListings.map(l => l.id)));
    }
  };

  const handleKeepSelected = () => {
    setShowSelectedOnly(!showSelectedOnly);
  };



  const displayedListings = showSelectedOnly 
    ? listings.filter(l => selectedListings.has(l.id))
    : listings;

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
        description,
        photos,
        neighborhood,
        open_houses,
        property_styles
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
          .select("id, first_name, last_name, email, phone, cell_phone, office_name")
          .in("id", agentIds);

        const agentMap = new Map(
          agents?.map(a => [a.id, {
            name: `${a.first_name || ''} ${a.last_name || ''}`.trim(),
            email: a.email,
            phone: a.cell_phone || a.phone,
            office: a.office_name,
          }]) || []
        );

        const listingsWithAgents = data.map(l => {
          const agentInfo = agentMap.get(l.agent_id);
          return {
            ...l,
            agent_name: agentInfo?.name || null,
            list_agent_email: agentInfo?.email || null,
            list_agent_phone: agentInfo?.phone || null,
            list_office: agentInfo?.office || null,
          };
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
    <div className="min-h-screen flex flex-col bg-[#FAFAF8]">
      <Navigation />

      <main className="flex-1 pt-20">
        <div className="max-w-[1400px] mx-auto px-6 pt-6">
          {/* Page Header */}
          <div className="mb-6 border-b border-neutral-200/70 bg-transparent px-0 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBackToSearch}
                  className="p-1.5 -ml-1.5 rounded-md hover:bg-neutral-50 transition-colors text-neutral-400 hover:text-neutral-700"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="h-5 w-px bg-neutral-200" />
                <div>
                  <h1 className="text-lg font-semibold text-neutral-900">Search Results</h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-neutral-500">
                  <span className="font-semibold text-neutral-900">{loading ? "..." : listings.length}</span>
                  {" "}listings found
                </span>
                <div className="h-5 w-px bg-neutral-200" />
                <ToggleGroup
                  type="single" 
                  value={viewMode} 
                  onValueChange={(value) => value && setViewMode(value as "list" | "grid")}
                  className="bg-neutral-100 rounded-lg p-0.5"
                >
                  <ToggleGroupItem 
                    value="list" 
                    aria-label="List view"
                    className="h-7 w-7 p-0 rounded-md data-[state=on]:bg-white data-[state=on]:shadow-sm text-neutral-500 data-[state=on]:text-neutral-900"
                  >
                    <List className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="grid" 
                    aria-label="Grid view"
                    className="h-7 w-7 p-0 rounded-md data-[state=on]:bg-white data-[state=on]:shadow-sm text-neutral-500 data-[state=on]:text-neutral-900"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </div>

          {/* Sticky Bulk Action Bar */}
          {selectedListings.size > 0 && (
            <SectionCard className="sticky top-16 z-30 mb-4 p-3 bg-neutral-100">
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
                      setShowSelectedOnly(false);
                    }}
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Clear
                  </Button>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Results */}
          {viewMode === "list" ? (
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
          ) : (
            <>
              {/* Grid View Action Buttons */}
              <SectionCard className="mb-4 p-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAll}
                    className="h-8 gap-1.5 text-sm"
                  >
                    <CheckSquare className="h-4 w-4" />
                    {selectedListings.size === displayedListings.length && displayedListings.length > 0 ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleKeepSelected}
                    disabled={selectedListings.size === 0}
                    className="h-8 gap-1.5 text-sm"
                  >
                    {showSelectedOnly ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showSelectedOnly ? 'Show All' : 'Keep Selected'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSaveSearchDialogOpen(true)}
                    className="h-8 gap-1.5 text-sm"
                  >
                    <Bookmark className="h-4 w-4" />
                    Save Search
                  </Button>
                  <Button
                    variant="brandOutline"
                    size="sm"
                    onClick={() => {
                      if (selectedListings.size === 0) {
                        toast.error("You haven't selected any properties", {
                          description: "Select one or more properties from the results to save a hotsheet.",
                        });
                        return;
                      }
                      setHotSheetDialogOpen(true);
                    }}
                    className="h-8 gap-1.5 text-sm"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Save as Hot Sheet
                  </Button>
                </div>
              </SectionCard>

              {/* Hot Sheet Dialog */}
              <SaveToHotSheetDialog
                open={hotSheetDialogOpen}
                onOpenChange={setHotSheetDialogOpen}
                currentSearch={buildHotSheetCriteria()}
                selectedListingIds={Array.from(selectedListings)}
              />

              {/* Save Search Dialog */}
              <SaveSearchDialog
                open={saveSearchDialogOpen}
                onOpenChange={setSaveSearchDialogOpen}
                searchSummary={searchSummary}
              />

              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-background border border-border rounded-lg h-72 animate-pulse" />
                  ))
                ) : displayedListings.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    No listings found matching your criteria
                  </div>
                ) : (
                  displayedListings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      viewMode="grid"
                      showActions={false}
                      agentInfo={listing.agent_name ? { name: listing.agent_name } : null}
                      onSelect={handleSelectListing}
                      isSelected={selectedListings.has(listing.id)}
                    />
                  ))
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ListingSearchResults;

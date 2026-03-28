import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { filterVisibleListings } from "@/lib/filterVisibleListings";
import { applyLocationFilter } from "@/lib/buildLocationFilter";
import { getListingIdsWithinRadius } from "@/lib/buildRadiusFilter";
import { parseRadiusParams } from "@/lib/buildSearchParams";

import ListingResultsTable from "@/components/listing-search/ListingResultsTable";
import { toast } from "sonner";
import { ArrowLeft, ListChecks, Check, FileSpreadsheet } from "lucide-react";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";
import { Button } from "@/components/ui/button";
import { FilterState, initialFilters } from "@/components/listing-search/ListingSearchFilters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SaveToHotSheetDialog from "@/components/SaveToHotSheetDialog";


const ListingSearchResults = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [filters] = useState<FilterState>(() => {
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
    return urlFilters;
  });
  
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState("list_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Command bar state (lifted from ListingResultsTable)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [hotSheetDialogOpen, setHotSheetDialogOpen] = useState(false);

  // Displayed listings based on selected-only filter
  const displayedListings = showSelectedOnly
    ? listings.filter((l) => selectedRows.has(l.id))
    : listings;

  const toggleSelectAll = () => {
    if (selectedRows.size === displayedListings.length && displayedListings.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(displayedListings.map((l) => l.id)));
    }
  };

  const handleKeepSelected = () => {
    setShowSelectedOnly(!showSelectedOnly);
  };

  const toggleRowSelection = (id: string, e?: React.SyntheticEvent) => {
    e?.stopPropagation?.();
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const handleSearch = useCallback(async () => {
    setLoading(true);
    try {
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;

    let query = supabase
      .from("listings")
      .select(`
        id, listing_number, address, unit_number, city, state, zip_code,
        price, bedrooms, bathrooms, square_feet, status, list_date,
        property_type, agent_id, lot_size, year_built, garage_spaces,
        total_parking_spaces, description, photos, neighborhood, open_houses,
        property_styles, num_fireplaces, virtual_tour_url, video_url,
        documents, floors, active_date, condo_details, price_range_min, price_range_max
      `)
      .limit(500);

      if (filters.statuses.length > 0) query = query.in("status", filters.statuses);
      if (filters.internalFilter === "off_market") query = query.eq("status", "off_market");
      else if (filters.internalFilter === "coming_soon") query = query.eq("status", "coming_soon");
      if (filters.propertyTypes.length > 0) query = query.in("property_type", filters.propertyTypes);
      if (filters.priceMin) query = query.gte("price", parseInt(filters.priceMin));
      if (filters.priceMax) query = query.lte("price", parseInt(filters.priceMax));
      if (filters.bedsMin) query = query.gte("bedrooms", parseInt(filters.bedsMin));
      if (filters.bedsMax) query = query.lte("bedrooms", parseInt(filters.bedsMax));
      if (filters.bathsMin) query = query.gte("bathrooms", parseFloat(filters.bathsMin));
      if (filters.bathsMax) query = query.lte("bathrooms", parseFloat(filters.bathsMax));
      if (filters.sqftMin) query = query.gte("square_feet", parseInt(filters.sqftMin));
      if (filters.sqftMax) query = query.lte("square_feet", parseInt(filters.sqftMax));
      if (filters.yearBuiltMin) query = query.gte("year_built", parseInt(filters.yearBuiltMin));
      if (filters.yearBuiltMax) query = query.lte("year_built", parseInt(filters.yearBuiltMax));
      if (filters.garageSpaces) query = query.gte("garage_spaces", parseInt(filters.garageSpaces));
      if (filters.parkingSpaces) query = query.gte("total_parking_spaces", parseInt(filters.parkingSpaces));
      if (filters.state) query = query.eq("state", filters.state);
      if (filters.selectedTowns.length > 0) query = applyLocationFilter(query, filters.selectedTowns);
      if (filters.streetNumber) query = query.ilike("address", `${filters.streetNumber}%`);
      if (filters.streetName) query = query.ilike("address", `%${filters.streetName}%`);
      if (filters.zipCode) query = query.ilike("zip_code", `${filters.zipCode}%`);
      if (filters.keywordsInclude) query = query.ilike("description", `%${filters.keywordsInclude}%`);

      const ascending = sortDirection === "asc";
      query = query.order(sortColumn, { ascending, nullsFirst: false });

      const { data, error } = await query;

      if (error) {
        console.error("Search error:", error);
        toast.error("Error searching listings");
        return;
      }

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

        listingsWithAgents = filterVisibleListings(listingsWithAgents, currentUserId);

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

  useEffect(() => { handleSearch(); }, []);
  useEffect(() => {
    if (listings.length > 0 || loading) handleSearch();
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
    <div className="min-h-screen flex flex-col bg-white pt-6">
      <main className="flex-1">
        <div className="max-w-[1400px] mx-auto">
          {/* ── Unified Sticky Command Bar ──────────────────────────────── */}
          <div className="sticky top-0 z-20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-zinc-200 px-5 py-4">
            {/* Row 1: Navigation + Count */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBackToSearch}
                  className="p-1.5 -ml-1.5 rounded-md hover:bg-zinc-100 transition-colors text-zinc-600 hover:text-zinc-900"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-lg font-semibold text-zinc-900">Edit Search</h1>
              </div>
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm font-medium text-zinc-700">
                {loading ? "…" : displayedListings.length} listings found
              </span>
            </div>

            {/* Row 2: Actions + Sort */}
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="h-9 px-4 text-sm font-medium rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 transition-colors"
                >
                  <ListChecks className="h-4 w-4 mr-1.5 !text-[hsl(221,92%,51%)]" />
                  {selectedRows.size === displayedListings.length && displayedListings.length > 0
                    ? "Deselect All"
                    : "Select All"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedRows.size === 0 && !showSelectedOnly}
                  onClick={handleKeepSelected}
                  className="h-9 px-4 text-sm font-medium rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 transition-colors disabled:opacity-50"
                >
                  <Check className="h-4 w-4 mr-1.5 !text-[hsl(221,92%,51%)]" />
                  {showSelectedOnly ? "Show All" : "Keep Selected"}
                </Button>
                {selectedRows.size > 0 && (
                  <BulkShareListingsDialog
                    listingIds={Array.from(selectedRows)}
                    listingCount={selectedRows.size}
                  />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedRows.size === 0) {
                      toast.error("You haven't selected any properties", {
                        description: "Select one or more properties from the results to save a hotsheet.",
                      });
                      return;
                    }
                    setHotSheetDialogOpen(true);
                  }}
                  className="h-9 px-4 text-sm font-medium rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 transition-colors"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1.5 !text-[hsl(221,92%,51%)]" />
                  Save as Hot Sheet
                </Button>
              </div>

              <div className="flex items-center gap-3">
                {selectedRows.size > 0 && (
                  <span className="inline-flex items-center rounded-full border border-primary/20 bg-blue-50/50 px-3 py-1 text-sm font-medium text-primary">
                    {selectedRows.size} selected
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-500">Sort:</span>
                  <Select
                    value={
                      (() => {
                        const rev: Record<string, string> = {
                          "list_date_desc": "date_new",
                          "list_date_asc": "date_old",
                          "price_desc": "price_high",
                          "price_asc": "price_low",
                          "square_feet_desc": "sqft",
                          "bedrooms_desc": "beds",
                        };
                        return rev[`${sortColumn}_${sortDirection}`] ?? "date_new";
                      })()
                    }
                    onValueChange={(value) => {
                      const map: Record<string, [string, "asc" | "desc"]> = {
                        date_new: ["list_date", "desc"],
                        date_old: ["list_date", "asc"],
                        price_high: ["price", "desc"],
                        price_low: ["price", "asc"],
                        sqft: ["square_feet", "desc"],
                        beds: ["bedrooms", "desc"],
                      };
                      const [col, dir] = map[value] ?? ["list_date", "desc"];
                      setSortColumn(col);
                      setSortDirection(dir);
                    }}
                  >
                    <SelectTrigger className="w-[150px] h-9 text-sm rounded-lg border-zinc-300 bg-white focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-zinc-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-zinc-200 bg-white">
                      <SelectItem value="date_new">Date (New)</SelectItem>
                      <SelectItem value="date_old">Date (Old)</SelectItem>
                      <SelectItem value="price_high">Price (High)</SelectItem>
                      <SelectItem value="price_low">Price (Low)</SelectItem>
                      <SelectItem value="sqft">Square Feet</SelectItem>
                      <SelectItem value="beds">Bedrooms</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* ── Hot Sheet Dialog ────────────────────────────────────────── */}
          <SaveToHotSheetDialog
            open={hotSheetDialogOpen}
            onOpenChange={setHotSheetDialogOpen}
            currentSearch={buildHotSheetCriteria()}
            selectedListingIds={Array.from(selectedRows)}
          />

          {/* ── Results ────────────────────────────────────────────────── */}
          <section className="bg-transparent px-5 pb-6 pt-4">
            <ListingResultsTable
              listings={displayedListings}
              loading={loading}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              onRowClick={handleRowClick}
              selectedRows={selectedRows}
              onToggleSelect={toggleRowSelection}
              fromPath={`/listing-results${window.location.search}`}
            />
          </section>
        </div>
      </main>
    </div>
  );
};

export default ListingSearchResults;

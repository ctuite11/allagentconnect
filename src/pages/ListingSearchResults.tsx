import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { filterVisibleListings } from "@/lib/filterVisibleListings";
import { filterByPricePerSqft } from "@/lib/filterByPricePerSqft";
import { applyLocationFilter } from "@/lib/buildLocationFilter";
import { getListingIdsWithinRadius } from "@/lib/buildRadiusFilter";
import { parseAdvancedParams } from "@/lib/buildSearchParams";

import ListingResultsTable from "@/components/listing-search/ListingResultsTable";
import ListingCard from "@/components/ListingCard";
import PropertyMap from "@/components/PropertyMap";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, ListChecks, Check, FileSpreadsheet } from "lucide-react";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";
import { Button } from "@/components/ui/button";
import { FilterState, initialFilters } from "@/components/listing-search/ListingSearchFilters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SaveToHotSheetDialog from "@/components/SaveToHotSheetDialog";

/** Drop list-side agent/office fields so compact `ListingCard` has no “Listed by” row (buyer map grid parity). */
function listingRowForMapCompactGrid(row: Record<string, unknown>) {
  return {
    ...row,
    brokerage_name: null,
    agent_name: null,
    listing_brokerage: null,
    listing_agent_name: null,
    list_office: null,
    list_office_phone: null,
    agent_email: null,
    agent_phone: null,
    agent_profile: undefined,
  };
}

/**
 * Agent listing results (`/listing-results`). Default: split map + compact `ListingCard` grid (same shell as
 * buyer browse). “List” keeps full-width `ListingResultsTable` / MLS-style `SearchListingCard`. Selection,
 * share, and hot-sheet unchanged. Coordinates loaded for `PropertyMap`. Buyer routes not modified here.
 */
const ListingSearchResults = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  
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
    parseAdvancedParams(searchParams, urlFilters);
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
  /** Default split map + cards (same shell as consumer browse); list = full-width stacked cards. */
  const [resultsView, setResultsView] = useState<"map" | "list">("map");

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

    // If radius is set, get IDs within radius first
    let radiusIds: string[] | null = null;
    if (filters.radius && filters.originLat && filters.originLng) {
      radiusIds = await getListingIdsWithinRadius(
        filters.originLat, filters.originLng, filters.radius, filters.radiusUnit
      );
      if (radiusIds && radiusIds.length === 0) {
        setListings([]);
        setLoading(false);
        return;
      }
    }

    let query = supabase
      .from("listings")
      .select(`
        id, listing_number, address, unit_number, city, state, zip_code,
        latitude, longitude,
        price, bedrooms, bathrooms, square_feet, status, list_date,
        property_type, agent_id, lot_size, year_built, garage_spaces,
        total_parking_spaces, description, photos, neighborhood, open_houses,
        property_styles, num_fireplaces, virtual_tour_url, video_url,
        documents, floors, active_date, condo_details, price_range_min, price_range_max
      `)
      .limit(500);

      // Apply radius ID filter
      if (radiusIds) {
        query = query.in("id", radiusIds);
      }

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
      if (filters.lotSizeMin) query = query.gte("lot_size", parseFloat(filters.lotSizeMin));
      if (filters.lotSizeMax) query = query.lte("lot_size", parseFloat(filters.lotSizeMax));
      if (filters.keywordsInclude) query = query.ilike("description", `%${filters.keywordsInclude}%`);
      if (filters.listingNumber) query = query.ilike("listing_number", `%${filters.listingNumber.replace(/^L-/i, "")}%`);
      if (filters.listDateFrom) query = query.gte("list_date", filters.listDateFrom);
      if (filters.listDateTo) query = query.lte("list_date", filters.listDateTo);

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
          .select("id, first_name, last_name, company, email, phone, cell_phone, office_name, office_phone")
          .in("id", agentIds);

        const agentMap = new Map(
          agents?.map(a => [a.id, {
            name: `${a.first_name || ''} ${a.last_name || ''}`.trim(),
            brokerageName: typeof a.company === "string" && a.company.trim() ? a.company.trim() : null,
            email: a.email,
            phone: a.cell_phone || a.phone,
            office: typeof a.office_name === "string" && a.office_name.trim() ? a.office_name.trim() : null,
            officePhone: a.office_phone,
          }]) || []
        );

        let listingsWithAgents = data.map(l => {
          const agentInfo = agentMap.get(l.agent_id);
          return {
            ...l,
            brokerage_name: agentInfo?.brokerageName || null,
            agent_name: agentInfo?.name || null,
            agent_email: agentInfo?.email || null,
            agent_phone: agentInfo?.phone || null,
            list_office: agentInfo?.office || null,
            list_office_phone: agentInfo?.officePhone || null,
          };
        });

        listingsWithAgents = filterVisibleListings(listingsWithAgents, currentUserId);
        listingsWithAgents = filterByPricePerSqft(listingsWithAgents, filters.pricePerSqFtMin || "", filters.pricePerSqFt || "");

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

  useEffect(() => { handleSearch(); }, [handleSearch]);

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

  /** Map+cards split only: right-column toolbar. List / loading / empty map keep the full-width toolbar. */
  const showMapSplit =
    resultsView === "map" && !loading && displayedListings.length > 0;

  const renderAgentToolbar = (compact: boolean) => {
    const actionBtnClass = cn(
      "font-medium rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 transition-colors",
      compact
        ? "h-6 shrink-0 whitespace-nowrap px-1.5 text-[11px]"
        : "h-8 px-3 text-[13px]",
    );
    const actionIconClass = cn(
      "shrink-0 !text-[hsl(221,92%,51%)]",
      compact ? "mr-0.5 h-2.5 w-2.5" : "h-3.5 w-3.5 mr-1",
    );
    const shareTriggerClass = compact
      ? "h-6 shrink-0 whitespace-nowrap px-1.5 text-[11px] font-medium rounded-lg [&_svg]:!mr-1 [&_svg]:!h-3 [&_svg]:!w-3"
      : "h-8 px-3 text-[13px] font-medium rounded-lg [&_svg]:size-3.5 [&_svg]:mr-1";
    const metaText = compact ? "text-[11px]" : "text-[13px]";

    return (
      <>
        <div className={cn("flex items-center justify-between", compact ? "py-1.5" : "py-2.5")}>
          <div className={cn("flex items-center", compact ? "gap-2" : "gap-2.5")}>
            <button
              onClick={handleBackToSearch}
              className="p-1 -ml-1 rounded-md hover:bg-zinc-100 transition-colors text-zinc-600 hover:text-zinc-900"
              aria-label="Go back"
            >
              <ArrowLeft className={compact ? "h-4 w-4" : "h-[18px] w-[18px]"} />
            </button>
            <h1
              className={cn(
                "font-semibold text-zinc-900 tracking-tight",
                compact ? "text-[11px]" : "text-sm",
              )}
            >
              Edit Search
            </h1>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 font-medium text-zinc-700 leading-tight",
              compact ? "px-1.5 py-0 text-[11px]" : "px-2.5 py-0.5 text-[13px]",
            )}
          >
            {loading ? "…" : displayedListings.length} listings found
          </span>
        </div>

        <div
          className={cn(
            "flex items-center justify-between gap-2 border-t border-zinc-100",
            /* List: allow wrap; map split: single aligned row — actions scroll horizontally if needed */
            compact ? "min-w-0 flex-nowrap py-1.5" : "flex-wrap pb-2 pt-2",
          )}
          aria-label="Result actions and view controls"
        >
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center",
              compact
                ? "flex-nowrap gap-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                : "flex-wrap gap-1.5",
            )}
          >
            <Button variant="outline" size="sm" onClick={toggleSelectAll} className={actionBtnClass}>
              <ListChecks className={actionIconClass} />
              {selectedRows.size === displayedListings.length && displayedListings.length > 0
                ? "Deselect All"
                : "Select All"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedRows.size === 0 && !showSelectedOnly}
              onClick={handleKeepSelected}
              className={cn(actionBtnClass, "disabled:opacity-50")}
            >
              <Check className={actionIconClass} />
              {showSelectedOnly ? "Show All" : "Keep Selected"}
            </Button>
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
              className={actionBtnClass}
            >
              <FileSpreadsheet className={actionIconClass} />
              Save as Hot Sheet
            </Button>
            {selectedRows.size > 0 && (
              <BulkShareListingsDialog
                listingIds={Array.from(selectedRows)}
                listingCount={selectedRows.size}
                triggerClassName={shareTriggerClass}
              />
            )}
            {selectedRows.size > 0 && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-full border border-primary/20 bg-blue-50/50 font-medium text-primary leading-tight whitespace-nowrap",
                  compact ? "px-1.5 py-0 text-[11px]" : "px-2.5 py-0.5 text-[13px]",
                )}
              >
                {selectedRows.size} selected
              </span>
            )}
          </div>

          <div
            className={cn(
              "flex items-center",
              compact ? "shrink-0 flex-nowrap gap-1 pl-1" : "shrink-0 gap-2",
            )}
          >
            {!loading && displayedListings.length > 0 && (
              <div className={cn("flex items-center", compact ? "gap-1" : "gap-1.5")}>
                <span className={cn("text-zinc-500 whitespace-nowrap", metaText)}>View:</span>
                <div
                  className={cn(
                    "inline-flex rounded-lg border border-zinc-200 bg-zinc-50/80",
                    compact ? "p-0.5" : "p-[3px]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setResultsView("map")}
                    className={cn(
                      "font-medium transition-colors min-w-0 leading-none whitespace-nowrap",
                      compact ? "h-5 rounded px-1.5 text-[11px]" : "h-7 rounded-md px-2.5 text-[13px]",
                      resultsView === "map"
                        ? "bg-zinc-900 text-white shadow-sm"
                        : "text-zinc-600 hover:text-zinc-900",
                    )}
                  >
                    Map
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultsView("list")}
                    className={cn(
                      "font-medium transition-colors min-w-0 leading-none whitespace-nowrap",
                      compact ? "h-5 rounded px-1.5 text-[11px]" : "h-7 rounded-md px-2.5 text-[13px]",
                      resultsView === "list"
                        ? "bg-zinc-900 text-white shadow-sm"
                        : "text-zinc-600 hover:text-zinc-900",
                    )}
                  >
                    List
                  </button>
                </div>
              </div>
            )}
            <div className={cn("flex items-center", compact ? "gap-1" : "gap-1.5")}>
              <span className={cn("text-zinc-500 whitespace-nowrap", metaText)}>Sort:</span>
              <Select
                value={
                  (() => {
                    const rev: Record<string, string> = {
                      list_date_desc: "date_new",
                      list_date_asc: "date_old",
                      price_desc: "price_high",
                      price_asc: "price_low",
                      square_feet_desc: "sqft",
                      bedrooms_desc: "beds",
                    };
                    return rev[`${sortColumn}_${sortDirection}`] ?? "date_new";
                  })()
                }
                onValueChange={(value) => {
                  const colDir: Record<string, [string, "asc" | "desc"]> = {
                    date_new: ["list_date", "desc"],
                    date_old: ["list_date", "asc"],
                    price_high: ["price", "desc"],
                    price_low: ["price", "asc"],
                    sqft: ["square_feet", "desc"],
                    beds: ["bedrooms", "desc"],
                  };
                  const [col, dir] = colDir[value] ?? ["list_date", "desc"];
                  setSortColumn(col);
                  setSortDirection(dir);
                }}
              >
                <SelectTrigger
                  className={cn(
                    "rounded-lg border-zinc-300 bg-white focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-zinc-400",
                    compact
                      ? "h-6 w-[min(100%,5.85rem)] min-w-[4.75rem] max-w-[6.25rem] shrink-0 text-[11px] px-1.5"
                      : "h-8 w-[136px] text-[13px] px-2.5",
                  )}
                >
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
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-white pt-6">
      <main className="flex-1">
        <div className="max-w-[1400px] mx-auto">
          {!showMapSplit && (
            <div
              className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-5"
              aria-label="Agent listing search toolbar"
            >
              {renderAgentToolbar(false)}
            </div>
          )}

          {/* ── Hot Sheet Dialog ────────────────────────────────────────── */}
          <SaveToHotSheetDialog
            open={hotSheetDialogOpen}
            onOpenChange={setHotSheetDialogOpen}
            currentSearch={buildHotSheetCriteria()}
            selectedListingIds={Array.from(selectedRows)}
          />

          <section className="bg-transparent px-5 pb-6 pt-0">
            {showMapSplit ? (
              <div className="flex flex-col-reverse gap-4 h-auto min-h-0 lg:grid lg:grid-cols-[minmax(0,40%)_minmax(0,60%)] lg:flex-none lg:h-[calc(100dvh-5.5rem)] lg:min-h-0">
                <section className="rounded-2xl border border-zinc-200/70 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.07)] overflow-hidden h-[50dvh] min-h-0 sm:h-[54dvh] lg:h-full lg:min-h-0 lg:sticky lg:top-4 lg:self-start">
                  <div className="h-full">
                    <PropertyMap
                      listings={displayedListings}
                      onListingClick={(listingId) =>
                        navigate(`/property/${listingId}`, {
                          state: { from: `/listing-results${window.location.search}` },
                        })
                      }
                    />
                  </div>
                </section>
                <div className="flex min-h-[50vh] flex-col rounded-2xl shadow-[0_10px_26px_rgba(15,23,42,0.07)] lg:h-full lg:min-h-0">
                  <div
                    className="sticky top-0 z-20 shrink-0 rounded-t-2xl border border-b-0 border-zinc-200/70 bg-white/95 px-3 pt-2 pb-2 backdrop-blur supports-[backdrop-filter]:bg-white/80"
                    aria-label="Agent split map search toolbar"
                  >
                    {renderAgentToolbar(true)}
                  </div>
                  <section className="min-h-0 flex-1 overflow-y-auto rounded-b-2xl border border-t border-zinc-200/70 bg-white">
                    <div className="px-6 py-4">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {displayedListings.map((listing) => (
                          <ListingCard
                            key={listing.id}
                            listing={listingRowForMapCompactGrid(listing)}
                            viewMode="compact"
                            showActions={false}
                            hideMlsMeta
                            agentInfo={null}
                            showCompactComments={false}
                            hideCompactFavorite
                            compactDetailNavigateState={{
                              from: `/listing-results${search}`,
                            }}
                            onSelect={(id) => toggleRowSelection(id)}
                            isSelected={selectedRows.has(listing.id)}
                          />
                        ))}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            ) : (
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
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default ListingSearchResults;

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { AacBackButton } from "@/components/layout/AacBackLink";
import { AacPageIntro } from "@/components/layout/AacPageIntro";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";
import { Button } from "@/components/ui/button";
import { FilterState, initialFilters } from "@/components/listing-search/ListingSearchFilters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SaveToHotSheetDialog from "@/components/SaveToHotSheetDialog";
import { listingEffectiveNumericPrice } from "@/lib/formatListingPriceDisplay";
import { applyListingPriceOverlapFilter } from "@/lib/applyListingPriceOverlapFilter";

/** Drop list-side agent/office fields so compact `ListingCard` has no “Listed by” row (buyer map grid parity). */
function listingRowForMapCompactGrid(row: any): any {
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
  const safeSelectedRows = selectedRows instanceof Set ? selectedRows : new Set<string>();

  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [hotSheetDialogOpen, setHotSheetDialogOpen] = useState(false);
  /** Default split map + cards (same shell as consumer browse); list = full-width stacked cards. */
  const [resultsView, setResultsView] = useState<"map" | "list">("map");

  // Displayed listings based on selected-only filter
  const displayedListings = showSelectedOnly
    ? listings.filter((l) => safeSelectedRows.has(l.id))
    : listings;

  const displayedListingIds = useMemo(
    () => displayedListings.map((l) => l.id),
    [displayedListings],
  );

  const applySelectedRows = useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      setSelectedRows(updater(safeSelectedRows));
    },
    [safeSelectedRows],
  );

  const addAllVisible = useCallback(() => {
    applySelectedRows((prev) => {
      const next = new Set(prev);
      displayedListings.forEach((l) => next.add(l.id));
      return next;
    });
  }, [displayedListings, applySelectedRows]);

  const unselectAllVisible = useCallback(() => {
    applySelectedRows((prev) => {
      const next = new Set(prev);
      displayedListings.forEach((l) => next.delete(l.id));
      return next;
    });
  }, [displayedListings, applySelectedRows]);

  const clearShareSelection = useCallback(() => {
    applySelectedRows((prev) => {
      const next = new Set(prev);
      displayedListingIds.forEach((id) => {
        if (prev.has(id)) next.delete(id);
      });
      return next;
    });
  }, [displayedListingIds, applySelectedRows]);

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
      {
        const pmin = filters.priceMin ? parseInt(filters.priceMin, 10) : NaN;
        const pmax = filters.priceMax ? parseInt(filters.priceMax, 10) : NaN;
        query = applyListingPriceOverlapFilter(
          query,
          Number.isFinite(pmin) && pmin > 0 ? pmin : null,
          Number.isFinite(pmax) && pmax > 0 ? pmax : null,
        );
      }
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
      // DB `price` sorts ignore `price_range_*`; price order is applied client-side with `listingEffectiveNumericPrice`.
      if (sortColumn !== "price") {
        query = query.order(sortColumn, { ascending, nullsFirst: false });
      } else {
        query = query.order("list_date", { ascending: false, nullsFirst: false });
      }

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

        if (sortColumn === "price") {
          const dir = sortDirection === "asc" ? 1 : -1;
          listingsWithAgents = [...listingsWithAgents].sort((a, b) => {
            const ea = listingEffectiveNumericPrice(a);
            const eb = listingEffectiveNumericPrice(b);
            const aMissing = ea == null;
            const bMissing = eb == null;
            if (aMissing && bMissing) return 0;
            if (aMissing) return 1;
            if (bMissing) return -1;
            return (ea - eb) * dir;
          });
        }

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

  const showMapSplit =
    resultsView === "map" && !loading && displayedListings.length > 0;

  const sortSelectValue =
    ({
      list_date_desc: "date_new",
      list_date_asc: "date_old",
      price_desc: "price_high",
      price_asc: "price_low",
      square_feet_desc: "sqft",
      bedrooms_desc: "beds",
    } as Record<string, string>)[`${sortColumn}_${sortDirection}`] ?? "date_new";

  const handleSortSelect = (value: string) => {
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
  };

  const renderToolbarTitleRow = () => (
    <AacPageIntro
      withTopPadding
      back={<AacBackButton type="button" onClick={handleBackToSearch} />}
      title="Edit search"
      titleClassName="text-[13px] sm:text-sm"
    />
  );

  /** Top strip in results container: Results on left, View + Sort on right. */
  const renderResultsTopStrip = (variant: "page" | "column") => {
    const compact = variant === "column";
    const labelClass = compact ? "text-[11px] font-medium text-neutral-500" : "text-[13px] text-neutral-500";
    const toggleBtnClass = compact
      ? "h-[22px] min-w-[2.25rem] rounded-[4px] px-1.5 text-[11px] font-medium whitespace-nowrap leading-none transition-colors duration-200 ease-out"
      : "h-7 min-w-[2.5rem] rounded-md px-2.5 text-[13px] font-medium leading-none transition-colors duration-200 ease-out";
    const toggleWrapClass = compact
      ? "inline-flex rounded-md border border-neutral-200 bg-white p-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      : "inline-flex rounded-lg border border-neutral-200 bg-white p-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

    const showViewToggle = !loading && displayedListings.length > 0;

    return (
      <div className="w-full">
        <div
          className="flex w-full items-center justify-between gap-3"
          aria-label="Results summary and controls"
        >
          <p className={cn("min-w-0 truncate font-medium text-neutral-900 tabular-nums", compact ? "text-sm" : "text-[13px]")}>
            {loading ? "Results: —" : `Results: ${displayedListings.length.toLocaleString()}`}
          </p>
          <div className="flex min-w-0 shrink-0 items-center justify-end gap-2">
            {showViewToggle && (
              <div className="flex min-w-0 items-center gap-1.5">
                <span className={cn(labelClass, "whitespace-nowrap")}>View</span>
                <div className={toggleWrapClass}>
                  <button
                    type="button"
                    onClick={() => setResultsView("map")}
                    className={cn(
                      toggleBtnClass,
                      resultsView === "map"
                        ? "bg-neutral-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
                    )}
                  >
                    Map
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultsView("list")}
                    className={cn(
                      toggleBtnClass,
                      resultsView === "list"
                        ? "bg-neutral-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
                    )}
                  >
                    List
                  </button>
                </div>
              </div>
            )}
            <div className={cn("min-w-0", compact ? "max-w-[7.5rem]" : "w-full max-w-[8.5rem] min-[520px]:max-w-[11rem]")}>
              <Select value={sortSelectValue} onValueChange={handleSortSelect}>
                <SelectTrigger
                  className={cn(
                    compact
                      ? "h-7 rounded-md border-neutral-200/90 bg-white px-2 text-[11px] font-medium text-neutral-900 shadow-none focus-visible:ring-2 focus-visible:ring-neutral-300/50 focus-visible:ring-offset-2"
                      : "h-8 rounded-md border-neutral-200/90 bg-white text-xs font-medium text-neutral-900 shadow-none focus-visible:ring-2 focus-visible:ring-neutral-300/50 focus-visible:ring-offset-2",
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg border border-neutral-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
                  <SelectItem value="date_new">Date (New)</SelectItem>
                  <SelectItem value="date_old">Date (Old)</SelectItem>
                  <SelectItem value="price_high">Price (High)</SelectItem>
                  <SelectItem value="price_low">Price (Low)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /** Second strip: compact selection + share pills (view/sort live on top strip). */
  const renderResultsActionsRow = () => {
    const saveHotSheetBtn = (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 rounded-md border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50"
        onClick={() => {
          if (safeSelectedRows.size === 0) {
            toast.error("You haven't selected any properties", {
              description: "Select one or more properties from the results to save a hotsheet.",
            });
            return;
          }
          setHotSheetDialogOpen(true);
        }}
      >
        Save as Hot Sheet
      </Button>
    );

    return (
      <div className="w-full" aria-label="Result actions">
        <AgentSplitResultsSelectionActions
          displayedListingIds={displayedListingIds}
          selectedRows={safeSelectedRows}
          showSelectedOnly={showSelectedOnly}
          onAddAllVisible={addAllVisible}
          onUnselectAllVisible={unselectAllVisible}
          onKeepSelectedOnly={() => setShowSelectedOnly(true)}
          onShowAll={() => setShowSelectedOnly(false)}
          onSuccessfulShare={clearShareSelection}
        >
          {saveHotSheetBtn}
        </AgentSplitResultsSelectionActions>
      </div>
    );
  };

  const renderAgentToolbarFull = () => (
    <>
      {renderToolbarTitleRow()}
      <div className="border-t border-neutral-100 pt-2">
        {renderResultsTopStrip("page")}
      </div>
      <div className="border-t border-neutral-100 pb-2 pt-2">
        {renderResultsActionsRow()}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="flex-1">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-5">
          {!showMapSplit && (
            <div
              className="sticky top-0 z-20 border-b border-neutral-200 bg-white px-3 sm:px-4 lg:px-5"
              aria-label="Agent listing search toolbar"
            >
              {renderAgentToolbarFull()}
            </div>
          )}
          {showMapSplit && (
            <div
              className="border-b border-neutral-200 bg-white px-3 sm:px-4 lg:px-5"
              aria-label="Agent listing search header"
            >
              {renderToolbarTitleRow()}
            </div>
          )}

          <SaveToHotSheetDialog
            open={hotSheetDialogOpen}
            onOpenChange={setHotSheetDialogOpen}
            currentSearch={buildHotSheetCriteria()}
            selectedListingIds={Array.from(safeSelectedRows)}
          />

          <section className="bg-transparent pb-6 pt-0">
            {showMapSplit ? (
              <div className="mt-3 flex h-auto min-h-0 flex-col-reverse gap-3 sm:mt-4 sm:gap-4 lg:grid lg:h-[calc(100dvh-7.25rem)] lg:min-h-0 lg:grid-cols-[minmax(0,40%)_minmax(0,60%)] lg:flex-none">
                <section className="h-[48dvh] min-h-0 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:h-[52dvh] lg:sticky lg:top-[5.5rem] lg:h-full lg:min-h-0 lg:self-start">
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

                <section className="flex h-auto min-h-0 max-lg:min-h-[48vh] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] lg:h-full lg:min-h-0">
                  <div className="shrink-0 border-b border-neutral-200/90 bg-white px-3 py-2 sm:px-5 sm:py-2.5">
                    {renderResultsTopStrip("column")}
                  </div>
                  <div className="shrink-0 border-b border-neutral-100 bg-white px-3 py-2 sm:px-5 sm:py-2.5">
                    {renderResultsActionsRow()}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto lg:min-h-0">
                    <div className="px-3 py-3 sm:px-5 sm:py-4">
                      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
                        {displayedListings.map((listing) => (
                          <ListingCard
                            key={listing.id}
                            listing={listing}
                            viewMode="compact"
                            showActions={false}
                            agentInfo={null}
                            showCompactComments={false}
                            hideCompactFavorite
                            isHotSheetFavorite={false}
                            compactDetailNavigateState={{
                              from: `/listing-results${search}`,
                            }}
                            onSelect={(id) => toggleRowSelection(id)}
                            isSelected={safeSelectedRows.has(listing.id)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            ) : (
              <ListingResultsTable
                listings={displayedListings}
                loading={loading}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
                onRowClick={handleRowClick}
                selectedRows={safeSelectedRows}
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

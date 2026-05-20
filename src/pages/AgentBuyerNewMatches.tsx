import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AacBackButton } from "@/components/layout/AacBackLink";
import { AacPageIntro } from "@/components/layout/AacPageIntro";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import PropertyMap from "@/components/PropertyMap";
import ListingCard from "@/components/ListingCard";
import ListingResultsTable from "@/components/listing-search/ListingResultsTable";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListChecks, Check } from "lucide-react";
import { Seo } from "@/components/Seo";
import {
  fetchBuyerNewHotSheetMatches,
  type BuyerNewHotSheetMatchRow,
} from "@/lib/fetchBuyerNewHotSheetMatches";
import { listingEffectiveNumericPrice } from "@/lib/formatListingPriceDisplay";

function listingRowForMapCompactGrid(row: BuyerNewHotSheetMatchRow): BuyerNewHotSheetMatchRow {
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
 * Agent view: new listings matching a buyer's hot sheet criteria (not yet sent on any linked sheet).
 * Split map/list layout aligned with `/listing-results`.
 */
export default function AgentBuyerNewMatches() {
  const { buyerId } = useParams<{ buyerId: string }>();
  const navigate = useNavigate();
  const backTo = buyerId ? `/agent/buyers/${buyerId}` : "/agent/buyers";
  const resultsFromPath = buyerId ? `/agent/buyers/${buyerId}/new-matches` : "/agent/buyers";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buyerDisplayName, setBuyerDisplayName] = useState("");
  const [hotSheetCount, setHotSheetCount] = useState(0);
  const [listings, setListings] = useState<BuyerNewHotSheetMatchRow[]>([]);
  const [sortColumn, setSortColumn] = useState("list_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [resultsView, setResultsView] = useState<"map" | "list">("map");

  const loadMatches = useCallback(async () => {
    if (!buyerId) {
      setLoadError("Buyer not found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoadError("Please sign in to view new matches.");
        setListings([]);
        return;
      }

      const result = await fetchBuyerNewHotSheetMatches(supabase, buyerId, user.id);
      setBuyerDisplayName(result.buyerDisplayName);
      setHotSheetCount(result.hotSheetCount);
      setListings(result.listings);
    } catch (e) {
      console.error("[AgentBuyerNewMatches]", e);
      setLoadError("Could not load new matches.");
      toast.error("Could not load new matches.");
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [buyerId]);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  const sortedListings = useMemo(() => {
    const rows = [...listings];
    const dir = sortDirection === "asc" ? 1 : -1;
    if (sortColumn === "price") {
      return rows.sort((a, b) => {
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
    return rows.sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sortColumn] ?? "");
      const bv = String((b as Record<string, unknown>)[sortColumn] ?? "");
      return av.localeCompare(bv) * dir;
    });
  }, [listings, sortColumn, sortDirection]);

  const displayedListings = showSelectedOnly
    ? sortedListings.filter((l) => selectedRows.has(l.id))
    : sortedListings;

  const showMapSplit =
    resultsView === "map" && !loading && !loadError && displayedListings.length > 0;

  const toggleSelectAll = () => {
    if (selectedRows.size === displayedListings.length && displayedListings.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(displayedListings.map((l) => l.id)));
    }
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

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const handleRowClick = (listing: BuyerNewHotSheetMatchRow) => {
    navigate(`/property/${listing.id}`, {
      state: { from: resultsFromPath },
    });
  };

  const sortSelectValue =
    ({
      list_date_desc: "date_new",
      list_date_asc: "date_old",
      price_desc: "price_high",
      price_asc: "price_low",
    } as Record<string, string>)[`${sortColumn}_${sortDirection}`] ?? "date_new";

  const handleSortSelect = (value: string) => {
    const colDir: Record<string, [string, "asc" | "desc"]> = {
      date_new: ["list_date", "desc"],
      date_old: ["list_date", "asc"],
      price_high: ["price", "desc"],
      price_low: ["price", "asc"],
    };
    const [col, dir] = colDir[value] ?? ["list_date", "desc"];
    setSortColumn(col);
    setSortDirection(dir);
  };

  const subtitle =
    hotSheetCount > 0
      ? `New listings matching this buyer's hot sheet criteria (${hotSheetCount} hot sheet${hotSheetCount === 1 ? "" : "s"}).`
      : "Link a hot sheet to this buyer to track new matches.";

  const renderResultsTopStrip = (variant: "page" | "column") => {
    const compact = variant === "column";
    const labelClass = compact ? "text-[11px] font-medium text-neutral-500" : "text-[13px] text-neutral-500";
    const toggleBtnClass = compact
      ? "h-[22px] min-w-[2.25rem] rounded-[4px] px-1.5 text-[11px] font-medium whitespace-nowrap leading-none transition-colors duration-200 ease-out"
      : "h-7 min-w-[2.5rem] rounded-md px-2.5 text-[13px] font-medium leading-none transition-colors duration-200 ease-out";
    const toggleWrapClass = compact
      ? "inline-flex rounded-md border border-neutral-200 bg-white p-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      : "inline-flex rounded-lg border border-neutral-200 bg-white p-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]";
    const showViewToggle = !loading && !loadError && displayedListings.length > 0;

    return (
      <div className="w-full">
        <div
          className="flex w-full items-center justify-between gap-3"
          aria-label="Results summary and controls"
        >
          <p
            className={cn(
              "min-w-0 truncate font-medium text-neutral-900 tabular-nums",
              compact ? "text-sm" : "text-[13px]",
            )}
          >
            {loading ? "Results: —" : `Results: ${displayedListings.length.toLocaleString()}`}
          </p>
              <div className="flex min-w-0 shrink-0 justify-end">
            {showViewToggle ? (
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
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderResultsActionsRow = (variant: "page" | "column") => {
    const compact = variant === "column";
    const actionBtnClass = compact
      ? "h-7 shrink-0 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2 text-[11px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:border-neutral-300 hover:bg-neutral-50/90"
      : "h-8 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:border-neutral-300 hover:bg-neutral-50/90";
    const actionIconClass = compact
      ? "mr-0.5 h-3 w-3 shrink-0 text-neutral-600 [&_svg]:text-neutral-600"
      : "mr-1 h-3.5 w-3.5 shrink-0 text-neutral-600 [&_svg]:text-neutral-600";
    const shareTriggerClass = compact
      ? "h-7 gap-0 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2 text-[11px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/90 [&_svg]:mr-1 [&_svg]:!h-3 [&_svg]:!w-3 [&_svg]:text-neutral-600"
      : "h-8 gap-0 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/90 [&_svg]:mr-1 [&_svg]:size-3.5 [&_svg]:text-neutral-600";
    const sortTriggerClass = compact
      ? "h-7 w-[min(100%,118px)] min-w-[7rem] rounded-md border-neutral-200 bg-white px-2 text-[11px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300/45 focus-visible:ring-offset-2"
      : "h-8 w-[136px] rounded-lg border-neutral-200 bg-white px-2.5 text-[13px] text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300/45 focus-visible:ring-offset-2";

    return (
      <div className="w-full">
        <div
          className="flex w-full flex-col gap-2 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between"
          aria-label="Result actions"
        >
          <div className="flex min-w-0 w-full min-[520px]:w-auto min-[520px]:flex-1 flex-wrap items-center gap-2">
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
              onClick={() => setShowSelectedOnly(!showSelectedOnly)}
              className={cn(actionBtnClass, "disabled:opacity-50")}
            >
              <Check className={actionIconClass} />
              {showSelectedOnly ? "Show All" : "Keep Selected"}
            </Button>
            {selectedRows.size > 0 ? (
              <BulkShareListingsDialog
                listingIds={Array.from(selectedRows)}
                listingCount={selectedRows.size}
                triggerVariant="outline"
                triggerClassName={shareTriggerClass}
              />
            ) : null}
          </div>
          <div className="flex justify-end min-[520px]:justify-end">
            <Select value={sortSelectValue} onValueChange={handleSortSelect}>
              <SelectTrigger className={sortTriggerClass}>
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
    );
  };

  const renderToolbar = () => (
    <>
      <AacPageIntro
        withTopPadding
        back={<AacBackButton type="button" onClick={() => navigate(backTo)} />}
        title={buyerDisplayName ? `New matches — ${buyerDisplayName}` : "New matches"}
        subtitle={subtitle}
        titleClassName="text-base sm:text-lg"
      />
      <div className="border-t border-neutral-100 pt-2">{renderResultsTopStrip("page")}</div>
      <div className="border-t border-neutral-100 pb-2 pt-2">{renderResultsActionsRow("page")}</div>
    </>
  );

  return (
    <>
      <Seo
        title="Buyer new matches | All Agent Connect"
        description="New listings matching buyer hot sheet criteria."
        noindex
      />
      <div className="flex min-h-screen flex-col bg-white">
        <main className="flex-1">
          <div className="mx-auto max-w-[1400px] px-4 sm:px-5">
            {!showMapSplit ? (
              <div
                className="sticky top-0 z-20 border-b border-neutral-200 bg-white px-3 sm:px-4 lg:px-5"
                aria-label="Buyer new matches toolbar"
              >
                {renderToolbar()}
              </div>
            ) : (
              <div
                className="border-b border-neutral-200 bg-white px-3 sm:px-4 lg:px-5"
                aria-label="Buyer new matches header"
              >
                <AacPageIntro
                  withTopPadding
                  back={<AacBackButton type="button" onClick={() => navigate(backTo)} />}
                  title={buyerDisplayName ? `New matches — ${buyerDisplayName}` : "New matches"}
                  subtitle={subtitle}
                  titleClassName="text-base sm:text-lg"
                />
              </div>
            )}

            <section className="bg-transparent pb-6 pt-0">
              {loading ? (
                <AacMonogramLoader variant="section" message="Loading new matches…" className="min-h-[40vh]" />
              ) : loadError ? (
                <p className="py-16 text-center text-sm text-red-600" role="alert">
                  {loadError}
                </p>
              ) : displayedListings.length === 0 ? (
                <p className="py-16 text-center text-sm text-neutral-500">
                  {hotSheetCount === 0
                    ? "No hot sheets linked to this buyer yet."
                    : "No new matches right now — listings already sent on hot sheets are hidden."}
                </p>
              ) : showMapSplit ? (
                          <div className="mt-3 flex h-auto min-h-0 flex-col-reverse gap-3 sm:mt-4 sm:gap-4 lg:grid lg:h-[calc(100dvh-7.25rem)] lg:min-h-0 lg:grid-cols-[minmax(0,40%)_minmax(0,60%)] lg:flex-none">
                  <section className="h-[48dvh] min-h-0 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:h-[52dvh] lg:sticky lg:top-[5.5rem] lg:h-full lg:min-h-0 lg:self-start">
                    <div className="h-full">
                      <PropertyMap
                        listings={displayedListings}
                        onListingClick={(listingId) =>
                          navigate(`/property/${listingId}`, {
                            state: { from: resultsFromPath },
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
                      {renderResultsActionsRow("column")}
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto lg:min-h-0">
                      <div className="px-3 py-3 sm:px-5 sm:py-4">
                        <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
                          {displayedListings.map((listing) => (
                            <ListingCard
                              key={listing.id}
                              listing={listingRowForMapCompactGrid(listing)}
                              viewMode="compact"
                              showActions={false}
                              agentInfo={null}
                              showCompactComments={false}
                              hideCompactFavorite
                              isHotSheetFavorite={false}
                              compactDetailNavigateState={{ from: resultsFromPath }}
                              onSelect={(id) => toggleRowSelection(id)}
                              isSelected={selectedRows.has(listing.id)}
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
                  loading={false}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  onRowClick={handleRowClick}
                  selectedRows={selectedRows}
                  onToggleSelect={toggleRowSelection}
                  fromPath={resultsFromPath}
                />
              )}
            </section>
          </div>
        </main>
      </div>
    </>
  );
}

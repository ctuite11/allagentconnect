import { useCallback, useMemo, useState, type ReactNode, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AacBackButton } from "@/components/layout/AacBackLink";
import { AacPageIntro } from "@/components/layout/AacPageIntro";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import PropertyMap from "@/components/PropertyMap";
import ListingCard from "@/components/ListingCard";
import ListingResultsTable from "@/components/listing-search/ListingResultsTable";
import { AgentSplitResultsSelectionActions } from "@/components/listing-search/AgentSplitResultsSelectionActions";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";
import SaveToHotSheetDialog from "@/components/SaveToHotSheetDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListChecks, Check, FileSpreadsheet } from "lucide-react";
import { Seo } from "@/components/Seo";
import {
  listingRowForAgentSplitMapCompact,
  sortAgentSplitListings,
  type AgentSplitListing,
} from "@/lib/agentSplitResults";
import {
  agentWorkspaceMapPanel,
  agentWorkspaceMapResultsGrid,
  agentWorkspacePageContainer,
  agentWorkspaceResultsPanel,
} from "@/lib/agentWorkspaceLayout";
import {
  agentSplitListingAgentContact,
  listingEmailSubjectFromRow,
} from "@/lib/listingAgentContact";

export type AgentSplitResultsListingRenderHelpers = {
  isSelected: boolean;
  onSelect?: (id: string) => void;
  resultsFromPath: string;
};

export type AgentSplitResultsSurfaceProps = {
  listings: AgentSplitListing[];
  loading: boolean;
  loadError: string | null;
  emptyMessage: string;
  title: string;
  subtitle?: ReactNode;
  titleClassName?: string;
  onBack: () => void;
  resultsFromPath: string;
  showSaveToHotSheet?: boolean;
  saveToHotSheetCriteria?: Record<string, unknown>;
  loadingMessage?: string;
  toolbarAriaLabel?: string;
  seo?: { title: string; description: string };
  /** `embedded` omits full-page chrome (e.g. Hot Sheet Review header lives outside). */
  variant?: "page" | "embedded";
  /** Parent renders page intro; surface shows results toolbar strips only. */
  hidePageIntro?: boolean;
  selectionEnabled?: boolean;
  selectedRows?: Set<string>;
  onSelectedRowsChange?: (next: Set<string>) => void;
  /** Overrides default select-all (e.g. restore full listing set on deselect). */
  onSelectAll?: () => void;
  /** Overrides filter-only keep-selected (e.g. prune hot sheet listing set). */
  onKeepSelected?: () => void;
  toolbarActionsExtra?: ReactNode;
  beforeResults?: ReactNode;
  emptyState?: ReactNode;
  renderListingCard?: (
    listing: AgentSplitListing,
    helpers: AgentSplitResultsListingRenderHelpers,
  ) => ReactElement;
  containerClassName?: string;
  /** When false, hides Map/List toggle and keeps map + card grid only. */
  allowListView?: boolean;
  /** Agent-only: email listing agent from result cards (internal queue). */
  showAgentEmailContact?: boolean;
};

/**
 * Shared AAC agent results shell: map/list split, toolbar, selection, sort, share, optional hot sheet save.
 * Used by buyer favorites, new matches, and listing search results.
 */
export function AgentSplitResultsSurface({
  listings,
  loading,
  loadError,
  emptyMessage,
  title,
  subtitle,
  titleClassName = "text-base sm:text-lg",
  onBack,
  resultsFromPath,
  showSaveToHotSheet = true,
  saveToHotSheetCriteria,
  loadingMessage = "Loading results…",
  toolbarAriaLabel = "Agent listing results",
  seo,
  variant = "page",
  hidePageIntro = false,
  selectionEnabled = true,
  selectedRows: selectedRowsProp,
  onSelectedRowsChange,
  onSelectAll,
  onKeepSelected,
  toolbarActionsExtra,
  beforeResults,
  emptyState,
  renderListingCard,
  containerClassName,
  allowListView = true,
  showAgentEmailContact = false,
}: AgentSplitResultsSurfaceProps) {
  const navigate = useNavigate();
  const [sortColumn, setSortColumn] = useState(LISTING_DEFAULT_SORT_COLUMN);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<string>>(new Set());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [resultsView, setResultsView] = useState<"map" | "list">("map");

  const effectiveResultsView = allowListView ? resultsView : "map";
  const [hotSheetDialogOpen, setHotSheetDialogOpen] = useState(false);

  const selectedRows = selectedRowsProp ?? internalSelectedRows;
  const setSelectedRows = onSelectedRowsChange ?? setInternalSelectedRows;
  const safeSelectedRows = selectedRows instanceof Set ? selectedRows : new Set<string>();

  const sortedListings = useMemo(
    () => sortAgentSplitListings(listings, sortColumn, sortDirection),
    [listings, sortColumn, sortDirection],
  );

  const displayedListings = showSelectedOnly
    ? sortedListings.filter((l) => safeSelectedRows.has(l.id))
    : sortedListings;

  const displayedListingIds = useMemo(
    () => displayedListings.map((l) => l.id),
    [displayedListings],
  );

  const applySelectedRows = useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      setSelectedRows(updater(safeSelectedRows));
    },
    [safeSelectedRows, setSelectedRows],
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

  const handleAddAllVisible = useCallback(() => {
    if (onSelectAll) {
      if (safeSelectedRows.size === 0) {
        onSelectAll();
      } else if (safeSelectedRows.size < displayedListings.length) {
        setSelectedRows(new Set(displayedListings.map((l) => l.id)));
      }
      return;
    }
    addAllVisible();
  }, [onSelectAll, safeSelectedRows.size, displayedListings, addAllVisible, setSelectedRows]);

  const handleUnselectAllVisible = useCallback(() => {
    if (
      onSelectAll &&
      safeSelectedRows.size === displayedListings.length &&
      displayedListings.length > 0
    ) {
      onSelectAll();
      return;
    }
    unselectAllVisible();
  }, [onSelectAll, safeSelectedRows.size, displayedListings.length, unselectAllVisible]);

  const showMapSplit =
    effectiveResultsView === "map" && !loading && !loadError && displayedListings.length > 0;

  const toggleRowSelection = (id: string, e?: React.SyntheticEvent) => {
    if (!selectionEnabled) return;
    e?.stopPropagation?.();
    const next = new Set(safeSelectedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRows(next);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const handleRowClick = (listing: AgentSplitListing) => {
    navigate(`/property/${listing.id}`, {
      state: { from: resultsFromPath },
    });
  };

  const sortSelectValue =
    ({
      created_at_desc: "date_new",
      created_at_asc: "date_old",
      list_date_desc: "date_new",
      list_date_asc: "date_old",
      price_desc: "price_high",
      price_asc: "price_low",
    } as Record<string, string>)[`${sortColumn}_${sortDirection}`] ?? "date_new";

  const handleSortSelect = (value: string) => {
    const colDir: Record<string, [string, "asc" | "desc"]> = {
      date_new: [LISTING_DEFAULT_SORT_COLUMN, "desc"],
      date_old: [LISTING_DEFAULT_SORT_COLUMN, "asc"],
      price_high: ["price", "desc"],
      price_low: ["price", "asc"],
    };
    const [col, dir] = colDir[value] ?? [LISTING_DEFAULT_SORT_COLUMN, "desc"];
    setSortColumn(col);
    setSortDirection(dir);
  };

  const hasResultsActionsRow =
    selectionEnabled || Boolean(toolbarActionsExtra) || showSaveToHotSheet;

  const renderViewResultsControls = (compact: boolean) => {
    const labelClass = compact ? "text-[11px] font-medium text-neutral-500" : "text-[13px] text-neutral-500";
    const toggleBtnClass = compact
      ? "h-[22px] min-w-[2.25rem] rounded-[4px] px-1.5 text-[11px] font-medium whitespace-nowrap leading-none transition-colors duration-200 ease-out"
      : "h-7 min-w-[2.5rem] rounded-md px-2.5 text-[13px] font-medium leading-none transition-colors duration-200 ease-out";
    const toggleWrapClass = compact
      ? "inline-flex rounded-md border border-neutral-200 bg-white p-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      : "inline-flex rounded-lg border border-neutral-200 bg-white p-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]";
    const countClass = cn(
      "shrink-0 font-medium text-neutral-900 tabular-nums whitespace-nowrap",
      compact ? "text-sm" : "text-[13px]",
    );
    const showViewToggle =
      allowListView && !loading && !loadError && displayedListings.length > 0;
    const resultsLabel = loading ? "Results: —" : `Results: ${displayedListings.length.toLocaleString()}`;

    return (
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        <p className={countClass}>{resultsLabel}</p>
        {showViewToggle ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={cn(labelClass, "whitespace-nowrap")}>View</span>
            <div className={toggleWrapClass}>
              <button
                type="button"
                onClick={() => setResultsView("map")}
                className={cn(
                  toggleBtnClass,
                  effectiveResultsView === "map"
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
                  effectiveResultsView === "list"
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
    );
  };

  const renderSortControl = (compact: boolean) => (
    <div className={cn("min-w-0 shrink-0", compact ? "max-w-[7.5rem]" : "max-w-[8.5rem] min-[520px]:max-w-[11rem]")}>
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
  );

  const renderResultsActionsContent = () => {
    const saveHotSheetBtn =
      showSaveToHotSheet ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-md border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50"
          onClick={() => {
            if (selectedRows.size === 0) {
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
      ) : null;

    if (selectionEnabled) {
      return (
        <AgentSplitResultsSelectionActions
          displayedListingIds={displayedListingIds}
          selectedRows={safeSelectedRows}
          showSelectedOnly={showSelectedOnly && !onKeepSelected}
          onAddAllVisible={handleAddAllVisible}
          onUnselectAllVisible={handleUnselectAllVisible}
          onKeepSelectedOnly={() => setShowSelectedOnly(true)}
          onShowAll={() => setShowSelectedOnly(false)}
          onKeepSelectedCustom={onKeepSelected}
          onSuccessfulShare={clearShareSelection}
        >
          {toolbarActionsExtra}
          {saveHotSheetBtn}
        </AgentSplitResultsSelectionActions>
      );
    }

    return (
      <>
        {toolbarActionsExtra}
        {saveHotSheetBtn}
      </>
    );
  };

  /** Page-level row: View + results count + map/list (above workspace divider). */
  const renderResultsSummaryToolbar = (compact: boolean) => (
    <div className="flex justify-end" aria-label="Results summary and controls">
      {renderViewResultsControls(compact)}
    </div>
  );

  /** Card-level row: selection actions left, sort right. */
  const renderResultsSelectionToolbar = (compact: boolean) => (
    <div
      className="flex items-center justify-between gap-x-2 gap-y-1"
      aria-label="Result actions"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {hasResultsActionsRow ? renderResultsActionsContent() : null}
      </div>
      {renderSortControl(compact)}
    </div>
  );

  const renderToolbarStrips = () => (
    <>
      <div className="border-t border-neutral-100 pt-1.5 pb-1">{renderResultsSummaryToolbar(false)}</div>
      <div className="border-t border-neutral-100 pb-1 pt-1.5">{renderResultsSelectionToolbar(false)}</div>
    </>
  );

  const renderToolbar = () => {
    if (hidePageIntro) return renderToolbarStrips();
    return (
      <>
        <AacPageIntro
          withTopPadding
          back={<AacBackButton type="button" onClick={onBack} />}
          title={title}
          subtitle={subtitle}
          titleClassName={titleClassName}
        />
        {renderToolbarStrips()}
      </>
    );
  };

  const renderListingNode = (listing: AgentSplitListing) => {
    const helpers: AgentSplitResultsListingRenderHelpers = {
      isSelected: safeSelectedRows.has(listing.id),
      onSelect: selectionEnabled ? toggleRowSelection : undefined,
      resultsFromPath,
    };
    if (renderListingCard) {
      return renderListingCard(listing, helpers);
    }
    const listingAgentContact = showAgentEmailContact
      ? agentSplitListingAgentContact(listing)
      : null;

    return (
      <ListingCard
        listing={listingRowForAgentSplitMapCompact(listing) as unknown as React.ComponentProps<typeof ListingCard>["listing"]}
        viewMode="compact"
        showActions={false}
        agentInfo={null}
        showCompactComments={false}
        hideCompactFavorite
        isHotSheetFavorite={false}
        compactDetailNavigateState={{ from: resultsFromPath }}
        onSelect={helpers.onSelect}
        isSelected={helpers.isSelected}
        showAgentEmailContact={showAgentEmailContact}
        listingAgentContact={listingAgentContact}
        listingEmailSubject={listingEmailSubjectFromRow(listing)}
      />
    );
  };

  const resultsBody = (
    <section className="bg-transparent pb-6 pt-0">
      {beforeResults}
      {loading ? (
        <AacMonogramLoader variant="section" message={loadingMessage} className="min-h-[40vh]" />
      ) : loadError ? (
        <p className="py-16 text-center text-sm text-red-600" role="alert">
          {loadError}
        </p>
      ) : displayedListings.length === 0 ? (
        emptyState ?? (
          <p className="py-16 text-center text-sm text-neutral-500">{emptyMessage}</p>
        )
      ) : showMapSplit ? (
        <>
          {hidePageIntro && !loadError && (loading || displayedListings.length > 0) ? (
            <div className="border-b border-neutral-200 bg-white pb-2 pt-1">
              {renderResultsSummaryToolbar(false)}
            </div>
          ) : null}
          <div className={agentWorkspaceMapResultsGrid}>
          <section className={agentWorkspaceMapPanel}>
            <div className="h-full">
              <PropertyMap
                listings={displayedListings as unknown as React.ComponentProps<typeof PropertyMap>["listings"]}
                onListingClick={(listingId) =>
                  navigate(`/property/${listingId}`, {
                    state: { from: resultsFromPath },
                  })
                }
              />
            </div>
          </section>

          <section className={agentWorkspaceResultsPanel}>
            <div className="shrink-0 border-b border-neutral-200/90 bg-white px-3 py-1 sm:px-5">
              {renderResultsSelectionToolbar(true)}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto lg:min-h-0">
              <div className="px-3 py-1.5 sm:px-5 sm:py-2">
                <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
                  {displayedListings.map((listing) => (
                                        <div key={listing.id}>{renderListingNode(listing)}</div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
        </>
      ) : (
        <ListingResultsTable
          listings={displayedListings as unknown as React.ComponentProps<typeof ListingResultsTable>["listings"]}
          loading={false}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={handleRowClick as unknown as React.ComponentProps<typeof ListingResultsTable>["onRowClick"]}
          selectedRows={selectionEnabled ? safeSelectedRows : new Set()}
          onToggleSelect={selectionEnabled ? toggleRowSelection : () => {}}
          fromPath={resultsFromPath}
          showAgentEmailContact={showAgentEmailContact}
        />
      )}
    </section>
  );

  const saveDialog = showSaveToHotSheet ? (
    <SaveToHotSheetDialog
      open={hotSheetDialogOpen}
      onOpenChange={setHotSheetDialogOpen}
      currentSearch={saveToHotSheetCriteria ?? {}}
      selectedListingIds={Array.from(safeSelectedRows)}
    />
  ) : null;

  const containerClass = cn(
    containerClassName ?? agentWorkspacePageContainer,
  );

  if (variant === "embedded") {
    return (
      <>
        {saveDialog}
        {!showMapSplit && !loading && !loadError && displayedListings.length > 0 ? (
          <div
            className="sticky top-0 z-20 -mx-1 border-b border-neutral-200 bg-white px-1 sm:-mx-0 sm:px-0"
            aria-label={toolbarAriaLabel}
          >
            {renderToolbar()}
          </div>
        ) : null}
        <div className={containerClass}>{resultsBody}</div>
      </>
    );
  }

  return (
    <>
      {seo ? <Seo title={seo.title} description={seo.description} noindex /> : null}
      <div className="flex min-h-screen flex-col bg-white">
        <main className="flex-1">
          <div className={containerClass}>
            {!showMapSplit ? (
              <div
                className="sticky top-0 z-20 border-b border-neutral-200 bg-white px-3 sm:px-4 lg:px-5"
                aria-label={toolbarAriaLabel}
              >
                {renderToolbar()}
              </div>
            ) : !hidePageIntro ? (
              <div
                className="border-b border-neutral-200 bg-white px-3 sm:px-4 lg:px-5"
                aria-label={toolbarAriaLabel}
              >
                <AacPageIntro
                  withTopPadding
                  back={<AacBackButton type="button" onClick={onBack} />}
                  title={title}
                  subtitle={subtitle}
                  titleClassName={titleClassName}
                />
                {!loadError && (loading || displayedListings.length > 0) ? (
                  <div className="pb-2 pt-1">{renderResultsSummaryToolbar(false)}</div>
                ) : null}
              </div>
            ) : null}

            {saveDialog}
            {resultsBody}
          </div>
        </main>
      </div>
    </>
  );
}

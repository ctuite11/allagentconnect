import { useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";
import { cn } from "@/lib/utils";

const DEFAULT_PILL_CLASS =
  "h-7 rounded-md border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50";

const SHARE_TRIGGER_CLASS =
  "h-7 gap-0 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90 disabled:pointer-events-none disabled:opacity-40 [&_svg]:mr-1 [&_svg]:!h-3 [&_svg]:!w-3 [&_svg]:text-neutral-600";

type AgentSplitResultsSelectionActionsProps = {
  displayedListingIds: string[];
  selectedRows: Set<string>;
  showSelectedOnly: boolean;
  onAddAllVisible: () => void;
  onUnselectAllVisible: () => void;
  onKeepSelectedOnly: () => void;
  onShowAll: () => void;
  /** One-shot keep (e.g. prune hot sheet) instead of filter-only keep/show. */
  onKeepSelectedCustom?: () => void;
  onSuccessfulShare?: () => void;
  /** Extra pills (e.g. Save as Hot Sheet) rendered after share controls. */
  children?: ReactNode;
  className?: string;
  /** Override select/keep pill sizing (e.g. hot sheet review toolbar). */
  pillClassName?: string;
};

export function AgentSplitResultsSelectionActions({
  displayedListingIds,
  selectedRows,
  showSelectedOnly,
  onAddAllVisible,
  onUnselectAllVisible,
  onKeepSelectedOnly,
  onShowAll,
  onKeepSelectedCustom,
  onSuccessfulShare,
  children,
  className,
  pillClassName = DEFAULT_PILL_CLASS,
}: AgentSplitResultsSelectionActionsProps) {
  const safeSelectedRows = selectedRows instanceof Set ? selectedRows : new Set<string>();
  const PILL_CLASS = pillClassName;

  const listingIdsForShare = useMemo(
    () => displayedListingIds.filter((id) => safeSelectedRows.has(id)),
    [displayedListingIds, safeSelectedRows],
  );

  const visibleSelectionState = useMemo(() => {
    const n = displayedListingIds.length;
    if (n === 0) return { allVisible: false, someVisible: false, noneVisible: true };
    const selected = displayedListingIds.filter((id) => safeSelectedRows.has(id)).length;
    if (selected === 0) return { allVisible: false, someVisible: false, noneVisible: true };
    if (selected === n) return { allVisible: true, someVisible: false, noneVisible: false };
    return { allVisible: false, someVisible: true, noneVisible: false };
  }, [displayedListingIds, safeSelectedRows]);

  const shareDialog =
    listingIdsForShare.length > 0 ? (
      <BulkShareListingsDialog
        listingIds={listingIdsForShare}
        listingCount={listingIdsForShare.length}
        triggerVariant="outline"
        triggerClassName={SHARE_TRIGGER_CLASS}
        triggerLabel={`Share selected (${listingIdsForShare.length})`}
        onSuccessfulShare={onSuccessfulShare}
      />
    ) : null;

  const selectionPills =
    displayedListingIds.length === 0 ? null : (
      <>
      {visibleSelectionState.allVisible && (
        <>
          <Button type="button" size="sm" variant="outline" className={PILL_CLASS} onClick={onUnselectAllVisible}>
            Unselect all
          </Button>
          {shareDialog}
        </>
      )}
      {visibleSelectionState.someVisible && (
        <>
          {!showSelectedOnly && !onKeepSelectedCustom && (
            <>
              <Button type="button" size="sm" variant="outline" className={PILL_CLASS} onClick={onAddAllVisible}>
                Select all
              </Button>
              <Button type="button" size="sm" variant="outline" className={PILL_CLASS} onClick={onKeepSelectedOnly}>
                Keep selected only
              </Button>
            </>
          )}
          {!showSelectedOnly && onKeepSelectedCustom && (
            <>
              <Button type="button" size="sm" variant="outline" className={PILL_CLASS} onClick={onAddAllVisible}>
                Select all
              </Button>
              <Button type="button" size="sm" variant="outline" className={PILL_CLASS} onClick={onKeepSelectedCustom}>
                Keep selected
              </Button>
            </>
          )}
          {shareDialog}
        </>
      )}
      {visibleSelectionState.allVisible && onKeepSelectedCustom && (
        <Button type="button" size="sm" variant="outline" className={PILL_CLASS} onClick={onKeepSelectedCustom}>
          Keep selected
        </Button>
      )}
      {visibleSelectionState.noneVisible && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={PILL_CLASS}
          onClick={onAddAllVisible}
          disabled={displayedListingIds.length === 0}
        >
          Select all
        </Button>
      )}
      {showSelectedOnly && (
        <Button type="button" size="sm" variant="outline" className={PILL_CLASS} onClick={onShowAll}>
          Show all
        </Button>
      )}
      </>
    );

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {selectionPills}
      {children}
    </div>
  );
}

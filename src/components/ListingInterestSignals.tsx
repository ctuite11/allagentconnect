import { Flame, MessageSquare, Eye } from "lucide-react";

interface ListingInterestSignalsProps {
  savesCount: number;
  commentsCount: number;
  hotsheetMatchCount: number;
}

/**
 * Compact inline badges showing buyer demand signals on listing cards.
 * Only renders if there's at least one non-zero signal.
 */
export function ListingInterestSignals({
  savesCount,
  commentsCount,
  hotsheetMatchCount,
}: ListingInterestSignalsProps) {
  const total = savesCount + commentsCount + hotsheetMatchCount;
  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      {savesCount > 0 && (
        <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 font-medium">
          <Flame className="h-3.5 w-3.5" />
          {savesCount} buyer{savesCount !== 1 ? "s" : ""} saved
        </span>
      )}
      {commentsCount > 0 && (
        <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
          <MessageSquare className="h-3.5 w-3.5" />
          {commentsCount} buyer{commentsCount !== 1 ? "s" : ""} asked
        </span>
      )}
      {hotsheetMatchCount > 0 && (
        <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
          <Eye className="h-3.5 w-3.5" />
          {hotsheetMatchCount} Hot Sheet{hotsheetMatchCount !== 1 ? "s" : ""} match
        </span>
      )}
    </div>
  );
}

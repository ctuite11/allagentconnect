import { cn } from "@/lib/utils";

/**
 * AAC neutral black for listing shortlist / bulk-select (active state only).
 * Prefer a tinted border on the card + filled checkbox — avoid ring + heavy border + bright fill together.
 */
export const listingSelectionCheckboxClass = (isSelected: boolean) =>
  cn(
    "flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-[2px] border shadow-sm transition-colors",
    isSelected
      ? "border-neutral-900 bg-neutral-900"
      : "border-zinc-300 bg-white hover:border-zinc-400",
  );

/** Compact listing cards (split map grid, favorites, hot sheets). */
export const listingSelectionCardCompactSelected =
  "border-neutral-900/25 shadow-[0_1px_3px_rgba(0,0,0,0.06)]";

/** Grid / full-width listing cards. */
export const listingSelectionCardGridSelected =
  "border-neutral-900/25 shadow-[0_1px_3px_rgba(0,0,0,0.06)]";

/** MLS-style SearchListingCard (list + mobile stack). */
export const listingSelectionSearchCardSelected =
  "border-neutral-900/28 shadow-[0_1px_3px_rgba(0,0,0,0.06)]";

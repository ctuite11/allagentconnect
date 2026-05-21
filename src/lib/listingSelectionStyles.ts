import { cn } from "@/lib/utils";

/**
 * Softer AAC emerald for listing shortlist / bulk-select (active state only).
 * Prefer a tinted border on the card + filled checkbox — avoid ring + heavy border + bright fill together.
 */
export const listingSelectionCheckboxClass = (isSelected: boolean) =>
  cn(
    "flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-[2px] border shadow-sm transition-colors",
    isSelected
      ? "border-emerald-700/65 bg-emerald-600/80"
      : "border-zinc-300 bg-white hover:border-zinc-400",
  );

/** Compact listing cards (split map grid, favorites, hot sheets). */
export const listingSelectionCardCompactSelected =
  "border-emerald-600/30 shadow-[0_1px_3px_rgba(5,150,105,0.05)]";

/** Grid / full-width listing cards. */
export const listingSelectionCardGridSelected =
  "border-emerald-600/30 shadow-[0_1px_3px_rgba(5,150,105,0.05)]";

/** MLS-style SearchListingCard (list + mobile stack). */
export const listingSelectionSearchCardSelected =
  "border-emerald-600/32 shadow-[0_1px_3px_rgba(5,150,105,0.05)]";

/**
 * Buyer UI tokens — single source of truth aligned with `ClientDashboard.tsx`.
 * Import these for Hot Sheets, Favorites, Search, Success Hub buyer cards, Messages, etc.
 * Rules: white canvas, neutral-200 borders, `shadow-sm`, no `bg-card` / `bg-muted` on buyer tiles.
 */

/** Full-page canvas under the buyer header */
export const buyerPageShell = "min-h-screen bg-white";

/** Primary content column — matches dashboard main */
export const buyerPageMain =
  "mx-auto w-full max-w-7xl px-6 py-8 pb-12 md:px-8";

export const buyerPageStack = "space-y-8";

/** Section / hero shell (dashboard “card” sections) */
export const buyerSectionCard =
  "bg-white rounded-2xl border border-neutral-200 shadow-sm transition-colors duration-150";

/**
 * Base preview tile — shared hover/interaction for Hot Sheet previews (buyerDashboardHotFavTile),
 * Dashboard “Market activity” listing tiles (`buyerPreviewCardInteractive`), etc.
 *
 * Listing grids (client Favorites, Map search rows) intentionally use bespoke cards + `ListingImage`;
 * only Hot Sheet *collages* use `BuyerHotSheetPreviewCard` — do not interchange.
 */
export const buyerPreviewCardBase =
  "relative w-full cursor-pointer overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-neutral-300 hover:shadow-md";

/** Interactive preview (keyboard focus ring) — cursor on base tile; rings here only */
export const buyerPreviewCardInteractive = `${buyerPreviewCardBase} outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2`;

/** Alias — same as `buyerPreviewCardInteractive` (Dashboard listing / saved-search tiles). */
export const buyerPreviewCard = buyerPreviewCardInteractive;

/** Dashboard Hot Sheets + Favorites strip (fixed height) */
export const buyerDashboardHotFavTile = `${buyerPreviewCardInteractive} flex h-60 flex-col`;

export const buyerDashboardHotSheetMediaWrap =
  "relative h-40 w-full shrink-0 overflow-hidden rounded-t-2xl bg-white";

export const buyerDashboardHotFavTileBody =
  "flex h-20 flex-col gap-0.5 bg-white px-3 pb-2 pt-3 text-left";

/** 3-cell collage on dashboard hot-sheet preview (left tall + right stack) */
export const buyerDashboardHotSheetCollageGrid =
  "grid h-full w-full grid-cols-[3fr_2fr] grid-rows-2 gap-[2px] bg-white [grid-template-rows:repeat(2,minmax(0,1fr))]";

/** Market activity / search result–style listing preview on dashboard */
export const buyerMarketListingTileMediaWrap =
  "relative h-48 w-full shrink-0 overflow-hidden rounded-t-2xl bg-white";

/** Matches `ListingCard` compact `CardContent` padding and rhythm. */
export const buyerMarketListingTileBody =
  "flex flex-col gap-1.5 px-4 pb-3 pt-3 text-left";

/** Stat tiles on dashboard */
export const buyerStatCardInteractive = `${buyerSectionCard} cursor-pointer transition-[border-color,box-shadow] duration-150 hover:border-neutral-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2`;

/** Agent success-hub / collection card (image + body, subtle hover) */
export const buyerCollectionCardRoot = `${buyerSectionCard} cursor-pointer overflow-hidden transition-[border-color,box-shadow] duration-150 hover:border-neutral-300 hover:shadow-md focus-within:border-neutral-300 focus-within:shadow-md`;

/** Typography */
export const buyerSectionTitle = "text-[15px] font-semibold text-neutral-950";

export const buyerSectionDesc = "text-[13px] leading-snug text-neutral-500";

export const buyerTileTitle =
  "text-[15px] font-semibold leading-snug tracking-tight text-neutral-900";

export const buyerTileSecondary = "text-[13px] leading-snug text-neutral-500";

export const buyerTileAddress =
  "truncate text-[13px] leading-snug text-neutral-800";

/** Buttons */
export const buyerPrimaryCta =
  "rounded-full bg-[#0E56F5] text-white shadow-sm transition-all duration-150 hover:bg-[#0B46CC]";

export const buyerOutlineSecondary =
  "rounded-full border border-neutral-200 bg-white text-[13px] font-medium text-neutral-800 shadow-sm transition-all duration-150 hover:bg-neutral-50";

export const buyerAacPrimarySectionCta =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-medium shadow-none";

/** Inside dashboard section cards (Hot Sheets / Favorites / Market headers) */
export const buyerPreviewSectionHeader =
  "border-0 p-5 pb-4 md:p-6 md:pb-5";

export const buyerPreviewSectionContent =
  "px-5 pb-6 pt-0 md:px-6";

export const buyerPreviewSectionMarketContent =
  "overflow-visible px-5 pb-6 pt-0 md:px-6";

export const buyerPreviewGrid = "grid grid-cols-3 gap-4";

/** Buyer dashboard Hot Sheets strip — 1–2 wider preview tiles */
export const buyerDashboardHotSheetsPreviewGrid = "grid grid-cols-1 gap-4 sm:grid-cols-2";

export const buyerPreviewSectionHeaderRow =
  "flex items-baseline justify-between gap-2";

/** Hot Sheets / Favorites / Market activity — inline secondary links in section headers. */
export const buyerDashboardPreviewViewAllCta =
  "shrink-0 rounded-sm text-[13px] font-medium leading-normal tracking-normal text-neutral-700 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2";

export const buyerPreviewSectionTitleWrap = "min-w-0 space-y-1";

/** 2×2 listing photo mosaic — thin white gutters between cells */
export const buyerImageMosaicGrid =
  "aspect-[4/3] grid grid-cols-2 grid-rows-2 gap-[2px] bg-white shrink-0";

export const buyerImageMosaicCell =
  "relative h-full w-full min-h-0 overflow-hidden bg-white";

export const buyerImageMosaicEmpty =
  "flex h-full w-full items-center justify-center bg-white";

/** Messages — list + conversation panels */
export const buyerMessagingPanel =
  "bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col";

/** Conversation / inbox list row — white tile, subtle desktop hover */
export const buyerMessagingThreadRow =
  "rounded-xl border border-transparent bg-white transition-[border-color,box-shadow] duration-150 hover:border-neutral-300 hover:shadow-md";

/** Favorites split view (map + list panes) */
export const buyerFavoritesSplitPane =
  "rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden";

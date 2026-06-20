/**
 * Shared visual tokens for the Property Detail pages
 * (PropertyDetail.tsx — AAC, ConsumerPropertyDetail.tsx — DCMLS).
 *
 * Goal: one visual language across both pages.
 * Behavior/business logic stays in each page.
 *
 * If you change a token here, BOTH pages will update.
 */

// Page shell
export const propertyPageContainer = "mx-auto max-w-6xl px-4";

/** Agent workspace property detail — full AppShell column width (no max-w cap). */
export const propertyPageContainerAgentWorkspace = "mx-auto w-full min-w-0 max-w-none px-4 lg:px-6";
export const propertyPagePadTop = "pt-5";
export const propertyHeroGap = "gap-6";

// Two-column hero proportions
export const propertyMediaCol = "lg:w-[68%]";
export const propertyRailCol = "lg:w-[32%]";

// Right rail (sticky behavior + spacing rhythm)
export const propertyRailSticky = "lg:sticky lg:top-24 lg:self-start";
export const propertyRailStack = "space-y-6";

/** Agent card + Schedule Showing — unified action area (~12px between) */
export const propertyDetailRailActionGroup = "space-y-3";

/** Right-rail agent card interior rhythm */
export const propertyDetailAgentCardContent = "space-y-2 px-6 pt-5 pb-2";
export const propertyDetailAgentAvatar =
  "h-20 w-20 border-2 border-neutral-200";
export const propertyDetailAgentEyebrow =
  "text-[8px] font-normal uppercase tracking-[0.1em] text-neutral-400";
export const propertyDetailAgentTitleBlock = "space-y-0.5";
export const propertyDetailAgentContactRows = "space-y-1.5 text-sm";

/** Primary rail CTA — Message Agent (restrained, not app-like) */
export const propertyDetailMessageCtaBase =
  "h-11 w-full gap-1.5 rounded-[10px] px-4 text-[15px] font-semibold shadow-none [&_svg]:size-3.5";
export const propertyDetailMessageCta =
  "bg-neutral-900 text-white hover:bg-neutral-800 focus-visible:ring-neutral-400/30";

/** Secondary rail CTA — Schedule Showing (same footprint, lighter fill) */
export const propertyDetailScheduleCtaBase = propertyDetailMessageCtaBase;
export const propertyDetailScheduleCta =
  "border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50 shadow-none";

/** @deprecated Use propertyDetailMessageCtaBase */
export const propertyDetailPairedCtaBase = propertyDetailMessageCtaBase;

// Card surfaces
export const propertyHeroMedia =
  "relative rounded-[20px] overflow-hidden shadow-2xl ring-1 ring-black/5 h-[380px] sm:h-[480px] lg:h-[560px]";
export const propertyAgentCard = "rounded-3xl shadow-md border-2";
export const propertyStripCard = "rounded-2xl shadow-sm border";
export const propertySectionCard = "rounded-3xl";

// Typography
export const propertyAddressH1 =
  "flex items-baseline gap-1.5 text-lg font-semibold text-foreground tracking-tight";
export const propertyPriceText = "text-lg font-bold text-foreground";
export const propertyEyebrow =
  "text-[10px] uppercase tracking-wide text-muted-foreground";

// Facts row
export const propertyFactsRow =
  "flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 pb-2 border-b";
export const propertyFactItem = "flex items-center gap-1";
export const propertyFactValue = "font-semibold text-foreground";
export const propertyFactLabel = "text-xs text-muted-foreground";
export const propertyFactIcon = "h-4 w-4 text-primary";

// Media tab bar
export const propertyMediaTabsRow = "flex items-center gap-2 mt-0 flex-wrap";

// Header row (address + price above hero, constrained to media column)
export const propertyHeaderRow =
  "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1";

// Section spacing rhythm below hero
export const propertyMainGridGap = "gap-5";
export const propertyMainSectionStack = "space-y-5";

/** Matched rail CTAs — see propertyDetailMessageCtaBase / propertyDetailScheduleCtaBase */

export const propertyTokens = {
  propertyPageContainer,
  propertyPagePadTop,
  propertyHeroGap,
  propertyMediaCol,
  propertyRailCol,
  propertyRailSticky,
  propertyRailStack,
  propertyDetailRailActionGroup,
  propertyDetailAgentCardContent,
  propertyDetailAgentAvatar,
  propertyDetailAgentEyebrow,
  propertyDetailAgentTitleBlock,
  propertyDetailAgentContactRows,
  propertyHeroMedia,
  propertyAgentCard,
  propertyStripCard,
  propertySectionCard,
  propertyAddressH1,
  propertyPriceText,
  propertyEyebrow,
  propertyFactsRow,
  propertyFactItem,
  propertyFactValue,
  propertyFactLabel,
  propertyFactIcon,
  propertyMediaTabsRow,
  propertyHeaderRow,
  propertyMainGridGap,
  propertyMainSectionStack,
  propertyDetailMessageCtaBase,
  propertyDetailMessageCta,
  propertyDetailScheduleCtaBase,
  propertyDetailScheduleCta,
  propertyDetailPairedCtaBase,
} as const;

export default propertyTokens;

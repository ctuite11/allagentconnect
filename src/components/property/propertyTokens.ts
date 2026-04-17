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
export const propertyPagePadTop = "pt-5";
export const propertyHeroGap = "gap-6";

// Two-column hero proportions
export const propertyMediaCol = "lg:w-[68%]";
export const propertyRailCol = "lg:w-[32%]";

// Right rail (sticky behavior + spacing rhythm)
export const propertyRailSticky = "lg:sticky lg:top-24 lg:self-start";
export const propertyRailStack = "space-y-3";

// Card surfaces
export const propertyHeroMedia =
  "relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/5 h-[380px] sm:h-[480px] lg:h-[560px]";
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
export const propertyMediaTabsRow = "flex items-center gap-2 mt-6 flex-wrap";

// Header row (address + price above hero, constrained to media column)
export const propertyHeaderRow =
  "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1";

// Section spacing rhythm below hero
export const propertyMainGridGap = "gap-4";
export const propertyMainSectionStack = "space-y-4";

export const propertyTokens = {
  propertyPageContainer,
  propertyPagePadTop,
  propertyHeroGap,
  propertyMediaCol,
  propertyRailCol,
  propertyRailSticky,
  propertyRailStack,
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
} as const;

export default propertyTokens;

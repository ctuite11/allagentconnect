/**
 * AAC Design System - Locked Style Tokens (Premium Zinc)
 * 
 * These tokens define the ACC standard visual spec.
 * All pages should import and use these tokens to prevent visual drift.
 * DO NOT modify these values without design review.
 * 
 * IMPORTANT: Uses ZINC palette (not slate) to eliminate muted blue cast.
 * Blue is allowed ONLY in HeaderBackgroundSelector (user themes).
 */

// Page Container
export const pageContainer = "max-w-7xl mx-auto px-6 py-10 space-y-8";

// Typography
export const pageH1 = "text-3xl font-semibold text-zinc-900";
export const pageSubhead = "text-zinc-500 mt-1";
export const sectionH2 = "text-xl font-semibold text-zinc-900";
export const sectionHelper = "text-sm text-zinc-500 mt-1";

// Settings-style typography (reduced scale for preference panels)
export const settingsSectionTitle = "text-lg font-semibold text-zinc-900";
export const settingsItemTitle = "text-base font-medium text-zinc-900";
export const settingsHelper = "text-sm text-zinc-500";
export const settingsEmpty = "text-sm text-zinc-400";

// Cards
export const card = "bg-white border border-zinc-200 rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all";
export const settingsCard = "bg-white border border-zinc-200 rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all";
export const cardTitle = "text-zinc-900 font-semibold";
export const cardDesc = "text-zinc-500 text-sm";

// Icons
export const iconGreen = "h-6 w-6 text-emerald-600";
export const iconGreenSmall = "h-5 w-5 text-emerald-600";

// Buttons
export const neutralButton = "border border-zinc-300 rounded-full px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors";
export const primaryButton = "bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-5 py-2.5 font-medium transition-colors";
export const ghostButton = "text-sm text-zinc-500 hover:text-zinc-900 transition-colors";

// Toggle/Switch (neutral zinc, no blue, not black)
// OFF: bg-zinc-200, ON: bg-zinc-400 (quiet signal, let status label do the work)
// Use default Switch component (now neutral) for all toggles
export const toggleTrackOff = "bg-zinc-200";
export const toggleTrackOn = "bg-zinc-400";
export const toggleThumb = "bg-white";
export const focusRing = "focus:ring-zinc-300 focus:ring-offset-2";

// Status indicators (dot + label)
export const statusDotActive = "h-2 w-2 rounded-full bg-emerald-500";
export const statusDotMuted = "h-2 w-2 rounded-full bg-zinc-300";
export const statusLabelActiveText = "text-zinc-700 text-xs";
export const statusLabelMutedText = "text-zinc-500 text-xs";

// Status Labels (legacy - use dot + label pattern above)
export const statusLabelActive = "text-zinc-700 text-xs";
export const statusLabelMuted = "text-zinc-500 text-xs";

// Semantic badges (NO BLUE - amber for pending)
export const badgePending = "bg-amber-100 text-amber-800";
export const badgeActive = "bg-emerald-100 text-emerald-800";

// Sticky Footer (inside container, not fixed)
export const stickyFooter = "sticky bottom-0 bg-white border-t border-zinc-200 z-40";
export const stickyFooterInner = "px-6 py-4 flex items-center justify-between";
export const unsavedText = "text-zinc-500 text-sm";

// Compose class strings for common patterns
export const aacStyles = {
  // Page layout
  pageContainer,
  pageH1,
  pageSubhead,
  sectionH2,
  sectionHelper,
  
  // Settings typography
  settingsSectionTitle,
  settingsItemTitle,
  settingsHelper,
  settingsEmpty,
  
  // Cards
  card,
  settingsCard,
  cardTitle,
  cardDesc,
  
  // Icons
  iconGreen,
  iconGreenSmall,
  
  // Buttons
  neutralButton,
  primaryButton,
  ghostButton,
  
  // Toggle
  toggleTrackOff,
  toggleTrackOn,
  toggleThumb,
  focusRing,
  
  // Status indicators
  statusDotActive,
  statusDotMuted,
  statusLabelActiveText,
  statusLabelMutedText,
  
  // Status (legacy)
  statusLabelActive,
  statusLabelMuted,
  
  // Badges
  badgePending,
  badgeActive,
  
  // Footer
  stickyFooter,
  stickyFooterInner,
  unsavedText,
} as const;

export default aacStyles;

/**
 * AAC Design System - Locked Style Tokens
 * 
 * These tokens define the ACC standard visual spec.
 * All pages should import and use these tokens to prevent visual drift.
 * DO NOT modify these values without design review.
 */

// Page Container
export const pageContainer = "max-w-7xl mx-auto px-6 py-10 space-y-8";

// Typography
export const pageH1 = "text-3xl font-semibold text-slate-900";
export const pageSubhead = "text-slate-500 mt-1";
export const sectionH2 = "text-xl font-semibold text-slate-900";
export const sectionHelper = "text-sm text-slate-500 mt-1";

// Cards
export const card = "bg-white border border-slate-200 rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all";
export const cardTitle = "text-slate-900 font-semibold";
export const cardDesc = "text-slate-500 text-sm";

// Icons
export const iconGreen = "h-5 w-5 text-emerald-600";

// Buttons
export const neutralButton = "border border-slate-300 rounded-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors";
export const primaryButton = "bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-5 py-2.5 font-medium transition-colors";
export const ghostButton = "text-sm text-slate-500 hover:text-slate-900 transition-colors";

// Toggle/Switch (neutral, no blue)
export const toggleTrackOff = "bg-slate-200";
export const toggleTrackOn = "bg-slate-900";
export const toggleThumb = "bg-white";

// Status Labels
export const statusLabelActive = "text-slate-700 text-xs";
export const statusLabelMuted = "text-slate-500 text-xs";

// Sticky Footer
export const stickyFooter = "fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50";
export const stickyFooterInner = "max-w-7xl mx-auto px-6 py-4 flex items-center justify-between";
export const unsavedText = "text-slate-500 text-sm";

// Compose class strings for common patterns
export const aacStyles = {
  // Page layout
  pageContainer,
  pageH1,
  pageSubhead,
  sectionH2,
  sectionHelper,
  
  // Cards
  card,
  cardTitle,
  cardDesc,
  
  // Icons
  iconGreen,
  
  // Buttons
  neutralButton,
  primaryButton,
  ghostButton,
  
  // Toggle
  toggleTrackOff,
  toggleTrackOn,
  toggleThumb,
  
  // Status
  statusLabelActive,
  statusLabelMuted,
  
  // Footer
  stickyFooter,
  stickyFooterInner,
  unsavedText,
} as const;

export default aacStyles;

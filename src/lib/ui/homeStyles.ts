// Home Style Kit — Locked design tokens from Home.tsx
// Use these constants when updating individual pages to match the homepage design.
// DO NOT apply globally. Apply page-by-page only.
// Reuse `cn` from "@/lib/utils" for class merging.

export const homeStyles = {
  // ============ BACKGROUNDS ============
  pageBg: "bg-[#FAFAF8]",           // Warm off-white
  cardBg: "bg-white",
  iconContainerBg: "bg-[#F7F6F3]",  // Soft warm gray

  // ============ CONTAINERS ============
  pageWrap: "min-h-screen bg-[#FAFAF8] text-slate-900",
  sectionWrap: "mx-auto max-w-6xl px-5",
  
  // ============ CARDS ============
  cardBase: "rounded-3xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.08)]",
  cardLight: "rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(0,0,0,0.06)]",
  cardHover: "hover:shadow-[0_10px_26px_rgba(0,0,0,0.08)] transition",
  cardPadding: "p-6",
  cardPaddingLg: "p-7 sm:p-9",

  // ============ ICON CONTAINERS ============
  iconBox: "h-10 w-10 rounded-2xl border border-slate-200 bg-[#F7F6F3] flex items-center justify-center",
  iconBoxSm: "h-8 w-8 rounded-xl border border-slate-200 bg-[#F7F6F3] flex items-center justify-center",

  // ============ BUTTONS ============
  // Primary (dark)
  btnPrimary: "inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(0,0,0,0.12)] hover:shadow-[0_14px_34px_rgba(0,0,0,0.16)] transition",
  btnPrimarySm: "inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(0,0,0,0.10)] hover:shadow-[0_10px_26px_rgba(0,0,0,0.14)] transition",
  
  // Secondary (white/outline)
  btnSecondary: "inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)] transition",
  btnSecondarySm: "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-white/60 transition",

  // ============ TYPOGRAPHY ============
  // Headings
  h1: "font-display text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900",
  h2: "text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900",
  h3: "text-xl font-semibold tracking-tight text-slate-900",
  
  // Subheadings & taglines
  tagline: "text-lg sm:text-xl font-semibold tracking-tight text-slate-800",
  label: "text-xs text-slate-500",
  
  // Body text
  textBody: "text-slate-600",
  textBodySm: "text-sm text-slate-600",
  textMuted: "text-slate-500",

  // ============ ACCENT COLOR ============
  accent: "text-emerald-600",
  accentDot: "text-emerald-500",

  // ============ BORDERS ============
  border: "border-slate-200",
  borderLight: "border-slate-200/70",

  // ============ SHADOWS ============
  shadowCard: "shadow-[0_10px_30px_rgba(0,0,0,0.08)]",
  shadowCardHover: "shadow-[0_10px_26px_rgba(0,0,0,0.08)]",
  shadowBtn: "shadow-[0_10px_26px_rgba(0,0,0,0.12)]",
  shadowBtnHover: "shadow-[0_14px_34px_rgba(0,0,0,0.16)]",
  shadowImage: "shadow-[0_18px_50px_rgba(0,0,0,0.10)]",
} as const;

// Accent color constant for icon coloring
export const HOME_ACCENT = "text-emerald-600";

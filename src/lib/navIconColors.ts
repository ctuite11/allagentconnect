/**
 * Semantic icon colors for primary navigation (AAC + buyer portal).
 * Hot Sheets is always red (`text-red-600`) per product spec.
 */

/** Agent dark sidebar (`DashboardSidebar`) — tuned for dark zinc rail. */
const agentDarkSidebarPalette: Record<string, { idle: string; active: string }> = {
  "Success Hub": { idle: "text-sky-400", active: "text-sky-300" },
  Search: { idle: "text-violet-400", active: "text-violet-300" },
  Comms: { idle: "text-fuchsia-400", active: "text-fuchsia-300" },
  Messages: { idle: "text-blue-400", active: "text-blue-300" },
  Buyers: { idle: "text-indigo-400", active: "text-indigo-300" },
  "Agent Network": { idle: "text-purple-400", active: "text-purple-300" },
  Contacts: { idle: "text-teal-400", active: "text-teal-300" },
  Listings: { idle: "text-emerald-400", active: "text-emerald-300" },
  /** Hot Sheets: pure red on dark rail (never orange/amber). */
  "Hot Sheets": { idle: "text-red-500", active: "text-red-300" },
  Profile: { idle: "text-slate-400", active: "text-slate-300" },
};

export function agentDarkSidebarNavIconClass(label: string, isActive: boolean): string {
  const p = agentDarkSidebarPalette[label];
  if (!p) return isActive ? "text-[#0E56F5]" : "text-zinc-400";
  return isActive ? p.active : p.idle;
}

/** Buyer top nav (`BuyerShell`, `BuyerPortalHeader`) — light surface. */
const buyerNavPathPalette: Record<string, { idle: string; active: string }> = {
  "/client/search": { idle: "text-violet-600", active: "text-violet-700" },
  "/client/dashboard": { idle: "text-slate-600", active: "text-slate-800" },
  "/favorites": { idle: "text-rose-600", active: "text-rose-700" },
  "/hot-sheets": { idle: "text-red-600", active: "text-red-700" },
  "/messages": { idle: "text-blue-600", active: "text-blue-700" },
  "/client/account": { idle: "text-neutral-600", active: "text-neutral-800" },
};

export function buyerPortalNavIconClass(navPath: string, isActive: boolean): string {
  const p = buyerNavPathPalette[navPath];
  if (!p) return isActive ? "text-[#0E56F5]" : "text-zinc-500";
  return isActive ? p.active : p.idle;
}

/** shadcn `SidebarNavigation` (light) — per row title. */
const shadcnAgentSidebarTitlePalette: Record<string, string> = {
  "Success Hub": "text-sky-600",
  "My Listings": "text-emerald-600",
  Drafts: "text-slate-600",
  "Listing Search": "text-violet-600",
  "Add For Sale": "text-emerald-700",
  "Add Rental": "text-teal-600",
  "My Contacts": "text-indigo-600",
  "Hot Sheets": "text-red-600",
  "Showing Requests": "text-amber-600",
  Favorites: "text-rose-600",
  "Market Insights": "text-cyan-600",
  "Find an Agent": "text-purple-600",
  Referrals: "text-purple-600",
  "Agent Search": "text-violet-600",
  "Profile & Branding": "text-slate-600",
  Messages: "text-blue-600",
};

export function shadcnAgentSidebarNavIconClass(title: string): string {
  return shadcnAgentSidebarTitlePalette[title] ?? "text-muted-foreground";
}

/** Client / mirror dashboard stat tiles (`ClientDashboardView`). */
const clientDashboardStatLabelPalette: Record<string, string> = {
  "Hot Sheets": "text-red-600",
  Favorites: "text-rose-600",
  "New Matches": "text-amber-600",
  "Unread Messages": "text-blue-600",
};

export function clientDashboardStatIconClass(label: string): string {
  return clientDashboardStatLabelPalette[label] ?? "text-neutral-600";
}

export const successHubHotSheetsIconClass = "text-red-600";

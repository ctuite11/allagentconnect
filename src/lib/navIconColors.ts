/**
 * Semantic icon colors for buyer portal nav and shared stat rows (not agent shell sidebars).
 * Hot Sheets uses red where noted in product copy.
 */

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

/** Client / mirror dashboard stat tiles (`ClientDashboardView`). */
const clientDashboardStatLabelPalette: Record<string, string> = {
  "Hot Sheets": "text-red-600",
  Favorites: "text-rose-600",
  "New Matches": "text-[#16A34A]",
  "Unread Messages": "text-blue-600",
};

export function clientDashboardStatIconClass(label: string): string {
  return clientDashboardStatLabelPalette[label] ?? "text-neutral-600";
}

export const successHubHotSheetsIconClass = "text-red-600";

/**
 * Sidebar / top-nav active-state helpers (display only — no route changes).
 */

/** Agent AppShell (`DashboardSidebar`): highlight Hot Sheets. */
export function isAgentHotSheetsNavActive(pathname: string): boolean {
  return (
    pathname === "/agent/hot-sheets" ||
    pathname.startsWith("/agent/hot-sheets/") ||
    pathname === "/hot-sheets" ||
    pathname.startsWith("/hot-sheets/")
  );
}

/** Buyer `BuyerShell`: highlight Hot Sheets (includes client result pages). */
export function isBuyerHotSheetsNavActive(pathname: string): boolean {
  return (
    pathname === "/hot-sheets" ||
    pathname.startsWith("/hot-sheets/") ||
    pathname.startsWith("/client/hot-sheets")
  );
}

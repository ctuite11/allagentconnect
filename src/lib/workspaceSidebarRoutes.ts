/**
 * Route context for agent AppShell sidebar width.
 * Workspace pages (map + results) start collapsed to the icon rail; dashboard pages stay expanded.
 */

export type SidebarRouteContext = "workspace" | "standard";

/** Map-heavy / split-results layouts that benefit from a collapsed icon rail. */
const WORKSPACE_ROUTE_MATCHERS: Array<(path: string) => boolean> = [
  // Listing search + results
  (path) => path === "/listing-search",
  (path) => path === "/listing-results" || path.startsWith("/listing-results/"),
  (path) => path === "/agent-search",
  // Property / listing detail (agent AppShell via PropertyDetailShell)
  (path) => /^\/property\/[^/]+/.test(path),
  // Hot sheet match review
  (path) => /^\/hot-sheets\/[^/]+\/review/.test(path),
  // Buyer/client favorites + new matches (map + card split)
  (path) => /^\/agent\/buyers\/[^/]+\/favorites/.test(path),
  (path) => /^\/agent\/buyers\/[^/]+\/new-matches/.test(path),
  (path) => path === "/my-favorites",
  (path) => /^\/my-clients\/[^/]+\/favorites/.test(path),
];

export function getSidebarRouteContext(pathname: string): SidebarRouteContext {
  const path = pathname.split("?")[0].split("#")[0];
  return WORKSPACE_ROUTE_MATCHERS.some((match) => match(path)) ? "workspace" : "standard";
}

export function isWorkspaceSidebarRoute(pathname: string): boolean {
  return getSidebarRouteContext(pathname) === "workspace";
}

export const PUBLIC_MARKETING_PATHS = new Set([
  "/", "/about", "/faq", "/off-market-listing-network", "/request-access",
  "/agent-rules", "/privacy", "/terms", "/cookies", "/fair-housing", "/disclosures",
]);

export function isPublicMarketingPath(path: string): boolean {
  return PUBLIC_MARKETING_PATHS.has(path === "/" ? path : path.replace(/\/$/, ""));
}

export function isPrivateListingPath(path: string): boolean {
  return /^\/(property|consumer-property|s|shared-property)(\/|$)/.test(path)
    || /^\/client\/shared-property(\/|$)/.test(path);
}

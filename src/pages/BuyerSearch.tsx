import BrowsePropertiesNew from "./BrowsePropertiesNew";

/**
 * Buyer-only search page rendered at /client/search.
 *
 * Chain: /client/search → BuyerLayout (BuyerPortalHeader) → RouteGuard(requireAuth) → BuyerSearch → BrowsePropertiesNew(forceBuyer)
 *
 * forceBuyer disables:
 *   - DCMLS host branching (no DcmlsConsumerHeader)
 *   - ActiveAgentBanner (BuyerPortalHeader already provides the toolbar)
 *   - pt-14 spacer (BuyerLayout main starts directly under the header)
 *   - agent searchMode (always consumer for buyer accounts)
 *
 * This guarantees the buyer-only chain in production matches the local intended behavior
 * and is not shared with /browse (public) or DCMLS host paths.
 */
export default function BuyerSearch() {
  return <BrowsePropertiesNew forceBuyer />;
}
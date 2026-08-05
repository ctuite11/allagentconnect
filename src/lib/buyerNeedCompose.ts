/**
 * Canonical Buyer Need composition entry point.
 *
 * There is exactly ONE way to post a Buyer Need: the Communications Center
 * compose flow. The retired standalone `/submit-client-need` page inserted
 * straight into `client_needs`, which independently launched a second network
 * email campaign via the legacy database trigger. Every CTA must route here.
 */
export const BUYER_NEED_COMPOSE_PARAM = "compose";
export const BUYER_NEED_COMPOSE_VALUE = "buyer-need";

/** Route (path + query) that opens the canonical Buyer Need compose flow. */
export const BUYER_NEED_COMPOSE_ROUTE =
  `/communications?${BUYER_NEED_COMPOSE_PARAM}=${BUYER_NEED_COMPOSE_VALUE}`;

/** Legacy standalone path, kept only as a redirect source. */
export const RETIRED_BUYER_NEED_PATH = "/submit-client-need";

/** True when the given search string requests the Buyer Need composer. */
export function isBuyerNeedComposeRequested(search: string): boolean {
  return new URLSearchParams(search).get(BUYER_NEED_COMPOSE_PARAM) ===
    BUYER_NEED_COMPOSE_VALUE;
}

/** Disclosure shown before a Buyer Need is posted. */
export const BUYER_NEED_DISCLOSURE =
  "This posts your Buyer Need to the agent network and may notify agents who have opted in.";

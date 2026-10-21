/**
 * Decides where Back goes from a Communications channel page, following the
 * path the agent used. Unknown or missing origins keep the legacy fallback
 * (Communications Center).
 */
export const COMMUNICATIONS_CENTER_PATH = "/communications";
export const SUCCESS_HUB_PATH = "/agent-dashboard";

export type CommsChannelBackTarget = {
  path: string;
  label: string;
};

function isSafeInternalPath(from: string): boolean {
  return from.startsWith("/") && !from.startsWith("//");
}

export function resolveCommsChannelBack(originFrom?: string | null): CommsChannelBackTarget {
  const from = typeof originFrom === "string" ? originFrom : null;

  if (from && isSafeInternalPath(from) && from.startsWith(SUCCESS_HUB_PATH)) {
    return { path: from, label: "Back to Success Hub" };
  }
  return { path: COMMUNICATIONS_CENTER_PATH, label: "Communications Center" };
}

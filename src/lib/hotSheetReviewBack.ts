/**
 * Decides where Back goes from Hot Sheet results, following the path the agent used.
 * Unknown origins keep the legacy fallback (buyer dashboard if linked, else Hot Sheets).
 */
export const AGENT_HOT_SHEETS_PATH = "/agent/hot-sheets";

export type ReviewBackTarget = {
  path: string;
  state?: { from?: string };
  label: string;
};

export function resolveHotSheetReviewBack(input: {
  originFrom?: string | null;
  parentFrom?: string | null;
  buyerContextClientId?: string | null;
}): ReviewBackTarget {
  const { originFrom, parentFrom, buyerContextClientId } = input;
  const from = typeof originFrom === "string" ? originFrom : null;

  if (from === AGENT_HOT_SHEETS_PATH || from === "/hot-sheets") {
    return { path: AGENT_HOT_SHEETS_PATH, label: "Back to Hot Sheets" };
  }
  if (from && from.startsWith("/hot-sheets/buyer/")) {
    return {
      path: from,
      state: parentFrom ? { from: parentFrom } : undefined,
      label: "Back to buyer's Hot Sheets",
    };
  }
  if (from && from.includes("/agent/buyers/")) {
    return {
      path: from.split("?")[0].replace(/\/(favorites|new-matches)(\/.*)?$/, ""),
      label: "Back to buyer",
    };
  }
  if (buyerContextClientId) {
    return { path: `/agent/buyers/${buyerContextClientId}`, label: "Back to buyer" };
  }
  return { path: AGENT_HOT_SHEETS_PATH, label: "Back to Hot Sheets" };
}

/**
 * User-facing Communications Center Filters copy (category / audience selections).
 * Internal APIs and DB columns remain "preferences" where already named that way.
 */

export const COMMS_FILTERS_SECTION_QUERY = "section=filters";

/** In-app path that scrolls to the Filters / email alert settings section. */
export const COMMS_FILTERS_ROUTE = `/communications?${COMMS_FILTERS_SECTION_QUERY}`;

export const COMMS_FILTERS_UI = {
  savedToast: "Filters saved successfully",
  saveFailedToast: "Failed to save filters. Please try again.",
  setFilters: "Set Filters",
  setFiltersNow: "Set Filters Now",
  saveFilters: "Save Filters",
  dialogTitle: "Set your communications filters",
  targetingHint:
    "Email channels stay off until you turn one on. Choose which network activity you want to receive — which opportunities you get inside each category is controlled separately by your targeting filters below.",
  sendDialogAudience:
    "Send a targeted email to users whose filters match your selected geography",
  reviewFiltersCta: "Review Communication Filters",
  reviewFiltersBody:
    "Please review your Communications Center filters to make sure your channels, coverage area, and notification timing are set the way you want.",
  seoDescription:
    "Agent-to-agent channels, notification filters, and email alert settings.",
} as const;

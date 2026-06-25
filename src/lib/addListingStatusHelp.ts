export const ADD_LISTING_STATUS_INTRO_SESSION_KEY = "aac_add_listing_status_intro_later";

export const addListingStatusIntroDismissedKey = (userId: string) =>
  `addListingStatusIntroDismissed:${userId}`;

export type AddListingStatusBullet = {
  label: string;
  description: string;
};

/** Shared copy for first-visit modal and ? popover. */
export const ADD_LISTING_STATUS_INTRO = {
  title: "Understanding Listing Statuses",
  body: "Choose the status that matches where your listing is today. Some statuses update automatically based on the dates you enter.",
  bullets: [
    {
      label: "Off Market",
      description:
        "A listing with no On MLS date. Can be published on Direct Connect MLS. Status is updated by the agent only.",
    },
    {
      label: "Coming Soon",
      description:
        "Visible to agents now and automatically changes to On MLS on your selected On MLS Date.",
    },
    {
      label: "On MLS",
      description: "Active on the MLS.",
    },
    {
      label: "Pending",
      description: "Offer accepted and moving toward closing. Updated manually.",
    },
    {
      label: "Sold",
      description: "Closed sale. Updated manually.",
    },
    {
      label: "Expired",
      description: "Automatically applied on the Expiration Date when one is set.",
    },
  ] satisfies AddListingStatusBullet[],
  automaticHeading: "Automatic status changes",
  automaticNotes: [
    "Coming Soon → On MLS on the selected On MLS Date",
    "Any listing → Expired on the Expiration Date when one is set",
    "All other status changes are updated manually by the agent.",
  ],
};

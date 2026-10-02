# Square footage in "Ready to publish?"

## Finding
The popup already supports square footage. It shows "1,234 Sq Ft" next to beds and baths when the listing has a value. Your test Draft (L-1407) has no square footage saved, so that item was left out. Listings that have square footage already show it.

## Change
Always show square footage in the popup's listing details:
- If the listing has square footage, show "1,234 Sq Ft" (same as today).
- If the field is empty, show "Sq Ft not entered" in the same spot, so the agent sees it's missing before publishing.

Nothing else in the popup changes. Square footage stays optional, the publish rules stay the same, and the social section stays hidden.

## Technical details
- `src/components/add-listing/ConfirmBeforePublishingDialog.tsx`, the vitals list (~line 50): change `sqft ? \`${sqft} Sq Ft\` : null` to `sqft ? \`${sqft} Sq Ft\` : "Sq Ft not entered"`.

## QA (read-only)
Open Draft L-1407, click Publish, and confirm "Sq Ft not entered" appears next to beds and baths. Then click Go Back. Nothing gets published, saved or emailed.

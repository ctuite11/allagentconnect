# Fix: Agent profile buttons showing through the Contact modal

## What's wrong
On the public agent profile, when the "Contact <Agent>" dialog is open, the dark "Email Randall" button and the social icons (Instagram, etc.) still float on top of the modal, overlapping the Email field.

## Cause
The container holding those buttons on the agent profile page is given a stacking level of `z-[60]`, which is higher than the modal overlay and modal panel (`z-50`). So the page buttons paint above the dialog instead of behind it.

## The fix
- Remove the elevated stacking level from that button/social row on the agent profile so it sits in normal page flow beneath the dialog.
- No layout, spacing, copy, or behavior changes — only the stacking value.

## Technical detail
- File: `src/pages/AgentProfile.tsx` (line ~521): change `className="relative z-[60] mt-4 border-t border-neutral-100 pt-4"` to drop `z-[60]` (keep `relative` only if needed for existing layout).

## Verification
- Open an agent profile with social links, click "Email <name>", and confirm the dialog covers the button and icons cleanly on desktop and mobile.

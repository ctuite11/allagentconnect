# Agent invitation visual refresh

Update only the existing agent-forward invitation email, preserving all approved copy and behavior.

## Changes
- Split the hero headline so “ONE NETWORK.” remains white and “ALL AGENTS.” uses AAC green `#50C878`.
- Crop the supplied listing-search screenshot to the application content, removing the thin outer whitespace while retaining the map and listing cards.
- Add a single responsive product-preview section after “Why become a member?” and before “A Special Invitation.”
- Use the exact supplied heading, supporting line, and caption.
- Present the screenshot with email-safe rounded corners and a subtle shadow.
- Store the optimized screenshot in the existing public brand asset storage so it loads reliably in forwarded emails.

## Preserve
- Do not alter any other email copy, CTA, agent signature/contact card, registration link, sender, reply-to, layout, or branding.
- Do not modify other email templates or the frontend.
- Do not send or queue an email unless separately approved.

## Delivery
- Update and deploy only the agent-forward invitation sender and its shared template.
- Verify the generated email contains the split-color headline, exact new section copy, hosted image, and unchanged invitation/signature content.

# Global address formatting + spell-check

## 1. One address format everywhere
- The shared address formatter (fixed earlier today to keep MA/NH/RI in capitals) becomes the only way listing addresses are shown on screen.
- Audit and switch over the screens that still build the address by hand (street + city + state + ZIP). Candidates found so far:
  - property detail and the consumer property detail
  - My Listings, Agent Dashboard, Consumer Dashboard, Listing Analytics, DCMLS Saved
  - Hot Sheet Review and Preview, Agent Match and its results panel
  - Listing Card, Reverse Prospect dialog, New Conversation dialog, map pins
- For each candidate, only the text shown on screen changes. Map search queries, links, form values and saved data are left as they are.
- If a screen deliberately shows only the street or only the city, it uses the matching shared helper (street line, or conversation title) instead of the full address.
- Emails: email templates are frozen, so the email formatter is not edited. Add a test that feeds the same addresses (MA, NH, RI, unit, "USA" suffix) through both the web and email formatters and flags any difference. If the test finds a difference, report it for your decision rather than changing the email.
- No stored listing data is rewritten.

## 2. Spell-check on Profile
On the Profile editor, turn on the browser's spell-check for free-text fields: Title, Team Name, Brokerage/Company, Office Name, Bio, testimonial role and testimonial text.
- Short names and titles: first letter of each word capitalized automatically.
- Bio and testimonials: first letter of each sentence capitalized.
- Spell-check stays off for email, phone, website/social links and license numbers.

## 3. Spell-check on Add/Edit Listing
Turn on spell-check, with sentence capitalization, for the listing's written-text fields: description, remarks, showing instructions, compensation notes, disclosure/custom text, custom document labels.
- Spell-check stays off for the address autocomplete (no change there), city/state/ZIP, prices and numbers, MLS numbers, phone, email and links.

## QA
- 4 Derne St #1, Boston, MA 02114 appears exactly that way on the detail page and on a listing card.
- Another MA listing and one NH/RI listing keep their state letters in capitals.
- Typing "Real Estate Advisot" into Profile Title gets the browser's red underline. The same goes for a misspelling in Description and in Showing Instructions.
- Address autocomplete still works and shows no spelling warnings.

No redesign, no data changes.

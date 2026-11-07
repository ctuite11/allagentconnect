# 100 Lovejoy Wharf #12G — why it's missing from search

## What the records show (read-only)
- The listing is **100 Lovejoy Wharf, Unit 12G, Boston 02114**, condo, 1 bed / 2 bath, 955 sq ft, price range $1,299,000–$1,325,000.
- Listing agent: Barbara Mihalko.
- It went from Draft straight to **Off Market ("Private")** tonight at about 8:36 PM ET. It was never Active or Coming Soon.
- It has no single list price (price is 0), only a price range. The search price filter already handles price ranges, so that's not the cause.
- Three other "Lovejoy" records are still Drafts, and drafts never appear anywhere, as intended.

## Likely causes (not yet confirmed which one you hit)
1. **The "Private" status wasn't selected.** The agent search shows only the statuses you tick. Private listings show up only when "Private" is included.
2. **The older search results page hides Private listings from everyone except the listing agent.** It has a rule that removes Off Market listings unless you're the listing agent. Hot Sheet matching has no such rule. That's why a Hot Sheet can match it while search doesn't show it. The main agent search (Listing Search → results) does **not** have this rule.

## Proposed next step
1. Confirm which search screen you used and whether "Private" was ticked. I'll test that exact search signed in as you, without changing anything.
2. If it's cause 2, make the older results page follow the same rule as the main search and Hot Sheets, so verified agents can see Private listings. That only changes what search displays. It doesn't change any listing, Hot Sheet, email or permission.
3. If it's cause 1, no code change. Just tick "Private" in the status filter.

No changes until you approve.

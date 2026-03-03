

## Plan: Agent View Sidebar — Add Listing Agent Card, Contact Button in Showing Instructions, Reorder

**File: `src/components/PropertyDetailRightColumn.tsx`** (agent view branch, lines 144-297)

### Three changes in the `isAgentView` return block:

**1. Add Listing Agent Contact Card as FIRST item** (before Agent Actions)
- Show agent avatar, name, title, company, phone, email, website link
- Include "Contact Agent" button using `handleMessageListingAgent`, gated by `canMessageListingAgent` (won't show if viewing own listing)
- Only render if `agent` prop exists

**2. Add "Contact Agent" button inside Showing Instructions card** (after the instructions text, line ~222)
- Same `handleMessageListingAgent` handler, gated by `canMessageListingAgent`
- Small outline button at bottom of card

**3. Reorder sidebar cards**
Current order → New order:
1. **Listing Agent Card** ← NEW
2. Agent Actions (Edit, Send, Copy) — unchanged
3. Showing Instructions (+ Contact button) ← MODIFIED
4. Disclosures — unchanged
5. Listing Agreement — unchanged
6. Activity & Stats — unchanged
7. **Buyer Agent Compensation** ← MOVED from position 2 to last

**Also: `src/pages/PropertyDetail.tsx`** — Move Buyer Agent Compensation (lines 1114-1156) from after the two-column grid to immediately after the Agent Tools header (after line 999), so it appears below the title in the main content area too.

No DB, routing, or RLS changes.


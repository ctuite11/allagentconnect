## Problem
Agent Network cards on `/our-members` render without phone or email. Root cause: the `agent_profiles` select in `src/pages/OurAgents.tsx` (line 151) omits the `email`, `phone`, and `cell_phone` columns. The enrichment mapping (lines 246–248) still tries to read them, so those fields land as `undefined` and the card's `AgentPhotoTile` renders nothing for the contact lines.

The search helper `src/lib/agentNetworkSearch.ts` already expects `email` / `phone` / `cell_phone` on each agent, so it's genuinely a missing-fetch bug — not a privacy gate.

## Fix
Single-file, single-line change in `src/pages/OurAgents.tsx`:

Update the select at line 151 from:
```
id, aac_id, first_name, last_name, company, office_name, team_name, headshot_url, buyer_incentives, updated_at, title,
```
to:
```
id, aac_id, first_name, last_name, company, office_name, team_name, headshot_url, buyer_incentives, updated_at, title, email, phone, cell_phone,
```

No other logic changes. Enrichment mapping and card rendering already handle these fields.

## Verification
- Load `/our-members` as a verified agent → cards show name, brokerage, email, and phone.
- Text search by phone digits / email substring works (already wired via `agentNetworkSearch`).
- No RLS change: `agent_profiles` already returns these columns to authenticated agents.

## Out of scope
- Public `/our-agents` page (`PublicOurAgents`) — not mentioned by user; leave anti-scraping behavior untouched.
- Card layout / styling.
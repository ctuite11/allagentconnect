## Show recipient email in analytics, hide for bulk >5

### File
`src/pages/AdminEmailAnalytics.tsx`

### Change
Update `recipientFor(j)` so the Recipient cell shows the actual address(es) for individual sends but collapses to a count for bulk sends:

- `payload.to` is a string → show the string
- `payload.to` is an array of length ≤ 5 → show comma-joined addresses
- `payload.to` is an array of length > 5 → show `"<n> recipients (bulk)"` (no addresses)
- Else fall back to `payload.recipient ?? "—"`

No other UI, query, or column changes. Tooltip/styling unchanged (existing `truncate max-w-[260px]` still applies).

### Out of scope
DB, RLS, edge functions, exports, stats cards, By template card.

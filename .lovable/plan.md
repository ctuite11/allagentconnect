## Goal
Communications feed rows clamp the message body to 2 lines. Show the full message text on every row.

## Change
`src/pages/CommunicationsFeed.tsx` (~line 209): remove only `line-clamp-2` from the message `<p>`. Keep `whitespace-pre-wrap` so original paragraph/line breaks render.

Before:
```tsx
<p className="mt-1 text-[13px] leading-snug text-neutral-700 line-clamp-2 whitespace-pre-wrap">
```

After:
```tsx
<p className="mt-1 text-[13px] leading-snug text-neutral-700 whitespace-pre-wrap">
```

## Verification
Open View All Communications and confirm every row shows the complete message body with original line breaks preserved.

## Out of scope
- Success Hub Network Activity previews (stay compact).
- Subject truncation, filters, search, contact row, data fetching, styling.

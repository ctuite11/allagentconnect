

# Fix Hero Layout: Left-Aligned, Not Centered

## Problem
The hero section is currently centered (`items-center text-center`). The reference screenshot clearly shows a **left-aligned** layout: headshot on the left with name + details to its right, all starting from the left edge — not centered on the page.

## Changes to `src/pages/AgentProfile.tsx`

### Hero section (lines 227-310)
Replace the centered `flex-col items-center text-center` layout with a left-aligned horizontal composition matching the reference:

```text
[Headshot]  [Name (large, last name in primary)]
            [Title]
            [Company · AAC ID]
            [Contact Agent btn] [Save Contact btn]
            [phone icon + number]  [mail icon + email]  [globe + website]
            [badges row]
```

**Specific changes:**
- Outer wrapper: `flex items-start gap-8` instead of `flex-col items-center text-center`
- Headshot stays `w-36 h-36 rounded-full` but sits as a flex child on the left, not centered above
- Right side is a `flex-col` with all text left-aligned (`text-left`)
- Name remains `text-4xl font-bold`, last name in `text-primary`
- Title, company, AAC ID flow naturally below the name
- Buttons row left-aligned below metadata
- Contact info row left-aligned below buttons (remove `justify-center`, use `justify-start`)
- Badges left-aligned below contact row
- Remove all `text-center` and `items-center` from the hero

### No other changes
- About, Testimonials, Listings sections stay as-is
- No data/routing/action logic changes

## Files modified
- `src/pages/AgentProfile.tsx` — hero section layout only


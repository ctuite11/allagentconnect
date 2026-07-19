## Goal
Flip visual hierarchy on Success Hub Communications channel preview cards so **View All** is primary and **Create New** is secondary.

## Scope
Single file: `src/components/success-hub/networkActivity/ChannelPreviewCard.tsx`. Affects all four channel cards uniformly (Buyer Needs, Sales Intel, Renter Needs, General Discussions).

## Changes

**Action row (top-right of each card):**

Current:
- `Create New` — filled primary button (blue, prominent)
- `View all →` — small gray text link

New:
- `View All` — primary button (small filled or solid outlined, brand blue)
- `+ Create New` — small secondary text link with plus icon, positioned to the right of View All

Both remain in the same top-right slot on every card for consistency.

## Technical Details

In `ChannelPreviewCard.tsx`, swap the styling of the two elements in the `action` prop:

```text
[ View All ]   + Create New
 (primary)     (secondary link)
```

- `View All` becomes a `<Link>` styled like the existing primary button (bg-primary, text-primary-foreground, px-2.5 py-1, text-[11px] font-semibold, rounded-md, hover:bg-primary/90).
- `+ Create New` becomes a `<button>` styled like the current "View all" link (text-[12px] font-medium text-neutral-700, hover underline), with a small `<Plus className="h-3 w-3" />` inline.
- Order: View All first (left), Create New second (right), separated by `gap-3`.
- No changes to card body, empty state, or list rendering.
- No changes to other files — the four channel cards on the Success Hub all consume this component, so hierarchy updates propagate automatically.

## Out of Scope
- No changes to routes, filters, or the `onCreate` handlers.
- No changes to other Success Hub sections.

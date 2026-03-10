

## Fix: Center Status equidistant between ID and Price

The left zone has `flex-1` (takes all remaining space) while center and right are `flex-shrink-0` with fixed min-widths. This means the status block hugs the right/price column instead of sitting centered.

**Fix (line 322)**: Add `justify-between` to the parent flex so the three zones spread evenly across the row, with the center status naturally sitting equidistant between left and right.

```
// Before
<div className="flex items-start gap-4">

// After
<div className="flex items-start justify-between gap-4">
```

One line change.


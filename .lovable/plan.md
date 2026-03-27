

# Regression Fix: Sale Listing Flow

**File:** `src/pages/AddListing.tsx` (only file modified)

---

## Fix 1 — Disable Price Range when List Price is entered

**Lines ~3411-3430:** Add `disabled` prop to both `price_range_min` and `price_range_max` `FormattedInput` components when `formData.price` has a value.

```tsx
<Label>Price Range (optional)</Label>
<div className="grid grid-cols-2 gap-2">
  <FormattedInput
    id="price_range_min"
    format="currency"
    placeholder="Min"
    value={formData.price_range_min}
    onChange={(value) => setFormData(prev => ({ ...prev, price_range_min: value }))}
    decimals={0}
    disabled={!!formData.price}
  />
  <FormattedInput
    id="price_range_max"
    format="currency"
    placeholder="Max"
    value={formData.price_range_max}
    onChange={(value) => setFormData(prev => ({ ...prev, price_range_max: value }))}
    decimals={0}
    disabled={!!formData.price}
  />
</div>
{!!formData.price && (
  <p className="text-xs text-muted-foreground">Price range is disabled when a list price is entered.</p>
)}
```

**Save layer (~lines 2117-2118 and 2619-2620):** When `formData.price` exists, force `price_range_min` and `price_range_max` to `null` in the payload so conflicting data is never persisted.

---

## Fix 2 — Replace rental agreement options with sale-specific ones

**Lines 4349-4353:** Replace:
```tsx
{ value: "A - Exclusive Right to Rent", label: "A – Exclusive Right to Rent" },
{ value: "B - ER w/ Named Exclusion", label: "B – ER w/ Named Exclusion" },
{ value: "D - Exclusive Agency", label: "D – Exclusive Agency" },
```

With sale-specific options:
```tsx
{ value: "Exclusive Right to Sell", label: "Exclusive Right to Sell" },
{ value: "Exclusive Agency", label: "Exclusive Agency" },
{ value: "Open Listing", label: "Open Listing" },
{ value: "Net Listing", label: "Net Listing" },
```

No other changes needed — the form field name (`listing_agreement_type`) and save logic remain the same.

---

## Fix 3 — Preserve draft status for Publish button visibility

**Root cause (lines 578-583):** When loading a draft for editing, the code converts `"draft"` → `"new"` and stores `"new"` in `originalStatusRef.current`. This means the Publish button condition on line 2923 (`originalStatusRef.current === "draft"`) is **never true** for reopened drafts.

**Fix:** Add a separate ref to track the true backend status:

```tsx
const backendStatusRef = useRef<string | null>(null);
```

During load (~line 575), store the raw status before normalization:
```tsx
backendStatusRef.current = (data.status || "new").toLowerCase();
```

Then update the button logic (~line 2923) to use `backendStatusRef.current === "draft"` instead of `originalStatusRef.current === "draft"` for both the Publish label and the Save Draft label on line 2931.

Also update `handleSaveChanges` to use the correct publish target status when a draft is being published (status changed from draft to a live status).

---

## Summary of changes

| Issue | Root cause | Fix location (lines) |
|---|---|---|
| Price range active with list price | No `disabled` prop on inputs | ~3414-3429 + save payloads |
| Rental agreements in sale flow | Wrong hardcoded options array | ~4349-4353 |
| No Publish button on draft edit | `draft` normalized to `new` before storing in ref | ~578-583 + ~2923-2931 |



# Rename & Relocate Commission Section

## What Changes

### 1. Rename Section (lines 3430-3480)
- Section title: "Commission & Compensation" --> "Buyer Agent Compensation"
- Subtitle/helper text added: "Offered from the seller"
- Field labels updated:
  - "Commission Type" --> "Compensation Type"
  - "Rate (%)" / "Flat Amount ($)" --> unchanged (already descriptive)
  - "Commission Notes" --> "Compensation Notes"

### 2. Move Section
- **Remove** the commission block from its current position (lines 3430-3480, between the address/pricing area and Property Details)
- **Insert** it between "Listing Agreement" (ends line 4365) and "Showing Instructions" (starts line 4368)
- The `for_sale` conditional wrapper stays intact

### 3. No other changes
- No database changes
- No field logic or save changes
- Labels in `formData` keys (`commission_rate`, `commission_type`, `commission_notes`) stay the same -- only UI labels change

---

## Technical Detail

**File**: `src/pages/AddListing.tsx`

1. **Cut** lines 3430-3480 (the entire `{/* Commission & Compensation - For Sale only */}` block)
2. **Paste** between line 4365 (end of Listing Agreement) and line 4368 (start of Showing Instructions)
3. Update labels within the moved block:
   - Section heading: `"Buyer Agent Compensation"`
   - Add subtext: `"Offered from the seller"`
   - "Commission Type" --> "Compensation Type"
   - "Commission Notes" --> "Compensation Notes"

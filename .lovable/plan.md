

# Fix Google Places Dropdown Visibility

## Scope lock
Modify only: `src/index.css`

## Problem
Google Places autocomplete is initializing correctly, but the suggestions dropdown (`.pac-container`) renders behind dialogs/modals due to missing z-index override — making it appear broken.

## Fix
Add one CSS rule to `src/index.css`:

```css
.pac-container {
  z-index: 10000 !important;
}
```

This will be added at the end of the existing utility layer.

## Expected result
- Typing an address shows Google suggestions
- Dropdown appears above modals, dialogs, sheets
- No logic changes, no other files modified


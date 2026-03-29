

# Fix: Remove Bottom Save Bar From Client Needs Page

## Root cause

Lines 420-442 in `src/pages/ClientNeedsDashboard.tsx` render the save section **outside** `<main>` as a full-width footer-style block with `border-t`, `bg-white`, and `px-6` — creating the horizontal bar effect.

## Change

### `src/pages/ClientNeedsDashboard.tsx`

Move the save section **inside** `<main>` (before its closing tag) and restyle it as a normal inline action row:

**Remove** (lines 420-442): the current footer block outside `</main>`

**Add** (inside `<main>`, after the AlertDialog, before `</main>`): a simple inline row:

```tsx
{hasUnsavedChanges && (
  <div className="mt-8 flex items-center justify-between">
    <p className="text-zinc-500 text-sm">You have unsaved changes</p>
    <Button onClick={handleSavePreferences} disabled={saving}>
      {saving ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving...
        </span>
      ) : (
        "Save Preferences"
      )}
    </Button>
  </div>
)}
```

Key differences:
- No `border-t`, no `bg-white`, no `px-6` — removes the bar appearance
- Inside `<main>` — aligns with page content width
- `mt-8` provides spacing from the form above
- Same button and dirty-state logic preserved


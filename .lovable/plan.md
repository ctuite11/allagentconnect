## Add double-click guard to Preview Comms Guide button

**File:** `src/pages/AdminApprovals.tsx`

**Change:** Add an in-flight state (`isSendingPreview`) around the "Preview Comms guide email" button's click handler.

- Set `isSendingPreview = true` before invoking `send-comms-guide-email`.
- Disable the button while true (`disabled={isSendingPreview}`) and show a subtle "Sending…" label.
- Reset to `false` in a `finally` block after the invoke resolves or errors.

**Result:** A rapid double-click can no longer enqueue two preview sends. No changes to the edge function or email templates.

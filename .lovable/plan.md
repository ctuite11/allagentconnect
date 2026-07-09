# Fix profile-reminder send from UI

## Root cause

`EmailAgentDialog.tsx` line 123 only forwards `template` to the edge function when it's one of the fixed HTML templates (`isTemplated`). For `profile-reminder`, `template` is sent as `undefined`, so the edge function doesn't know to bypass the `BULK_OUTREACH_PAUSED` gate and returns 503 — surfaced in the UI as "Edge Function returned a non-2xx status code".

## Change (frontend only, one file)

`src/components/admin/EmailAgentDialog.tsx`, in the `send-bulk-email` invoke body:

- `template: isTemplated ? template : undefined` → `template: isTemplated ? template : (template === "profile-reminder" ? "profile-reminder" : undefined)`
- `message: isTemplated ? "" : message.trim()` stays unchanged — profile-reminder is NOT templated, so the editable message body is still sent as-is.

## Result

- Selecting **Complete Your Profile — Reminder**, editing if desired, and clicking Send now reaches the edge function with `template: "profile-reminder"`, which the deployed backend already treats as a pause-gate bypass while still rendering as a custom message (`Hello {first name},` + your body + unsubscribe footer).
- Every other template and the pause behavior for all other bulk sends are unchanged.

## Out of scope

- No edge-function changes (already deployed correctly last turn).
- No changes to any other template's send path, subject/body auto-fill, or the pause gate itself.
## Goal
Prevent accidental sends from the two one-click email buttons in Admin Tools:
- **Email me forwardable invite**
- **Preview Comms guide email**

## Behavior
Clicking either button no longer sends immediately. It opens a confirmation dialog:

- Title: "Send this email?"
- Body names the exact email and recipient, e.g.
  - "The forwardable Join Invitation will be sent to chris@allagentconnect.com."
  - "The Comms Center guide preview will be sent to {your admin email}."
- Buttons: **Cancel** (default focus) and **Send email**.
- Confirming runs the existing send logic unchanged (same edge functions, same payloads, same toasts). The confirm button shows a sending state and stays disabled until the request finishes, keeping the existing double-click guard.
- Cancel closes with no request made.

No other admin buttons change (Consumers, Team Approvals, Create Agent, etc.).

## Technical detail
- File: `src/pages/AdminApprovals.tsx`
- Add local state for a pending send action (`null | "forward-invite" | "comms-preview"`), reuse the existing shadcn `AlertDialog` pattern already used elsewhere in the page.
- Move the two inline `onClick` bodies into named handlers; buttons only set the pending action, dialog's confirm invokes the handler.
- Keep `isSendingCommsPreview` as the in-flight guard and add an equivalent flag for the forwardable invite so its confirm button also disables during send.

# Add Batch Range Selector to Bulk Email

Right now the "Email Selected Agents" dialog sends to every selected recipient in one shot. With 1,000 agents selected there's no way to send in controlled waves (e.g. first 250 today, next 250 tomorrow) for warm-up or deliverability protection.

## What to add

In `src/components/admin/EmailAgentDialog.tsx`, above the Recipients preview, add a **Batch** control with:

1. **Batch size dropdown** — All / 250 / 500 / 1000
2. **Batch number selector** — appears when a size is chosen; shows "Batch 1 of N (recipients 1–250)", "Batch 2 of N (251–500)", etc., with Prev/Next buttons
3. **Live recipient slice** — the Recipients preview, the "Sending to X agents" description, and the actual send call all use the sliced subset (not the full list)
4. **Send button label** updates to `Send to 250 agents (batch 1 of 4)`

## Behavior

- Order is the order recipients were passed in (already deterministic from the parent multi-select).
- Choosing "All" = current behavior, no slicing.
- After a successful send, dialog stays open on the same batch settings but auto-advances to the next batch (with a toast like "Batch 1 sent. Ready for batch 2 of 4.") so the admin can space sends out manually. Closing the dialog resets.
- Existing 1,000-recipient cap in `send-bulk-email` and 2 campaigns/min rate limit remain unchanged — batching is purely a client-side slicing UX.

## Files touched

- `src/components/admin/EmailAgentDialog.tsx` — add state (`batchSize`, `batchIndex`), compute `currentBatch = recipients.slice(...)`, render the batch controls, pass `currentBatch` everywhere the full `recipients` is used today.

No backend, edge function, or schema changes.

## What's broken / missing

You're looking at hot sheet **Boston Homes** (`48b197db…`) for Chris. Right now:

1. **My Buyers** (`/agent/buyers`) only pulls Chris in via a `client_agent_relationships` row, and that relationship has been wiped to `pending` with no auth `client_id`. The hot‑sheet union path also silently fails because it queries `hot_sheets.agent_id` but the column is `user_id` — so Chris won't appear via the hot sheet either. Result: he's invisible, no place to resend.
2. **Buyer detail** (`/agent/buyers/:id` → "Hot sheets" cards via `HotSheetBuyerDetail.tsx`) shows each hot sheet card with name + match count, but **no created date, no invite status, no Resend control**. There's nowhere to retrigger the email without going back through the review flow (which is itself gated and skips when stale tokens exist — the thing we just hit).

## Fix plan

### 1. Pending buyer list — surface Chris

`src/pages/success-hub/BuyersList.tsx`

- Replace `.from("hot_sheets").select("id").eq("agent_id", user.id)` with `.eq("user_id", user.id)` (column is `user_id`).
- After loading relationships + hot‑sheet members, fetch outstanding `client_hotsheet_invite` share_tokens for this agent and union those buyers in too. If a buyer has no accepted token AND no `active` relationship → `status = "pending"`.
- This makes Chris show up under **Pending Invite · 1** even when his only signal is "added to a hot sheet, invite not accepted yet".

### 2. Hot sheet card — date, status badge, resend

`src/pages/HotSheetBuyerDetail.tsx` + `LinkedHotSheet` interface:

Add three things to the per‑hot‑sheet card rendered between lines 408–417:

- **Created date**: pull `created_at` in the existing `from("hot_sheets").select("id, name, criteria, created_at")` query. Render as `Created May 16, 2026` under the name.
- **Pending invite badge**: for the current buyer, compute `inviteAccepted` per hot sheet from the same `share_tokens` scan already in `fetchBuyerData` (lines 192–214). If `!buyerWorkspaceLinked && !acceptedHotSheetIdsForClient.has(hs.id)` → show neutral pill `<Clock /> Pending Invite` (reuse styling from `BuyerRowStatusPill`). Otherwise show emerald `<CheckCircle /> Sent` when accepted, or nothing if buyer is in shared workspace.
- **Resend button**: only when the pending‑invite badge is shown. Clicking it:
  1. Looks up (or creates) a `share_tokens` row of type `client_hotsheet_invite` for `{client_id, client_email, hot_sheet_id: hs.id}` scoped to this agent.
  2. Inserts a fresh `email_jobs` row (template `hot-sheet-invite`, `to: buyer.email`, subject `${agentName} shared a Hot Sheet with you`, vars include the invite link `/client-invite?invitation_token=...&hot_sheet_id=hs.id`) — identical payload shape to what `HotSheetReview.handleSendInvites` enqueues so `process-email-queue` picks it up and ships via Resend.
  3. Logs an `invite_events` row with `event_type = "invite_resent"` (matches the existing audit vocabulary in `AdminInviteAudit.tsx`).
  4. Toasts "Invite resent to chris.tuite@compass.com".

The button is a small ghost button next to **View** / **Favorites** with `RefreshCw` icon and text "Resend invite". Disabled + spinner while in‑flight.

### 3. Visual / copy

- Card header line becomes: `Hot Sheet Name: Boston Homes` (already there) + new line `Created May 16, 2026 · 3 listings match`.
- Pending pill sits at top‑right of the photo mosaic, next to the existing Edit / Delete row, so it's visible at a glance.

## Out of scope (call out, don't ship)

- Auto‑clearing stale `share_tokens` when an auth user is hard‑deleted (we hit this last turn). I noted it as a follow‑up in the prior plan; not part of this UI change.
- Touching `HotSheetReview.tsx` send/skip gate logic — fix is purely additive (new resend path + visible status), not changing the existing flow.

Confirm and I'll implement.
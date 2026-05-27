## Goal
Let a single bulk-email campaign send to up to 1,000 agents in one click, and drain through the queue in a few minutes instead of ~10.

## Changes

**1. Raise recipient cap in `send-bulk-email`**
- Change the "Maximum 500 recipients" guard to **1,000**.
- Keep the existing 2 campaigns / minute / user rate limit (safety net against accidental double-sends).

**2. Tune the email queue for faster drain**
- Update the single-row `email_send_state` config:
  - `batch_size`: 10 → **40**
  - `send_delay_ms`: 200 → **75**
- Result: ~400–500 emails/min throughput, so 1,000 emails drain in roughly 2–3 minutes instead of ~8–10.
- No edge-function redeploy needed for this; it's a config-table update.

**3. No UI changes**
- The "Email Selected Agents" dialog already supports multi-select and the new Private Listing Network template — it'll just accept up to 1,000 recipients now.

## What stays the same
- Resend as the delivery provider, existing templates, suppression list, unsubscribe handling, `email_send_log` tracking, retry/DLQ behavior.
- Per-recipient personalization and tracking pixel logic.

## How you'll send 1,000
1. Open Email Selected Agents → pick the 1,000 recipients.
2. Choose **Private Listing Network — All Agents**.
3. Send. Campaign enqueues instantly; queue drains over ~2–3 minutes.
4. Monitor progress in Admin → Email Analytics (`email_send_log`).

## Risks / notes
- Resend account sending limits still apply at the provider level. If your Resend plan caps daily volume below 1,000, sends will start failing partway through with rate-limit errors visible in `email_send_log`. Worth confirming the Resend plan tier before the first 1,000 blast.
- Bigger sends = bigger deliverability impact. Recommend warming up (e.g., 250 → 500 → 1,000 over a few days) the first time to protect domain reputation on `mail.allagentconnect.com`.

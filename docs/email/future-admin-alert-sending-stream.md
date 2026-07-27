# Future: separate admin alert sending stream

## Problem
Internal administrative alerts (e.g. `agent-verification-submitted`) currently share the same Resend sending domain and visible From (`All Agent Connect <hello@allagentconnect.com>`) as network notifications and bulk/outreach. Gmail can treat that shared reputation and similar templating as “messages similar to spam in the past,” even when SPF/DKIM/DMARC are aligned.

## Goal
Move **internal administrative / system alerts** onto a dedicated authenticated subdomain and From identity so they do not share reputation with:
- bulk / outreach campaigns
- high-volume network and marketing notifications

## Proposed direction (not implemented)
1. Verify a Resend subdomain such as `alerts.allagentconnect.com` (DKIM + `send.alerts.…` return-path SPF/MX).
2. Add a canonical admin/system From, e.g. `All Agent Connect Alerts <alerts@alerts.allagentconnect.com>`.
3. Route only internal templates through that From (admin verification, ops alerts). Keep agent/consumer transactional and marketing on their own streams.
4. Keep `BULK_EMAIL_PAUSED` (or equivalent) until outreach has its own subdomain as already noted in `transactionalSender.ts`.
5. Confirm Auth-Results and Resend Deliverability Insights on a controlled sample before cutting over production volume.

## Out of scope for the lean template change
Redesigning `agent-verification-submitted` HTML alone does not separate reputation. This doc tracks the follow-up stream split.
